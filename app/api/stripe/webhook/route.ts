import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin, getAICreditsForTier } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;

        if (userId && tier) {
          if (tier === 'credit_pack') {
            // One-time credit purchase - add 50 AI credits
            const { data: profile } = await supabase
              .from('profiles')
              .select('ai_credits')
              .eq('user_id', userId)
              .single();

            if (profile) {
              await supabase
                .from('profiles')
                .update({
                  ai_credits: profile.ai_credits + 50,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              console.log(`Added 50 AI credits for user ${userId}`);
            }
          } else {
            // Subscription - update tier and credits
            await supabase
              .from('profiles')
              .update({
                tier: tier,
                credits: 999999, // Unlimited for paid tiers
                ai_credits: getAICreditsForTier(tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly'),
                stripe_subscription_id: session.subscription as string,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);

            console.log(`Subscription activated for user ${userId} with tier ${tier}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;

        // Get user from customer ID or subscription ID
        let profile = null;
        if (customerId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('stripe_customer_id', customerId)
            .single();
          profile = data;
        }
        
        // Fallback: try to find by subscription ID if customer ID lookup failed
        if (!profile && subscriptionId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('stripe_subscription_id', subscriptionId)
            .single();
          profile = data;
        }

        if (profile) {
          // Always sync cancellation status from Stripe
          const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
          
          // If subscription is active, update credits and tier info
          if (subscription.status === 'active') {
            const currentTier = profile.tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly';
            const aiCreditsForTier = getAICreditsForTier(currentTier);
            await supabase
              .from('profiles')
              .update({
                credits: 999999, // Unlimited for active subscriptions
                ai_credits: aiCreditsForTier > 0 ? aiCreditsForTier : profile.ai_credits, // Reset to tier amount for premier on renewal
                cancel_at_period_end: cancelAtPeriodEnd, // Sync cancellation status with Stripe
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', profile.user_id);
          } else {
            // Even if subscription is not active, still sync cancellation status
            await supabase
              .from('profiles')
              .update({
                cancel_at_period_end: cancelAtPeriodEnd, // Sync cancellation status with Stripe
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', profile.user_id);
          }
          
          console.log(`Subscription updated for user ${profile.user_id}, cancel_at_period_end: ${cancelAtPeriodEnd}, status: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user from customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          // Downgrade to free tier
          await supabase
            .from('profiles')
            .update({
              tier: 'free',
              credits: 0, // No credits when subscription cancelled
              ai_credits: 0, // Remove AI credits too
              stripe_subscription_id: null,
              cancel_at_period_end: false, // Clear cancellation flag since subscription has ended
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.user_id);

          console.log(`Subscription cancelled for user ${profile.user_id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

