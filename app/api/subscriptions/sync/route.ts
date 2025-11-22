import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin, getAICreditsForTier } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// POST - Manually sync subscription status from Stripe
export async function POST() {
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

    // Get user email to search for customer if needed
    let userEmail: string | null = null;
    if (!SKIP_AUTH) {
      const user = await currentUser();
      userEmail = user?.emailAddresses?.[0]?.emailAddress || null;
    }

    // If user has a Stripe customer ID, check for subscriptions
    if (profile.stripe_customer_id) {
      console.log(`Looking for subscriptions for customer: ${profile.stripe_customer_id}`);
      
      // Get all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'all',
        limit: 10,
      });

      console.log(`Found ${subscriptions.data.length} subscriptions for customer`);

      // Find the most recent active subscription
      const activeSubscription = subscriptions.data.find(
        sub => sub.status === 'active' || sub.status === 'trialing'
      );

      if (activeSubscription) {
        console.log(`Found active subscription: ${activeSubscription.id}, status: ${activeSubscription.status}`);
        
        // Get the price to determine the tier
        const priceId = activeSubscription.items.data[0]?.price.id;
        const priceAmount = activeSubscription.items.data[0]?.price.unit_amount;
        const priceInterval = activeSubscription.items.data[0]?.price.recurring?.interval;
        
        console.log(`Price ID: ${priceId}, Amount: ${priceAmount}, Interval: ${priceInterval}`);
        
        // Map price ID to tier - matches app/page.tsx priceIds
        const priceToTier: { [key: string]: string } = {
          // Basic plans
          'price_1SUw6GJtYXMzJCdNZ5NTI75B': 'weekly', // $2.99/week
          'price_1SUw6nJtYXMzJCdNEo2C9Z2K': 'monthly', // $5.99/month
          'price_1SUw7jJtYXMzJCdNG6QlCFhJ': 'yearly', // $14.99/year
          // Premier plans
          'price_1SUwfWJtYXMzJCdNKfekXIXv': 'premier_weekly', // $6.99/week
          'price_1SUw74JtYXMzJCdNdo7CymJs': 'premier_monthly', // $14.99/month
          'price_1SUwZsJtYXMzJCdNuoGh5VrV': 'premier_yearly', // $79.00/year
          // Legacy price IDs (in case old subscriptions exist)
          'price_1SSsLiJtYXMzJCdN3oQB39hZ': 'weekly',
          'price_1SSsMCJtYXMzJCdN1xaQfKmu': 'monthly',
          'price_1SSsNbJtYXMzJCdNcdAOA1ZK': 'yearly',
          'price_1ST7PDJtYXMzJCdNjd51XXUb': 'premier_weekly', // Legacy - maps to correct tier
          'price_1ST7OPJtYXMzJCdNu32G50TH': 'premier_monthly',
          'price_1ST7NrJtYXMzJCdNB9QpyiY5': 'premier_yearly',
        };

        let tier = priceToTier[priceId];
        
        // If price ID not found, try to determine tier from amount and interval
        if (!tier && priceAmount) {
          const amount = priceAmount / 100; // Convert from cents
          console.log(`Price ID not in map, trying to determine from amount: $${amount}, interval: ${priceInterval}`);
          
          // Match by amount and interval
          if (amount === 79.00 && priceInterval === 'year') {
            tier = 'premier_yearly';
          } else if (amount === 14.99 && priceInterval === 'month') {
            // If we can't determine, default to premier_monthly for $14.99/month
            tier = 'premier_monthly';
          } else if (amount === 6.99 && priceInterval === 'week') {
            tier = 'premier_weekly';
          } else if (amount === 2.99 && priceInterval === 'week') {
            tier = 'weekly';
          } else if (amount === 5.99 && priceInterval === 'month') {
            tier = 'monthly';
          } else if (amount === 14.99 && priceInterval === 'year') {
            tier = 'yearly';
          }
        }

        if (!tier) {
          console.error(`Could not determine tier for price ID: ${priceId}, amount: ${priceAmount}, interval: ${priceInterval}`);
          return NextResponse.json({
            success: false,
            message: `Could not determine tier. Price ID: ${priceId}, Amount: $${(priceAmount || 0) / 100}, Interval: ${priceInterval || 'N/A'}`,
            debug: {
              priceId,
              priceAmount,
              priceInterval,
              subscriptionId: activeSubscription.id,
            },
          });
        }

        const isPremier = tier.startsWith('premier_');
        console.log(`Determined tier: ${tier}, isPremier: ${isPremier}`);

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            tier: tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly',
            credits: 999999,
            ai_credits: getAICreditsForTier(tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly'),
            stripe_subscription_id: activeSubscription.id,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          return NextResponse.json({
            success: false,
            message: `Failed to update profile: ${updateError.message}`,
          }, { status: 500 });
        }

        console.log(`Successfully updated profile for user ${userId} to tier ${tier}`);

        return NextResponse.json({
          success: true,
          message: 'Subscription synced successfully',
          tier,
          subscriptionId: activeSubscription.id,
          priceId,
        });
      } else {
        console.log('No active subscription found');
        // List all subscriptions for debugging
        subscriptions.data.forEach(sub => {
          console.log(`  - Subscription ${sub.id}: status=${sub.status}, price=${sub.items.data[0]?.price.id}`);
        });
      }
    } else {
      // No customer ID - try to find customer by email
      console.log('No Stripe customer ID found, searching by email');
      if (userEmail) {
        try {
          const customers = await stripe.customers.list({
            email: userEmail,
            limit: 10,
          });

          console.log(`Found ${customers.data.length} customers with email ${userEmail}`);

          // Check each customer for active subscriptions
          for (const customer of customers.data) {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'all',
              limit: 10,
            });

            const activeSubscription = subscriptions.data.find(
              sub => sub.status === 'active' || sub.status === 'trialing'
            );

            if (activeSubscription) {
              console.log(`Found active subscription for customer ${customer.id}`);
              
              // Update profile with customer ID first
              await supabase
                .from('profiles')
                .update({ stripe_customer_id: customer.id })
                .eq('user_id', userId);

              // Get the price to determine the tier
              const priceId = activeSubscription.items.data[0]?.price.id;
              const priceAmount = activeSubscription.items.data[0]?.price.unit_amount;
              const priceInterval = activeSubscription.items.data[0]?.price.recurring?.interval;
              
              console.log(`Price ID: ${priceId}, Amount: ${priceAmount}, Interval: ${priceInterval}`);
              
              // Map price ID to tier
              const priceToTier: { [key: string]: string } = {
                'price_1SUw6GJtYXMzJCdNZ5NTI75B': 'weekly',
                'price_1SUw6nJtYXMzJCdNEo2C9Z2K': 'monthly',
                'price_1SUw7jJtYXMzJCdNG6QlCFhJ': 'yearly',
                'price_1SUwfWJtYXMzJCdNKfekXIXv': 'premier_weekly',
                'price_1SUw74JtYXMzJCdNdo7CymJs': 'premier_monthly',
                'price_1SUwZsJtYXMzJCdNuoGh5VrV': 'premier_yearly',
                'price_1SSsLiJtYXMzJCdN3oQB39hZ': 'weekly',
                'price_1SSsMCJtYXMzJCdN1xaQfKmu': 'monthly',
                'price_1SSsNbJtYXMzJCdNcdAOA1ZK': 'yearly',
                'price_1ST7PDJtYXMzJCdNjd51XXUb': 'premier_weekly', // Legacy - maps to correct tier
                'price_1ST7OPJtYXMzJCdNu32G50TH': 'premier_monthly',
                'price_1ST7NrJtYXMzJCdNB9QpyiY5': 'premier_yearly',
              };

              let tier = priceToTier[priceId];
              
              // Fallback to amount/interval matching
              if (!tier && priceAmount) {
                const amount = priceAmount / 100;
                if (amount === 79.00 && priceInterval === 'year') {
                  tier = 'premier_yearly';
                } else if (amount === 14.99 && priceInterval === 'month') {
                  tier = 'premier_monthly';
                } else if (amount === 6.99 && priceInterval === 'week') {
                  tier = 'premier_weekly';
                } else if (amount === 2.99 && priceInterval === 'week') {
                  tier = 'weekly';
                } else if (amount === 5.99 && priceInterval === 'month') {
                  tier = 'monthly';
                } else if (amount === 14.99 && priceInterval === 'year') {
                  tier = 'yearly';
                }
              }

              if (tier) {
                const isPremier = tier.startsWith('premier_');
                await supabase
                  .from('profiles')
                  .update({
                    tier: tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly',
                    credits: 999999,
                    ai_credits: getAICreditsForTier(tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly'),
                    stripe_subscription_id: activeSubscription.id,
                    stripe_customer_id: customer.id,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', userId);

                return NextResponse.json({
                  success: true,
                  message: 'Subscription synced successfully',
                  tier,
                  subscriptionId: activeSubscription.id,
                  priceId,
                });
              }
            }
          }
        } catch (error) {
          console.error('Error searching for customer by email:', error);
        }
      }
    }

    // If no active subscription found, check if there's a subscription ID but it's not in Stripe
    if (profile.stripe_subscription_id) {
      try {
        console.log(`Retrieving subscription by ID: ${profile.stripe_subscription_id}`);
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        console.log(`Subscription status: ${subscription.status}, price ID: ${subscription.items.data[0]?.price.id}`);
        
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Subscription exists and is active, update the profile
          const priceId = subscription.items.data[0]?.price.id;
          const priceAmount = subscription.items.data[0]?.price.unit_amount;
          const priceInterval = subscription.items.data[0]?.price.recurring?.interval;
          
          console.log(`Price ID: ${priceId}, Amount: ${priceAmount}, Interval: ${priceInterval}`);
          
          const priceToTier: { [key: string]: string } = {
            // Basic plans
            'price_1SUw6GJtYXMzJCdNZ5NTI75B': 'weekly', // $2.99/week
            'price_1SUw6nJtYXMzJCdNEo2C9Z2K': 'monthly', // $5.99/month
            'price_1SUw7jJtYXMzJCdNG6QlCFhJ': 'yearly', // $14.99/year
            // Premier plans
            'price_1SUwfWJtYXMzJCdNKfekXIXv': 'premier_weekly', // $6.99/week
            'price_1SUw74JtYXMzJCdNdo7CymJs': 'premier_monthly', // $14.99/month
            'price_1SUwZsJtYXMzJCdNuoGh5VrV': 'premier_yearly', // $79.00/year
            // Legacy price IDs
            'price_1SSsLiJtYXMzJCdN3oQB39hZ': 'weekly',
            'price_1SSsMCJtYXMzJCdN1xaQfKmu': 'monthly',
            'price_1SSsNbJtYXMzJCdNcdAOA1ZK': 'yearly',
            'price_1ST7PDJtYXMzJCdNjd51XXUb': 'premier_weekly', // Legacy - maps to correct tier
            'price_1ST7OPJtYXMzJCdNu32G50TH': 'premier_monthly',
            'price_1ST7NrJtYXMzJCdNB9QpyiY5': 'premier_yearly',
          };

          let tier = priceToTier[priceId];
          
          // Fallback: determine tier from amount and interval
          if (!tier && priceAmount) {
            const amount = priceAmount / 100;
            console.log(`Price ID not in map, determining from amount: $${amount}, interval: ${priceInterval}`);
            if (amount === 79.00 && priceInterval === 'year') {
              tier = 'premier_yearly';
            } else if (amount === 14.99 && priceInterval === 'month') {
              tier = 'premier_monthly';
            } else if (amount === 6.99 && priceInterval === 'week') {
              tier = 'premier_weekly';
            } else if (amount === 2.99 && priceInterval === 'week') {
              tier = 'weekly';
            } else if (amount === 5.99 && priceInterval === 'month') {
              tier = 'monthly';
            } else if (amount === 14.99 && priceInterval === 'year') {
              tier = 'yearly';
            }
          }

          if (!tier) {
            tier = profile.tier; // Keep existing tier if we can't determine
            console.warn(`Could not determine tier for price ID ${priceId}, keeping existing tier: ${tier}`);
          }

          console.log(`Updating profile to tier: ${tier}`);

          await supabase
            .from('profiles')
            .update({
              tier: tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly',
              credits: 999999,
              ai_credits: getAICreditsForTier(tier as 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly'),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          return NextResponse.json({
            success: true,
            message: 'Subscription synced successfully',
            tier,
            subscriptionId: subscription.id,
            priceId,
            priceAmount: priceAmount ? (priceAmount / 100).toFixed(2) : null,
            priceInterval,
          });
        } else {
          console.log(`Subscription ${profile.stripe_subscription_id} is not active (status: ${subscription.status})`);
        }
      } catch (error) {
        console.error('Error retrieving subscription:', error);
        // Return error details for debugging
        return NextResponse.json({
          success: false,
          message: `Error retrieving subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
          subscriptionId: profile.stripe_subscription_id,
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'No active subscription found in Stripe',
    });
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}

