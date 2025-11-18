import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// GET - Fetch current subscription details
export async function GET() {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // If no subscription, return free tier info
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({
        subscription: null,
        tier: profile.tier,
        credits: profile.credits,
        ai_credits: profile.ai_credits,
        isFree: true,
      });
    }

    // Fetch subscription from Stripe
    try {
      const subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id,
        {
          expand: ['items.data.price.product'],
        }
      );

      // Get plan details
      const priceId = subscription.items.data[0]?.price.id;
      const product = subscription.items.data[0]?.price.product as Stripe.Product;
      const amount = subscription.items.data[0]?.price.unit_amount || 0;
      const currency = subscription.items.data[0]?.price.currency || 'usd';

      // Calculate next billing date
      const nextBillingDate = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      return NextResponse.json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
        },
        plan: {
          priceId,
          productName: product?.name || 'Unknown',
          amount: amount / 100, // Convert from cents
          currency: currency.toUpperCase(),
          interval: subscription.items.data[0]?.price.recurring?.interval || 'month',
        },
        tier: profile.tier,
        credits: profile.credits,
        ai_credits: profile.ai_credits,
        nextBillingDate,
        isFree: false,
      });
    } catch (stripeError) {
      console.error('Error fetching subscription from Stripe:', stripeError);
      // Subscription might have been deleted in Stripe but not updated in DB
      return NextResponse.json({
        subscription: null,
        tier: profile.tier,
        credits: profile.credits,
        ai_credits: profile.ai_credits,
        isFree: true,
        error: 'Subscription not found in Stripe',
      });
    }
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel subscription
export async function DELETE(request: NextRequest) {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Cancel subscription in Stripe (cancels at period end)
    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

