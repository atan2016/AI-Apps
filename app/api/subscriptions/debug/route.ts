import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// GET - Debug endpoint to see all Stripe data for the current user
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

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Get user email
    let userEmail: string | null = null;
    if (!SKIP_AUTH) {
      const user = await currentUser();
      userEmail = user?.emailAddresses?.[0]?.emailAddress || null;
    }

    interface DebugInfo {
      profile: {
        user_id: string;
        tier: string;
        credits: number;
        ai_credits: number;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
      };
      userEmail: string | null;
      customersByEmail?: Array<{
        id: string;
        email: string | null;
        created: string;
        metadata: Record<string, string>;
      }>;
      subscriptions?: Array<{
        subscriptionId: string;
        customerId: string;
        status: string;
        created: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        price: {
          id: string | undefined;
          amount: string | null;
          currency: string | undefined;
          interval: string | undefined;
          intervalCount: number | undefined;
        };
        dateError?: string;
      }>;
      subscriptionsByCustomerId?: Array<{
        subscriptionId: string;
        status: string;
        created: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        price: {
          id: string | undefined;
          amount: string | null;
          currency: string | undefined;
          interval: string | undefined;
          intervalCount: number | undefined;
        };
        dateError?: string;
      }>;
      recentPaymentIntents?: Array<{
        id: string;
        amount: string;
        currency: string;
        status: string;
        created: string;
        customer: string | Stripe.Customer | Stripe.DeletedCustomer | null;
      }>;
      checkoutSessions?: Array<{
        id: string;
        status: string | null;
        mode: string | null;
        amountTotal: string | null;
        currency: string | null;
        created: string | null;
        subscription: string | Stripe.Subscription | null;
        metadata: Record<string, string> | null;
        dateError?: string;
      }>;
      customerError?: string;
      subscriptionError?: string;
      paymentIntentError?: string;
      checkoutSessionError?: string;
    }

    const debugInfo: DebugInfo = {
      profile: {
        user_id: profile.user_id,
        tier: profile.tier,
        credits: profile.credits,
        ai_credits: profile.ai_credits,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: profile.stripe_subscription_id,
      },
      userEmail,
    };

    // Get all customers by email
    if (userEmail) {
      try {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 10,
        });
        debugInfo.customersByEmail = customers.data.map(c => ({
          id: c.id,
          email: c.email,
          created: new Date(c.created * 1000).toISOString(),
          metadata: c.metadata,
        }));

        // Get subscriptions for each customer
        for (const customer of customers.data) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 10,
          });

          debugInfo.subscriptions = debugInfo.subscriptions || [];
          for (const sub of subscriptions.data) {
            const price = sub.items.data[0]?.price;
            try {
              debugInfo.subscriptions.push({
                subscriptionId: sub.id,
                customerId: customer.id,
                status: sub.status,
                created: sub.created ? new Date(sub.created * 1000).toISOString() : null,
                currentPeriodStart: (sub as Stripe.Subscription).current_period_start ? new Date((sub as Stripe.Subscription).current_period_start * 1000).toISOString() : null,
                currentPeriodEnd: (sub as Stripe.Subscription).current_period_end ? new Date((sub as Stripe.Subscription).current_period_end * 1000).toISOString() : null,
                cancelAtPeriodEnd: (sub as Stripe.Subscription).cancel_at_period_end,
                price: {
                  id: price?.id,
                  amount: price?.unit_amount ? (price.unit_amount / 100).toFixed(2) : null,
                  currency: price?.currency,
                  interval: price?.recurring?.interval,
                  intervalCount: price?.recurring?.interval_count,
                },
              });
            } catch (dateError) {
              const subscription = sub as Stripe.Subscription;
              debugInfo.subscriptions.push({
                subscriptionId: sub.id,
                customerId: customer.id,
                status: sub.status,
                created: sub.created?.toString() || null,
                currentPeriodStart: subscription.current_period_start?.toString() || null,
                currentPeriodEnd: subscription.current_period_end?.toString() || null,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                price: {
                  id: price?.id,
                  amount: price?.unit_amount ? (price.unit_amount / 100).toFixed(2) : null,
                  currency: price?.currency,
                  interval: price?.recurring?.interval,
                  intervalCount: price?.recurring?.interval_count,
                },
                dateError: dateError instanceof Error ? dateError.message : 'Unknown date error',
              });
            }
          }
        }
      } catch (error) {
        debugInfo.customerError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Get subscriptions for customer ID if exists
    if (profile.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'all',
          limit: 10,
        });

        debugInfo.subscriptionsByCustomerId = subscriptions.data.map(sub => {
          const price = sub.items.data[0]?.price;
          const subscription = sub as Stripe.Subscription;
          try {
            return {
              subscriptionId: sub.id,
              status: sub.status,
              created: sub.created ? new Date(sub.created * 1000).toISOString() : null,
              currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
              currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              price: {
                id: price?.id,
                amount: price?.unit_amount ? (price.unit_amount / 100).toFixed(2) : null,
                currency: price?.currency,
                interval: price?.recurring?.interval,
                intervalCount: price?.recurring?.interval_count,
              },
            };
          } catch (dateError) {
            const subscription = sub as Stripe.Subscription;
            return {
              subscriptionId: sub.id,
              status: sub.status,
              created: sub.created?.toString() || null,
              currentPeriodStart: subscription.current_period_start?.toString() || null,
              currentPeriodEnd: subscription.current_period_end?.toString() || null,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              price: {
                id: price?.id,
                amount: price?.unit_amount ? (price.unit_amount / 100).toFixed(2) : null,
                currency: price?.currency,
                interval: price?.recurring?.interval,
                intervalCount: price?.recurring?.interval_count,
              },
              dateError: dateError instanceof Error ? dateError.message : 'Unknown date error',
            };
          }
        });
      } catch (error) {
        debugInfo.subscriptionError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Get payment intents (recent transactions)
    if (userEmail) {
      try {
        const paymentIntents = await stripe.paymentIntents.list({
          limit: 10,
        });

        // Filter by customer email if possible
        debugInfo.recentPaymentIntents = paymentIntents.data
          .filter(pi => {
            // Try to match by customer if we have customer IDs
            if (profile.stripe_customer_id && pi.customer === profile.stripe_customer_id) {
              return true;
            }
            return false;
          })
          .map(pi => ({
            id: pi.id,
            amount: (pi.amount / 100).toFixed(2),
            currency: pi.currency,
            status: pi.status,
            created: new Date(pi.created * 1000).toISOString(),
            customer: pi.customer,
          }));
      } catch (error) {
        debugInfo.paymentIntentError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Get checkout sessions
    if (profile.stripe_customer_id) {
      try {
        const sessions = await stripe.checkout.sessions.list({
          customer: profile.stripe_customer_id,
          limit: 10,
        });

        debugInfo.checkoutSessions = sessions.data.map(session => {
          try {
            return {
              id: session.id,
              status: session.payment_status,
              mode: session.mode,
              amountTotal: session.amount_total ? (session.amount_total / 100).toFixed(2) : null,
              currency: session.currency,
              created: session.created ? new Date(session.created * 1000).toISOString() : null,
              subscription: session.subscription,
              metadata: session.metadata,
            };
          } catch (dateError) {
            return {
              id: session.id,
              status: session.payment_status,
              mode: session.mode,
              amountTotal: session.amount_total ? (session.amount_total / 100).toFixed(2) : null,
              currency: session.currency,
              created: session.created?.toString() || null,
              subscription: session.subscription,
              metadata: session.metadata,
              dateError: dateError instanceof Error ? dateError.message : 'Unknown date error',
            };
          }
        });
      } catch (error) {
        debugInfo.checkoutSessionError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch debug info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

