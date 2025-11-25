/**
 * Script to find user ID by email address
 * Usage: node scripts/find-user-by-email.js <email>
 * Example: node scripts/find-user-by-email.js ashleyt@gmail.com
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findUserByEmail(email) {
  try {
    console.log(`Searching for user with email: ${email}`);
    
    // Note: This assumes email is stored in profiles table
    // If email is only in Clerk, you'll need to check Clerk dashboard
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, ai_credits, tier, created_at')
      .ilike('email', `%${email}%`);

    if (error) {
      console.error('Error searching profiles:', error);
      console.log('\nNote: Email might not be stored in profiles table.');
      console.log('Please check your Clerk dashboard for the user ID.');
      process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
      console.log('No user found with that email in profiles table.');
      console.log('\nTo find your user ID:');
      console.log('1. Check your Clerk dashboard');
      console.log('2. Or check your browser console after logging in');
      console.log('3. Or use: window.Clerk?.user?.id in browser console');
      process.exit(1);
    }

    console.log(`\nFound ${profiles.length} user(s):\n`);
    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. User ID: ${profile.user_id}`);
      console.log(`   AI Credits: ${profile.ai_credits || 0}`);
      console.log(`   Tier: ${profile.tier || 'N/A'}`);
      console.log(`   Created: ${profile.created_at || 'N/A'}\n`);
    });

    if (profiles.length === 1) {
      console.log(`To add credits, run:`);
      console.log(`  node scripts/add-credits.js ${profiles[0].user_id} 5`);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/find-user-by-email.js <email>');
  console.error('Example: node scripts/find-user-by-email.js ashleyt@gmail.com');
  process.exit(1);
}

findUserByEmail(email);

