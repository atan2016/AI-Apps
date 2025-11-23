/**
 * Migration script to convert existing subscribers to pay-per-use model
 * - Cancels all Stripe subscriptions
 * - Sets tier to 'free'
 * - Adds 100 credits to ai_credits
 * - Clears stripe_subscription_id
 */

require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-10-29.clover',
});

async function migrateSubscribers() {
  console.log('Starting subscriber migration...\n');

  try {
    // Find all users with active subscriptions
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, stripe_subscription_id, stripe_customer_id, ai_credits, tier')
      .not('stripe_subscription_id', 'is', null);

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No subscribers found to migrate.');
      return;
    }

    console.log(`Found ${profiles.length} subscribers to migrate.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      try {
        console.log(`Processing user: ${profile.user_id}`);

        // Cancel Stripe subscription if it exists
        if (profile.stripe_subscription_id) {
          try {
            const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
            
            if (subscription.status === 'active' || subscription.status === 'trialing') {
              await stripe.subscriptions.cancel(profile.stripe_subscription_id);
              console.log(`  ✓ Cancelled subscription: ${profile.stripe_subscription_id}`);
            } else {
              console.log(`  - Subscription already ${subscription.status}`);
            }
          } catch (stripeError) {
            console.log(`  - Could not cancel subscription (may already be cancelled): ${stripeError.message}`);
          }
        }

        // Update profile: set tier to 'free', add 100 credits, clear subscription_id
        const currentAiCredits = profile.ai_credits || 0;
        const newAiCredits = currentAiCredits + 100;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            tier: 'free',
            ai_credits: newAiCredits,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', profile.user_id);

        if (updateError) {
          console.error(`  ✗ Error updating profile: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`  ✓ Updated profile: tier=free, ai_credits=${newAiCredits} (added 100)`);
          successCount++;
        }
      } catch (error) {
        console.error(`  ✗ Error processing user ${profile.user_id}:`, error.message);
        errorCount++;
      }
      console.log('');
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total subscribers: ${profiles.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateSubscribers()
  .then(() => {
    console.log('\nMigration completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });

