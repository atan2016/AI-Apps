/**
 * Script to get user ID from Stripe payment and add credits
 * Usage: node scripts/get-user-from-stripe-payment.js <payment-intent-id>
 * Example: node scripts/get-user-from-stripe-payment.js pi_3SXE0TJtYXMzJCdN0GQE8jUA
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-10-29.clover',
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function processPayment(paymentIntentId) {
  try {
    console.log(`Fetching payment intent: ${paymentIntentId}`);
    
    // Get payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Get checkout session from payment intent
    const sessionId = paymentIntent.metadata?.sessionId || paymentIntent.metadata?.checkout_session_id;
    
    let session;
    if (sessionId) {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } else {
      // Try to find session by customer and payment intent
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      session = sessions.data[0];
    }
    
    if (!session) {
      console.error('Could not find checkout session for this payment');
      console.log('Payment Intent metadata:', paymentIntent.metadata);
      process.exit(1);
    }
    
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier;
    const paymentType = session.metadata?.paymentType;
    const credits = session.metadata?.credits || '5';
    
    console.log('\nPayment Details:');
    console.log(`  Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
    console.log(`  Status: ${paymentIntent.status}`);
    console.log(`  User ID: ${userId || 'Not found'}`);
    console.log(`  Tier: ${tier || 'Not found'}`);
    console.log(`  Credits: ${credits}`);
    
    if (!userId) {
      console.error('\n❌ User ID not found in payment metadata');
      console.log('Please manually add credits using:');
      console.log('  node scripts/add-credits.js <userId> 5');
      process.exit(1);
    }
    
    // Add credits
    console.log(`\nAdding ${credits} credits to user ${userId}...`);
    
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('ai_credits')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { getFreeCredits } = require('../lib/config');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          tier: 'free',
          credits: getFreeCredits(),
          ai_credits: parseInt(credits),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        process.exit(1);
      } else {
        console.log(`✓ Created profile and added ${credits} AI credits`);
        console.log(`  New total: ${newProfile.ai_credits}`);
      }
    } else if (profile) {
      const currentCredits = profile.ai_credits || 0;
      const newCredits = currentCredits + parseInt(credits);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ai_credits: newCredits,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating credits:', updateError);
        process.exit(1);
      } else {
        console.log(`✓ Added ${credits} AI credits`);
        console.log(`  Previous: ${currentCredits}`);
        console.log(`  New total: ${newCredits}`);
      }
    } else if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error('Invalid payment intent ID');
    }
    process.exit(1);
  }
}

const paymentIntentId = process.argv[2];

if (!paymentIntentId) {
  console.error('Usage: node scripts/get-user-from-stripe-payment.js <payment-intent-id>');
  console.error('Example: node scripts/get-user-from-stripe-payment.js pi_3SXE0TJtYXMzJCdN0GQE8jUA');
  process.exit(1);
}

processPayment(paymentIntentId);

