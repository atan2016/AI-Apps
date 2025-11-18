#!/usr/bin/env node

/**
 * Script to extract Stripe Price IDs for all subscription plans
 * Run with: node scripts/get-stripe-prices.js
 */

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  
  let envFile = envPath;
  if (fs.existsSync(envLocalPath)) {
    envFile = envLocalPath;
  }
  
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

loadEnv();

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

// Expected prices based on the new pricing
const expectedPrices = {
  basic: {
    weekly: { amount: 299, interval: 'week' }, // $2.99
    monthly: { amount: 599, interval: 'month' }, // $5.99
    yearly: { amount: 1499, interval: 'year' }, // $14.99
  },
  premier: {
    weekly: { amount: 699, interval: 'week' }, // $6.99
    monthly: { amount: 1499, interval: 'month' }, // $14.99
    yearly: { amount: 7900, interval: 'year' }, // $79.00
  },
  credit_pack: {
    amount: 500, // $5.00 (one-time payment)
  },
};

async function getStripePrices() {
  try {
    console.log('🔍 Fetching prices from Stripe...\n');
    
    // Get all active prices
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    console.log('📋 Found prices:\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find Basic Plan prices (match by amount first, then check interval)
    console.log('📦 BASIC PLAN PRICES:');
    console.log('─────────────────────────────────────────────────────────');
    
    // Try exact match first, then fallback to amount-only match
    let basicWeekly = prices.data.find(
      p => p.unit_amount === expectedPrices.basic.weekly.amount &&
      p.recurring?.interval === expectedPrices.basic.weekly.interval
    );
    if (!basicWeekly) {
      basicWeekly = prices.data.find(
        p => p.unit_amount === expectedPrices.basic.weekly.amount && p.recurring
      );
    }
    
    let basicMonthly = prices.data.find(
      p => p.unit_amount === expectedPrices.basic.monthly.amount &&
      p.recurring?.interval === expectedPrices.basic.monthly.interval
    );
    if (!basicMonthly) {
      basicMonthly = prices.data.find(
        p => p.unit_amount === expectedPrices.basic.monthly.amount && p.recurring
      );
    }
    
    let basicYearly = prices.data.find(
      p => p.unit_amount === expectedPrices.basic.yearly.amount &&
      p.recurring?.interval === expectedPrices.basic.yearly.interval
    );
    if (!basicYearly) {
      basicYearly = prices.data.find(
        p => p.unit_amount === expectedPrices.basic.yearly.amount && p.recurring
      );
    }

    if (basicWeekly) {
      console.log(`✅ Weekly ($2.99):   ${basicWeekly.id}`);
    } else {
      console.log(`❌ Weekly ($2.99):   NOT FOUND`);
    }
    
    if (basicMonthly) {
      console.log(`✅ Monthly ($5.99):  ${basicMonthly.id}`);
    } else {
      console.log(`❌ Monthly ($5.99):  NOT FOUND`);
    }
    
    if (basicYearly) {
      console.log(`✅ Yearly ($14.99):  ${basicYearly.id} (interval: ${basicYearly.recurring?.interval || 'N/A'})`);
    } else {
      console.log(`❌ Yearly ($14.99):  NOT FOUND`);
    }

    console.log('\n👑 PREMIER PLAN PRICES:');
    console.log('─────────────────────────────────────────────────────────');
    
    // Try exact match first, then fallback to amount-only match
    let premierWeekly = prices.data.find(
      p => p.unit_amount === expectedPrices.premier.weekly.amount &&
      p.recurring?.interval === expectedPrices.premier.weekly.interval
    );
    if (!premierWeekly) {
      premierWeekly = prices.data.find(
        p => p.unit_amount === expectedPrices.premier.weekly.amount && p.recurring
      );
    }
    
    // For Premier Monthly, exclude the one we might have used for Basic Yearly
    let premierMonthly = prices.data.find(
      p => p.unit_amount === expectedPrices.premier.monthly.amount &&
      p.recurring?.interval === expectedPrices.premier.monthly.interval &&
      p.id !== basicYearly?.id
    );
    if (!premierMonthly) {
      premierMonthly = prices.data.find(
        p => p.unit_amount === expectedPrices.premier.monthly.amount && 
        p.recurring && 
        p.id !== basicYearly?.id
      );
    }
    
    let premierYearly = prices.data.find(
      p => p.unit_amount === expectedPrices.premier.yearly.amount &&
      p.recurring?.interval === expectedPrices.premier.yearly.interval
    );
    if (!premierYearly) {
      premierYearly = prices.data.find(
        p => p.unit_amount === expectedPrices.premier.yearly.amount && p.recurring
      );
    }

    if (premierWeekly) {
      console.log(`✅ Weekly ($6.99):   ${premierWeekly.id}`);
    } else {
      console.log(`❌ Weekly ($6.99):   NOT FOUND`);
    }
    
    if (premierMonthly) {
      console.log(`✅ Monthly ($14.99): ${premierMonthly.id}`);
    } else {
      console.log(`❌ Monthly ($14.99): NOT FOUND`);
    }
    
    if (premierYearly) {
      console.log(`✅ Yearly ($79.00):  ${premierYearly.id}`);
    } else {
      console.log(`❌ Yearly ($79.00):  NOT FOUND`);
    }

    console.log('\n💳 CREDIT PACK:');
    console.log('─────────────────────────────────────────────────────────');
    
    const creditPack = prices.data.find(
      p => p.unit_amount === expectedPrices.credit_pack.amount &&
      !p.recurring // One-time payment
    );

    if (creditPack) {
      console.log(`✅ 50 AI Credits ($5.00): ${creditPack.id}`);
    } else {
      console.log(`❌ 50 AI Credits ($5.00): NOT FOUND`);
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('📝 CODE TO COPY:\n');
    console.log('const priceIds = {');
    console.log('  // Test mode - Basic plans (client-side filters only)');
    if (basicWeekly) {
      console.log(`  weekly: '${basicWeekly.id}',`);
    } else {
      console.log(`  weekly: 'YOUR_WEEKLY_PRICE_ID',`);
    }
    if (basicMonthly) {
      console.log(`  monthly: '${basicMonthly.id}',`);
    } else {
      console.log(`  monthly: 'YOUR_MONTHLY_PRICE_ID',`);
    }
    if (basicYearly) {
      console.log(`  yearly: '${basicYearly.id}',`);
    } else {
      console.log(`  yearly: 'YOUR_YEARLY_PRICE_ID',`);
    }
    console.log('');
    console.log('  // Test mode - Premier plans (AI enhancement included)');
    if (premierWeekly) {
      console.log(`  premier_weekly: '${premierWeekly.id}',`);
    } else {
      console.log(`  premier_weekly: 'YOUR_PREMIER_WEEKLY_PRICE_ID',`);
    }
    if (premierMonthly) {
      console.log(`  premier_monthly: '${premierMonthly.id}',`);
    } else {
      console.log(`  premier_monthly: 'YOUR_PREMIER_MONTHLY_PRICE_ID',`);
    }
    if (premierYearly) {
      console.log(`  premier_yearly: '${premierYearly.id}',`);
    } else {
      console.log(`  premier_yearly: 'YOUR_PREMIER_YEARLY_PRICE_ID',`);
    }
    console.log('};');
    console.log('');
    if (creditPack) {
      console.log(`const creditPackPriceId = '${creditPack.id}';`);
    } else {
      console.log(`const creditPackPriceId = 'YOUR_CREDIT_PACK_PRICE_ID';`);
    }

    // Show all prices for debugging
    console.log('\n\n🔍 ALL ACTIVE PRICES (for reference):');
    console.log('─────────────────────────────────────────────────────────');
    prices.data.forEach(price => {
      const amount = (price.unit_amount / 100).toFixed(2);
      const interval = price.recurring ? `/${price.recurring.interval}` : ' (one-time)';
      const product = price.product;
      console.log(`  ${price.id} - $${amount}${interval} - Product: ${product}`);
    });

  } catch (error) {
    console.error('❌ Error fetching prices:', error.message);
    if (error.message.includes('No such API key')) {
      console.error('\n💡 Make sure STRIPE_SECRET_KEY is set in your .env.local file');
    }
    process.exit(1);
  }
}

getStripePrices();

