#!/usr/bin/env node

/**
 * Script to clear all Stripe test data
 * - Cancels all subscriptions
 * - Deletes all customers
 * - Provides summary of cleanup
 * 
 * WARNING: This permanently deletes all test data in Stripe!
 * Make sure you are using TEST mode API keys (sk_test_...)
 */

// Try .env.local first, then fall back to .env
require('dotenv').config({ path: '.env.local' });
if (!process.env.STRIPE_SECRET_KEY) {
  require('dotenv').config({ path: '.env' });
}
const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ Missing STRIPE_SECRET_KEY environment variable');
  process.exit(1);
}

// Safety check: ensure we're in test mode
if (!stripeSecretKey.startsWith('sk_test_')) {
  console.error('❌ ERROR: This appears to be a LIVE mode API key!');
  console.error('   Test mode keys start with "sk_test_"');
  console.error('   Aborting to prevent accidental deletion of production data.');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-10-29.clover',
});

async function clearStripeTestData() {
  console.log('🗑️  Clearing Stripe Test Data');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Cancel all active subscriptions
    console.log('📋 Step 1: Cancelling all subscriptions...');
    let hasMore = true;
    let subscriptionCount = 0;
    let cancelledCount = 0;
    let deletedCount = 0;
    
    while (hasMore) {
      const subscriptions = await stripe.subscriptions.list({
        limit: 100,
        status: 'all', // Get all statuses
      });

      for (const subscription of subscriptions.data) {
        try {
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await stripe.subscriptions.cancel(subscription.id);
            console.log(`  ✓ Cancelled subscription: ${subscription.id}`);
            cancelledCount++;
          } else {
            // Delete already cancelled/ended subscriptions
            await stripe.subscriptions.delete(subscription.id);
            console.log(`  ✓ Deleted subscription: ${subscription.id} (status: ${subscription.status})`);
            deletedCount++;
          }
          subscriptionCount++;
        } catch (error) {
          console.log(`  ⚠️  Could not process subscription ${subscription.id}: ${error.message}`);
        }
      }

      hasMore = subscriptions.has_more;
    }

    console.log(`\n  Total subscriptions processed: ${subscriptionCount}`);
    console.log(`  Cancelled: ${cancelledCount}, Deleted: ${deletedCount}\n`);

    // Step 2: Delete all customers
    console.log('👥 Step 2: Deleting all customers...');
    hasMore = true;
    let customerCount = 0;

    while (hasMore) {
      const customers = await stripe.customers.list({
        limit: 100,
      });

      for (const customer of customers.data) {
        try {
          await stripe.customers.del(customer.id);
          console.log(`  ✓ Deleted customer: ${customer.id}${customer.email ? ` (${customer.email})` : ''}`);
          customerCount++;
        } catch (error) {
          console.log(`  ⚠️  Could not delete customer ${customer.id}: ${error.message}`);
        }
      }

      hasMore = customers.has_more;
    }

    console.log(`\n  Total customers deleted: ${customerCount}\n`);

    // Step 3: List payment intents (for reference - cannot be deleted)
    console.log('💳 Step 3: Checking payment intents...');
    hasMore = true;
    let paymentIntentCount = 0;

    while (hasMore) {
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 100,
      });

      paymentIntentCount += paymentIntents.data.length;
      hasMore = paymentIntents.has_more;
    }

    console.log(`  Found ${paymentIntentCount} payment intents (cannot be deleted, but archived automatically)\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Stripe Cleanup Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Subscriptions: ${subscriptionCount} processed (${cancelledCount} cancelled, ${deletedCount} deleted)`);
    console.log(`Customers: ${customerCount} deleted`);
    console.log(`Payment Intents: ${paymentIntentCount} found (archived automatically)`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n✅ Stripe test data cleanup completed!');

    return {
      subscriptions: subscriptionCount,
      customers: customerCount,
      paymentIntents: paymentIntentCount
    };

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  // Confirm before running
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('⚠️  WARNING: This will delete ALL test data in Stripe!');
  console.log('   Make sure you are in TEST mode, not LIVE mode!\n');

  readline.question('Are you sure you want to proceed? (yes/no): ', (answer) => {
    readline.close();
    
    if (answer.toLowerCase() === 'yes') {
      clearStripeTestData()
        .then(() => {
          console.log('\n✅ Cleanup completed successfully!');
          process.exit(0);
        })
        .catch((error) => {
          console.error('\n❌ Cleanup failed:', error);
          process.exit(1);
        });
    } else {
      console.log('\n❌ Cleanup cancelled');
      process.exit(0);
    }
  });
}

module.exports = { clearStripeTestData };

