#!/usr/bin/env node

/**
 * Quick script to check .env file SMTP_PASS length
 * Run with: node scripts/check-env.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found');
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const smtpPassLine = content.split('\n').find(line => line.trim().startsWith('SMTP_PASS='));

if (!smtpPassLine) {
  console.log('❌ SMTP_PASS not found in .env file');
  process.exit(1);
}

const password = smtpPassLine.split('=')[1]?.trim() || '';
const length = password.length;

console.log('📋 SMTP_PASS Check:');
console.log(`   Length: ${length} characters`);
console.log(`   Status: ${length === 16 ? '✅ Correct (16 characters)' : length < 16 ? '❌ Too short (should be 16)' : '❌ Too long (should be 16)'}`);
console.log(`   Preview: ${password.substring(0, 4)}...${password.substring(length - 4)}`);

if (length !== 16) {
  console.log('\n💡 Instructions:');
  console.log('   1. Go to: https://myaccount.google.com/apppasswords');
  console.log('   2. Generate or copy your App Password');
  console.log('   3. It should be exactly 16 characters (no spaces)');
  console.log('   4. Update SMTP_PASS in your .env file');
  console.log('   5. Make sure there are no spaces or quotes');
  console.log('   6. Save the file');
  console.log('\nExample format:');
  console.log('   SMTP_PASS=abcdefghijklmnop');
  console.log('   (16 characters, no spaces, no quotes)');
}

