import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin, getAICreditsForTier } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// POST - Update subscription (upgrade/downgrade)
export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.trim() === '') {
      console.error('STRIPE_SECRET_KEY is not set or is empty');
      return NextResponse.json(
        { error: 'Server configuration error: Stripe key missing' },
        { status: 500 }
      );
    }
    
    // Validate Stripe instance was created
    if (!stripe) {
      console.error('Stripe instance is not initialized');
      return NextResponse.json(
        { error: 'Server configuration error: Stripe not initialized' },
        { status: 500 }
      );
    }

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

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { priceId, tier } = body;

    if (!priceId || !tier) {
      return NextResponse.json(
        { error: 'Price ID and tier are required', received: { priceId: !!priceId, tier: !!tier } },
        { status: 400 }
      );
    }

    // Validate priceId format (Stripe price IDs start with 'price_')
    if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      console.error('Invalid priceId format:', priceId);
      return NextResponse.json(
        { error: 'Invalid price ID format' },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Supabase profile error:', profileError);
      return NextResponse.json(
        { error: 'Database error: ' + profileError.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found', userId: userId },
        { status: 404 }
      );
    }

    // Validate subscription ID format (Stripe subscription IDs start with 'sub_')
    if (!profile.stripe_subscription_id.startsWith('sub_')) {
      console.error('Invalid subscription ID format:', profile.stripe_subscription_id);
      return NextResponse.json(
        { error: 'Invalid subscription ID format' },
        { status: 400 }
      );
    }

    // Get current subscription
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    } catch (stripeError) {
      console.error('Stripe retrieve error:', stripeError);
      const error = stripeError as { message?: string; type?: string; code?: string };
      const errorMessage = error?.message || 'Unknown Stripe error';
      const errorType = error?.type || 'unknown';
      const errorCode = error?.code || 'unknown';
      
      return NextResponse.json(
        { 
          error: 'Failed to retrieve subscription from Stripe',
          details: errorMessage,
          type: errorType,
          code: errorCode,
        },
        { status: 500 }
      );
    }

    // Validate subscription state
    if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
      return NextResponse.json(
        { 
          error: 'Subscription is not active',
          details: `Subscription status: ${subscription.status}`,
        },
        { status: 400 }
      );
    }

    if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
      return NextResponse.json(
        { error: 'Subscription has no items' },
        { status: 400 }
      );
    }

    const currentItem = subscription.items.data[0];
    const currentPriceId = currentItem.price.id;

    // Check if already on this price
    if (currentPriceId === priceId) {
      // Still update metadata and cancellation status even if price is same
      console.log('Price unchanged, updating metadata and cancellation status only');
    }

    // Prepare update parameters
    const updateParams: Stripe.SubscriptionUpdateParams = {
      cancel_at_period_end: false, // Clear cancellation flag - user is continuing subscription
      metadata: {
        userId: userId,
        tier: tier,
      },
    };

    // Only update price if it's different
    if (currentPriceId !== priceId) {
      updateParams.items = [{
        id: currentItem.id,
        price: priceId,
      }];
      updateParams.proration_behavior = 'none'; // Don't prorate - changes take effect at period end
    }

    // Update subscription with new price
    // Also clear cancellation flag if user is upgrading (they want to continue)
    let updatedSubscription;
    try {
      updatedSubscription = await stripe.subscriptions.update(
        profile.stripe_subscription_id,
        updateParams
      );
    } catch (stripeError) {
      console.error('Stripe update error:', stripeError);
      const error = stripeError as { message?: string; type?: string; code?: string };
      const errorMessage = error?.message || 'Unknown Stripe error';
      const errorType = error?.type || 'unknown';
      const errorCode = error?.code || 'unknown';
      
      // Provide more helpful error messages for common issues
      let userFriendlyError = errorMessage;
      if (errorCode === 'resource_missing') {
        userFriendlyError = 'Subscription item not found. Please contact support.';
      } else if (errorCode === 'invalid_request_error') {
        userFriendlyError = 'Invalid subscription update request. Please try again.';
      } else if (errorMessage.includes('No such price')) {
        userFriendlyError = 'Invalid price ID. Please contact support.';
      } else if (errorMessage.includes('No such subscription_item')) {
        userFriendlyError = 'Subscription item not found. Please contact support.';
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to update subscription in Stripe',
          details: userFriendlyError,
          rawError: errorMessage,
          type: errorType,
          code: errorCode,
        },
        { status: 500 }
      );
    }

    // Update profile tier in database
    // Clear cancellation flag since user is upgrading (continuing subscription)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        tier: tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly',
        credits: 999999,
        ai_credits: getAICreditsForTier(tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly'),
        cancel_at_period_end: false, // Clear cancellation flag - user is continuing subscription
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      // Subscription was updated in Stripe but database update failed
      // This is a partial success - log it but don't fail the request
      console.warn('Warning: Subscription updated in Stripe but database update failed:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully. Changes will take effect at the end of your current billing period.',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
      },
    });
  } catch (error) {
    console.error('Unexpected error updating subscription:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

