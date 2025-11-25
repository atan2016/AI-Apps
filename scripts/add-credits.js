/**
 * Script to manually add AI credits to a user
 * Usage: node scripts/add-credits.js <userId> <credits>
 * Example: node scripts/add-credits.js user_abc123 5
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

async function addCredits(userId, credits) {
  try {
    console.log(`Adding ${credits} AI credits to user: ${userId}`);
    
    // Get current profile
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
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Get command line arguments
const userId = process.argv[2];
const credits = process.argv[3];

if (!userId || !credits) {
  console.error('Usage: node scripts/add-credits.js <userId> <credits>');
  console.error('Example: node scripts/add-credits.js user_abc123 5');
  process.exit(1);
}

addCredits(userId, credits);

