import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
    let userId: string | null = null;
    
    if (!SKIP_AUTH) {
      const authResult = await auth();
      userId = authResult.userId;
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in or sign up.' }, { status: 401 });
      }
    } else {
      userId = 'test-user-skip-auth';
    }

    const { priceId, tier } = await request.json();

    if (!priceId || !tier) {
      return NextResponse.json(
        { error: 'Price ID and tier are required' },
        { status: 400 }
      );
    }

    // Get or create profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ user_id: userId, tier: 'free', credits: 1 })
        .select()
        .single();
      profile = newProfile;
    }

    // Create or retrieve Stripe customer
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    // If user has a cancelled subscription that hasn't ended yet, restore it instead of creating new one
    // Only handle this for subscription mode, not one-time payments
    if (mode === 'subscription' && profile?.stripe_subscription_id && profile?.cancel_at_period_end) {
      try {
        // Check if subscription still exists and is still active (not yet ended)
        const existingSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        
        // If subscription is active but set to cancel, restore it
        if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
          // Clear cancellation flag in Stripe
          await stripe.subscriptions.update(profile.stripe_subscription_id, {
            cancel_at_period_end: false,
          });

          // Update profile to clear cancellation flag
          const isPremier = tier.startsWith('premier_');
          await supabase
            .from('profiles')
            .update({
              cancel_at_period_end: false,
              tier: tier as any,
              credits: 999999,
              ai_credits: isPremier ? 100 : 0,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          // Return success - subscription has been restored
          return NextResponse.json({ 
            success: true,
            message: 'Subscription restored successfully',
            restored: true,
          });
        }
      } catch (error) {
        // If subscription doesn't exist or is already cancelled, continue with new checkout
        console.log('Existing subscription not found or already ended, creating new checkout session');
      }
    }

    // Determine mode based on tier (credit_pack is one-time payment, others are subscriptions)
    const mode = tier === 'credit_pack' ? 'payment' : 'subscription';

    // If user has a cancelled subscription that's still active, restore it instead of creating new checkout
    if (mode === 'subscription' && profile?.stripe_subscription_id && profile?.cancel_at_period_end) {
      try {
        // Check if subscription still exists and is active
        const existingSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        
        // If subscription is still active (not yet ended), restore it
        if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
          // Update subscription to clear cancellation and change price if different tier
          const currentPriceId = existingSubscription.items.data[0]?.price.id;
          
          const updateParams: Stripe.SubscriptionUpdateParams = {
            cancel_at_period_end: false, // Restore subscription
            metadata: {
              userId: userId,
              tier: tier,
            },
          };

          // If price is different, update it
          if (currentPriceId !== priceId) {
            updateParams.items = [{
              id: existingSubscription.items.data[0].id,
              price: priceId,
            }];
            updateParams.proration_behavior = 'none'; // Changes take effect at period end
          }

          const restoredSubscription = await stripe.subscriptions.update(
            profile.stripe_subscription_id,
            updateParams
          );

          // Update profile to clear cancellation flag and update tier
          const isPremier = tier.startsWith('premier_');
          await supabase
            .from('profiles')
            .update({
              cancel_at_period_end: false,
              tier: tier as any,
              credits: 999999,
              ai_credits: isPremier ? 100 : 0,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          // Return success - subscription has been restored
          return NextResponse.json({ 
            success: true,
            message: 'Subscription restored successfully',
            restored: true,
            subscription: {
              id: restoredSubscription.id,
              status: restoredSubscription.status,
            },
          });
        }
      } catch (error) {
        // If subscription doesn't exist or has already ended, continue with new checkout
        console.log('Existing subscription not found or already ended, creating new checkout session:', error);
      }
    }

    // Create checkout session for new subscription or one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${request.headers.get('origin')}?success=true`,
      cancel_url: `${request.headers.get('origin')}?canceled=true`,
      metadata: {
        userId: userId,
        tier: tier,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

