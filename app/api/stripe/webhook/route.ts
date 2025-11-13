import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
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
            // One-time credit purchase - add 100 AI credits
            const { data: profile } = await supabase
              .from('profiles')
              .select('ai_credits')
              .eq('user_id', userId)
              .single();

            if (profile) {
              await supabase
                .from('profiles')
                .update({
                  ai_credits: profile.ai_credits + 100,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              console.log(`Added 100 AI credits for user ${userId}`);
            }
          } else {
            // Subscription - update tier and credits
            const isPremier = tier.startsWith('premier_');
            await supabase
              .from('profiles')
              .update({
                tier: tier,
                credits: 999999, // Unlimited for paid tiers
                ai_credits: isPremier ? 100 : 0, // 100 AI credits for premier, 0 for basic
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

        // Get user from customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile && subscription.status === 'active') {
          // Reset AI credits for premier users on renewal
          const isPremier = profile.tier.startsWith('premier_');
          await supabase
            .from('profiles')
            .update({
              credits: 999999, // Unlimited for active subscriptions
              ai_credits: isPremier ? 100 : profile.ai_credits, // Reset to 100 for premier on renewal
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.user_id);
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

