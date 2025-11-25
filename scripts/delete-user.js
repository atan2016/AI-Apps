#!/usr/bin/env node

/**
 * Script to delete a test user and all their data
 * Usage: node scripts/delete-user.js <user_id>
 * 
 * This script will:
 * 1. Delete all images from the database
 * 2. Delete all image files from Supabase Storage
 * 3. Delete the user profile
 * 
 * WARNING: This is a destructive operation and cannot be undone!
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: User ID is required');
  console.error('   Usage: node scripts/delete-user.js <user_id>');
  console.error('');
  console.error('   To find user_id, run this SQL in Supabase:');
  console.error('   SELECT user_id, tier, created_at FROM profiles WHERE tier = \'premier_yearly\' ORDER BY updated_at DESC;');
  process.exit(1);
}

async function deleteUserImagesFromStorage(userId) {
  console.log(`\n📦 Deleting images from Supabase Storage for user: ${userId}`);
  
  try {
    // List all files in the user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('image')
      .list(userId, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.warn(`⚠️  Warning: Could not list files: ${listError.message}`);
      return { deleted: 0, errors: 1 };
    }

    if (!files || files.length === 0) {
      console.log('   ✅ No files found in storage');
      return { deleted: 0, errors: 0 };
    }

    console.log(`   Found ${files.length} files to delete`);

    // Delete all files
    const filePaths = files.map(file => `${userId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from('image')
      .remove(filePaths);

    if (deleteError) {
      console.error(`   ❌ Error deleting files: ${deleteError.message}`);
      return { deleted: 0, errors: files.length };
    }

    console.log(`   ✅ Deleted ${files.length} files from storage`);
    return { deleted: files.length, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { deleted: 0, errors: 1 };
  }
}

async function deleteUserImagesFromDatabase(userId) {
  console.log(`\n🗄️  Deleting images from database for user: ${userId}`);
  
  try {
    // First, get count
    const { count } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    console.log(`   Found ${count || 0} images in database`);

    if (count === 0) {
      console.log('   ✅ No images to delete');
      return { deleted: 0, errors: 0 };
    }

    // Delete images
    const { error } = await supabase
      .from('images')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error(`   ❌ Error deleting images: ${error.message}`);
      return { deleted: 0, errors: count };
    }

    console.log(`   ✅ Deleted ${count} images from database`);
    return { deleted: count, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { deleted: 0, errors: 1 };
  }
}

async function deleteUserProfile(userId) {
  console.log(`\n👤 Deleting user profile for: ${userId}`);
  
  try {
    // First, check if profile exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !profile) {
      console.log('   ⚠️  Profile not found (may already be deleted)');
      return { deleted: 0, errors: 0 };
    }

    console.log(`   Profile found: tier=${profile.tier}, credits=${profile.credits}, ai_credits=${profile.ai_credits}`);

    // Delete profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error(`   ❌ Error deleting profile: ${error.message}`);
      return { deleted: 0, errors: 1 };
    }

    console.log(`   ✅ Deleted user profile`);
    return { deleted: 1, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { deleted: 0, errors: 1 };
  }
}

async function main() {
  console.log('🗑️  User Deletion Script');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`User ID: ${userId}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('⚠️  WARNING: This will permanently delete all user data!');
  console.log('');

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
    console.log('\n❌ Deletion cancelled');
    process.exit(0);
  }

  console.log('\n🚀 Starting deletion process...\n');

  const results = {
    storage: { deleted: 0, errors: 0 },
    images: { deleted: 0, errors: 0 },
    profile: { deleted: 0, errors: 0 }
  };

  // Step 1: Delete images from storage
  results.storage = await deleteUserImagesFromStorage(userId);

  // Step 2: Delete images from database
  results.images = await deleteUserImagesFromDatabase(userId);

  // Step 3: Delete profile
  results.profile = await deleteUserProfile(userId);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 Deletion Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Storage files: ${results.storage.deleted} deleted, ${results.storage.errors} errors`);
  console.log(`Database images: ${results.images.deleted} deleted, ${results.images.errors} errors`);
  console.log(`Profile: ${results.profile.deleted} deleted, ${results.profile.errors} errors`);
  console.log('═══════════════════════════════════════════════════════');

  const totalErrors = results.storage.errors + results.images.errors + results.profile.errors;
  if (totalErrors === 0) {
    console.log('\n✅ User deletion completed successfully!');
  } else {
    console.log(`\n⚠️  Deletion completed with ${totalErrors} error(s)`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});



