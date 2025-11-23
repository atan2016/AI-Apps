#!/usr/bin/env node

/**
 * Script to delete ALL users and their data from the system
 * - Deletes all images from Supabase Storage
 * - Deletes all images from database
 * - Deletes all profiles from database
 * 
 * WARNING: This is a destructive operation and cannot be undone!
 */

// Try .env.local first, then fall back to .env
require('dotenv').config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require('dotenv').config({ path: '.env' });
}
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

async function getAllUserIds() {
  console.log('📋 Fetching all user IDs...');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id');

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    throw error;
  }

  return profiles?.map(p => p.user_id) || [];
}

async function deleteAllImagesFromStorage() {
  console.log('\n📦 Deleting all images from Supabase Storage...');
  
  try {
    // List all files in the storage bucket
    const { data: files, error: listError } = await supabase.storage
      .from('image')
      .list('', {
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

    console.log(`   Found ${files.length} files/folders to delete`);

    // Delete all files and folders
    // Note: We need to delete files recursively by user folder
    let totalDeleted = 0;
    let totalErrors = 0;

    // Get all user folders
    const userFolders = files.filter(f => f.id === null); // Folders have null id
    
    if (userFolders.length > 0) {
      console.log(`   Found ${userFolders.length} user folders`);
      
      for (const folder of userFolders) {
        try {
          // List files in this folder
          const { data: folderFiles, error: folderListError } = await supabase.storage
            .from('image')
            .list(folder.name, {
              limit: 1000
            });

          if (folderListError) {
            console.warn(`   ⚠️  Could not list files in ${folder.name}: ${folderListError.message}`);
            totalErrors++;
            continue;
          }

          if (folderFiles && folderFiles.length > 0) {
            const filePaths = folderFiles.map(file => `${folder.name}/${file.name}`);
            const { error: deleteError } = await supabase.storage
              .from('image')
              .remove(filePaths);

            if (deleteError) {
              console.warn(`   ⚠️  Error deleting files in ${folder.name}: ${deleteError.message}`);
              totalErrors += folderFiles.length;
            } else {
              console.log(`   ✓ Deleted ${folderFiles.length} files from ${folder.name}/`);
              totalDeleted += folderFiles.length;
            }
          }
        } catch (error) {
          console.warn(`   ⚠️  Error processing folder ${folder.name}: ${error.message}`);
          totalErrors++;
        }
      }
    }

    // Also handle any files in root (if any)
    const rootFiles = files.filter(f => f.id !== null);
    if (rootFiles.length > 0) {
      const rootFilePaths = rootFiles.map(f => f.name);
      const { error: deleteError } = await supabase.storage
        .from('image')
        .remove(rootFilePaths);

      if (deleteError) {
        console.warn(`   ⚠️  Error deleting root files: ${deleteError.message}`);
        totalErrors += rootFiles.length;
      } else {
        console.log(`   ✓ Deleted ${rootFiles.length} files from root`);
        totalDeleted += rootFiles.length;
      }
    }

    console.log(`   ✅ Deleted ${totalDeleted} files from storage`);
    return { deleted: totalDeleted, errors: totalErrors };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { deleted: 0, errors: 1 };
  }
}

async function deleteAllImagesFromDatabase() {
  console.log('\n🗄️  Deleting all images from database...');
  
  try {
    // First, get count
    const { count } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true });

    console.log(`   Found ${count || 0} images in database`);

    if (count === 0) {
      console.log('   ✅ No images to delete');
      return { deleted: 0, errors: 0 };
    }

    // Delete all images
    const { error } = await supabase
      .from('images')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that's always true)

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

async function deleteAllProfiles() {
  console.log('\n👤 Deleting all profiles from database...');
  
  try {
    // First, get count
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    console.log(`   Found ${count || 0} profiles in database`);

    if (count === 0) {
      console.log('   ✅ No profiles to delete');
      return { deleted: 0, errors: 0 };
    }

    // Delete all profiles
    const { error } = await supabase
      .from('profiles')
      .delete()
      .neq('user_id', ''); // Delete all (using a condition that's always true)

    if (error) {
      console.error(`   ❌ Error deleting profiles: ${error.message}`);
      return { deleted: 0, errors: count };
    }

    console.log(`   ✅ Deleted ${count} profiles from database`);
    return { deleted: count, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { deleted: 0, errors: 1 };
  }
}

async function clearAllUsers(skipConfirm = false) {
  if (!skipConfirm) {
    console.log('🗑️  Full User Data Cleanup');
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  WARNING: This will permanently delete ALL user data!');
    console.log('   - All images from Supabase Storage');
    console.log('   - All images from database');
    console.log('   - All profiles from database');
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
      console.log('\n❌ Deletion cancelled');
      return null;
    }
  }

  console.log('\n🚀 Starting cleanup process...\n');

  const results = {
    storage: { deleted: 0, errors: 0 },
    images: { deleted: 0, errors: 0 },
    profiles: { deleted: 0, errors: 0 }
  };

  // Step 1: Delete images from storage
  results.storage = await deleteAllImagesFromStorage();

  // Step 2: Delete images from database
  results.images = await deleteAllImagesFromDatabase();

  // Step 3: Delete profiles
  results.profiles = await deleteAllProfiles();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 Cleanup Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Storage files: ${results.storage.deleted} deleted, ${results.storage.errors} errors`);
  console.log(`Database images: ${results.images.deleted} deleted, ${results.images.errors} errors`);
  console.log(`Profiles: ${results.profiles.deleted} deleted, ${results.profiles.errors} errors`);
  console.log('═══════════════════════════════════════════════════════');

  const totalErrors = results.storage.errors + results.images.errors + results.profiles.errors;
  if (totalErrors === 0) {
    console.log('\n✅ User data cleanup completed successfully!');
  } else {
    console.log(`\n⚠️  Cleanup completed with ${totalErrors} error(s)`);
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  clearAllUsers()
    .then((results) => {
      if (results === null) {
        process.exit(0); // User cancelled
      } else {
        const totalErrors = results.storage.errors + results.images.errors + results.profiles.errors;
        process.exit(totalErrors > 0 ? 1 : 0);
      }
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { clearAllUsers, deleteAllImagesFromStorage, deleteAllImagesFromDatabase, deleteAllProfiles };

