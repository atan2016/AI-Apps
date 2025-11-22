import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin, getAICreditsForTier, type Profile } from '@/lib/supabase';

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
      // TypeScript doesn't recognize these properties when using expand option, but they exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = subscription as any;
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
          subscriptionId: subscription.id,
          status: subscription.status,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
        });
      }

      // Map price ID to tier - Stripe is the source of truth
      const priceToTier: { [key: string]: string } = {
        // Basic plans
        'price_1SUwhiJtYXMzJCdNOBtN0Jm0': 'weekly', // $2.99/week (updated weekly price)
        'price_1SUw6nJtYXMzJCdNEo2C9Z2K': 'monthly', // $5.99/month
        'price_1SUw7jJtYXMzJCdNG6QlCFhJ': 'yearly', // $14.99/year
        // Premier plans
        'price_1SUwfWJtYXMzJCdNKfekXIXv': 'premier_weekly', // $6.99/week
        'price_1SUw74JtYXMzJCdNdo7CymJs': 'premier_monthly', // $14.99/month
        'price_1SUwZsJtYXMzJCdNuoGh5VrV': 'premier_yearly', // $79.00/year
        // Legacy price IDs (in case old subscriptions exist)
        'price_1SUw6GJtYXMzJCdNZ5NTI75B': 'weekly', // Old weekly price
        'price_1SSsLiJtYXMzJCdN3oQB39hZ': 'weekly',
        'price_1SSsMCJtYXMzJCdN1xaQfKmu': 'monthly',
        'price_1SSsNbJtYXMzJCdNcdAOA1ZK': 'yearly',
        'price_1ST7PDJtYXMzJCdNjd51XXUb': 'premier_weekly',
        'price_1ST7OPJtYXMzJCdNu32G50TH': 'premier_monthly',
        'price_1ST7NrJtYXMzJCdNB9QpyiY5': 'premier_yearly',
      };

      // Determine tier from Stripe price ID
      const stripeTier = priceToTier[priceId] || null;
      const currentTier = profile.tier;
      
      // Sync cancellation status: If Stripe says cancelled but Supabase says not cancelled, update Supabase
      // Stripe is the source of truth for cancellation status
      const stripeCancelStatus = sub.cancel_at_period_end || false;
      const supabaseCancelStatus = profile.cancel_at_period_end || false;
      
      // Determine if we need to update the profile
      const needsTierUpdate = stripeTier && stripeTier !== currentTier;
      const needsCancelStatusUpdate = stripeCancelStatus !== supabaseCancelStatus;
      
      if (needsTierUpdate || needsCancelStatusUpdate) {
        // Stripe and Supabase don't match - sync Supabase to match Stripe
        console.log(`Syncing subscription data: Stripe tier=${stripeTier}, Supabase tier=${currentTier}, Stripe cancel_at_period_end=${stripeCancelStatus}, Supabase cancel_at_period_end=${supabaseCancelStatus}`);
        
        try {
          const updateData: {
            cancel_at_period_end: boolean;
            updated_at: string;
            tier?: string;
            credits?: number;
            ai_credits?: number;
          } = {
            cancel_at_period_end: stripeCancelStatus,
            updated_at: new Date().toISOString(),
          };
          
          // Only update tier if we can determine it from Stripe
          if (needsTierUpdate && stripeTier) {
            updateData.tier = stripeTier;
            updateData.credits = 999999; // Unlimited for paid tiers
            updateData.ai_credits = getAICreditsForTier(stripeTier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly');
            console.log(`Updating tier from ${currentTier} to ${stripeTier}`);
          }
          
          await supabase
            .from('profiles')
            .update(updateData)
            .eq('user_id', profile.user_id);
          
          console.log(`Successfully synced Supabase profile for user ${profile.user_id} to match Stripe.`);
          
          // Update the profile object for response
          if (needsTierUpdate && stripeTier) {
            profile.tier = stripeTier as Profile['tier'];
            profile.credits = 999999;
            profile.ai_credits = getAICreditsForTier(stripeTier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly');
          }
          profile.cancel_at_period_end = stripeCancelStatus;
        } catch (syncError) {
          console.error('Error syncing subscription data to Supabase:', syncError);
          // Continue anyway - we'll use Stripe's value for display
        }
      }

      // Use Stripe's cancellation status as the source of truth
      const finalCancelStatus = stripeCancelStatus;

      return NextResponse.json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
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

    // Helper function to safely convert timestamp to ISO string
    // Handles Unix timestamps (seconds) or Date objects
    const toISOString = (value: number | string | Date | null | undefined): string | null => {
      if (value === null || value === undefined) {
        return null;
      }
      
      try {
        let date: Date;
        
        // If it's already a Date object
        if (value instanceof Date) {
          date = value;
        }
        // If it's a number (Unix timestamp in seconds)
        else if (typeof value === 'number') {
          if (isNaN(value) || value <= 0) {
            console.warn('Invalid timestamp:', value);
            return null;
          }
          date = new Date(value * 1000);
        }
        // If it's a string, try to parse it
        else if (typeof value === 'string') {
          date = new Date(value);
        }
        else {
          console.warn('Unexpected type for date conversion:', typeof value, value);
          return null;
        }
        
        // Validate the date
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', value);
          return null;
        }
        
        return date.toISOString();
      } catch (error) {
        console.error('Error converting to ISO string:', error, value);
        return null;
      }
    };

    // Update Supabase to track cancellation status
    const now = new Date();
    const nowISO = now.toISOString();
    
    await supabase
      .from('profiles')
      .update({
        cancel_at_period_end: true,
        updated_at: nowISO,
      })
      .eq('user_id', userId);

    // Safely get current_period_end with detailed logging
    const currentPeriodEnd = subData.current_period_end;
    console.log('Subscription response data:', {
      subscriptionId: subData.id,
      current_period_end: currentPeriodEnd,
      current_period_end_type: typeof currentPeriodEnd,
      cancel_at_period_end: subData.cancel_at_period_end,
    });
    
    const periodEndISO = toISOString(currentPeriodEnd);
    const periodEndDisplay = periodEndISO || 'end of billing period';
    
    console.log(`Subscription cancellation initiated for user ${userId}. Subscription ID: ${profile.stripe_subscription_id}, Cancel at period end: ${subData.cancel_at_period_end}, Period ends: ${periodEndDisplay}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancel_at_period_end: subData.cancel_at_period_end,
      current_period_end: periodEndISO,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

