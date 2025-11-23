#!/usr/bin/env node

/**
 * Master cleanup script that orchestrates the full cleanup process
 * - Clears Stripe test data (customers, subscriptions)
 * - Deletes all users from database and storage
 * 
 * WARNING: This is a destructive operation and cannot be undone!
 * Make sure you are in TEST mode for Stripe!
 */

// Try .env.local first, then fall back to .env
require('dotenv').config({ path: '.env.local' });
if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

const { clearStripeTestData } = require('./clear-stripe-test-data');
const { clearAllUsers } = require('./clear-all-users');

async function fullCleanup() {
  console.log('🧹 FULL SYSTEM CLEANUP');
  console.log('═══════════════════════════════════════════════════════');
  console.log('This will:');
  console.log('  1. Clear all Stripe test data (customers, subscriptions)');
  console.log('  2. Delete all users from database (profiles, images)');
  console.log('  3. Delete all files from Supabase Storage');
  console.log('═══════════════════════════════════════════════════════\n');

  // Confirm deletion
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    readline.question('Are you sure you want to proceed? (yes/no): ', resolve);
  });

  readline.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Cleanup cancelled');
    process.exit(0);
  }

  console.log('\n🚀 Starting full cleanup...\n');

  try {
    // Step 1: Clear Stripe test data
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 1: Clearing Stripe Test Data');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const stripeResults = await clearStripeTestData();
    
    console.log('\n');

    // Step 2: Clear all users from database and storage
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 2: Clearing Database and Storage');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Run the clear-all-users function (skip confirmation since we already confirmed)
    const userResults = await clearAllUsers(true);
    
    if (userResults === null) {
      console.log('⚠️  User cleanup was cancelled');
      return;
    }

    // Final summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ FULL CLEANUP COMPLETED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('All test data has been cleared:');
    console.log('  ✓ Stripe customers and subscriptions deleted');
    console.log('  ✓ Database profiles and images deleted');
    console.log('  ✓ Supabase Storage files deleted');
    console.log('\nYour system is now clean and ready for fresh test data!');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fullCleanup()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fullCleanup };

