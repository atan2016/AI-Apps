import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// POST - Update subscription (upgrade/downgrade)
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

    // Update subscription with new price
    // Also clear cancellation flag if user is upgrading (they want to continue)
    const updatedSubscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        items: [{
          id: subscription.items.data[0].id,
          price: priceId,
        }],
        cancel_at_period_end: false, // Clear cancellation flag - user is continuing subscription
        proration_behavior: 'none', // Don't prorate - changes take effect at period end
        metadata: {
          userId: userId,
          tier: tier,
        },
      }
    );

    // Update profile tier in database
    // Clear cancellation flag since user is upgrading (continuing subscription)
    const isPremier = tier.startsWith('premier_');
    await supabase
      .from('profiles')
      .update({
        tier: tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly',
        credits: 999999,
        ai_credits: isPremier ? 100 : 0,
        cancel_at_period_end: false, // Clear cancellation flag - user is continuing subscription
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully. Changes will take effect at the end of your current billing period.',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
      },
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

