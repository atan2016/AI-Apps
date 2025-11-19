import { NextResponse } from 'next/server';
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

    // Check if user is on free tier (not just if they have a Stripe subscription)
    // A user might have a paid tier but no Stripe subscription ID if webhook didn't fire yet
    const isFreeTier = profile.tier === 'free';
    
    // If no subscription and on free tier, return free tier info
    if (!profile.stripe_subscription_id && isFreeTier) {
      return NextResponse.json({
        subscription: null,
        tier: profile.tier,
        credits: profile.credits,
        ai_credits: profile.ai_credits,
        isFree: true,
      });
    }
    
    // If user has a paid tier but no Stripe subscription, they might be in a transition state
    // Still show their tier but indicate subscription might need syncing
    if (!profile.stripe_subscription_id && !isFreeTier) {
      return NextResponse.json({
        subscription: null,
        tier: profile.tier,
        credits: profile.credits,
        ai_credits: profile.ai_credits,
        isFree: false, // They have a paid tier, so not free
        error: 'Subscription ID not found. Please sync your subscription.',
      });
    }

    // Fetch subscription from Stripe
    try {
      const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(
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
      
      // Log price ID and amount for debugging
      console.log('Subscription Price Details:', {
        priceId: priceId,
        amount: amount,
        amountInDollars: (amount / 100).toFixed(2),
        currency: currency,
        interval: subscription.items.data[0]?.price.recurring?.interval,
        subscriptionId: subscription.id,
      });

      // Calculate next billing date
      // Stripe subscription object has current_period_start and current_period_end as numbers (Unix timestamps)
      // Helper function to safely convert timestamp to ISO string
      const toISOString = (timestamp: number | null | undefined): string | null => {
        if (timestamp === null || timestamp === undefined) {
          return null;
        }
        if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
          console.warn('Invalid timestamp:', timestamp);
          return null;
        }
        try {
          const date = new Date(timestamp * 1000);
          if (isNaN(date.getTime())) {
            console.warn('Invalid date from timestamp:', timestamp);
            return null;
          }
          return date.toISOString();
        } catch (error) {
          console.error('Error converting timestamp to ISO:', error, timestamp);
          return null;
        }
      };
      
      // Access properties directly from subscription object
      // These should always be present for valid subscriptions
      // Use type assertion to ensure TypeScript recognizes Stripe subscription properties
      const sub = subscription as Stripe.Subscription;
      const currentPeriodStart = sub.current_period_start 
        ? toISOString(sub.current_period_start) 
        : null;
      const currentPeriodEnd = sub.current_period_end 
        ? toISOString(sub.current_period_end) 
        : null;
      const nextBillingDate = currentPeriodEnd;
      const canceledAt = sub.canceled_at 
        ? toISOString(sub.canceled_at) 
        : null;
      const createdAt = sub.created 
        ? toISOString(sub.created) 
        : null;
      
      // Log if we're missing expected data (for debugging)
      if (!currentPeriodStart || !currentPeriodEnd) {
        console.warn('Missing subscription period data:', {
          subscriptionId: sub.id,
          status: sub.status,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
        });
      }

      // Sync cancellation status: If Supabase says not cancelled but Stripe says cancelled, update Stripe
      // This handles cases where user manually updated Supabase or upgraded after cancellation
      const stripeCancelStatus = sub.cancel_at_period_end || false;
      const supabaseCancelStatus = profile.cancel_at_period_end || false;
      
      if (stripeCancelStatus && !supabaseCancelStatus) {
        // Supabase says not cancelled but Stripe says cancelled - sync Stripe to match Supabase
        console.log(`Syncing cancellation status: Stripe has cancel_at_period_end=true but Supabase has false. Updating Stripe.`);
        try {
          await stripe.subscriptions.update(sub.id, {
            cancel_at_period_end: false,
          });
          console.log(`Successfully updated Stripe subscription ${sub.id} to clear cancellation flag.`);
        } catch (syncError) {
          console.error('Error syncing cancellation status to Stripe:', syncError);
          // Continue anyway - we'll use Supabase's value
        }
      }

      // Use Supabase's cancellation status if it differs from Stripe (Supabase is source of truth after manual updates)
      const finalCancelStatus = supabaseCancelStatus !== undefined ? supabaseCancelStatus : stripeCancelStatus;

      return NextResponse.json({
        subscription: {
          id: sub.id,
          status: sub.status,
          created: createdAt,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: finalCancelStatus,
          canceled_at: canceledAt,
        },
        plan: {
          priceId,
          productName: product?.name || 'Unknown',
          amount: amount / 100, // Convert from cents
          currency: currency.toUpperCase(),
          interval: subscription.items.data[0]?.price.recurring?.interval || 'month',
          // Include raw amount for debugging
          rawAmount: amount,
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
export async function DELETE() {
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
    const subscriptionResponse = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subData = subscriptionResponse as any;

    // Update Supabase to track cancellation status
    await supabase
      .from('profiles')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    console.log(`Subscription cancellation initiated for user ${userId}. Subscription ID: ${profile.stripe_subscription_id}, Cancel at period end: ${subData.cancel_at_period_end}, Period ends: ${new Date(subData.current_period_end * 1000).toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancel_at_period_end: subData.cancel_at_period_end,
      current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

