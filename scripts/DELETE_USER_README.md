# Delete User Script

This directory contains tools to completely remove a test user and all their data from the system.

## Files

- `delete-user.sql` - SQL queries for manual deletion via Supabase SQL Editor
- `delete-user.js` - Automated Node.js script for complete deletion (database + storage)

## Option A: Manual SQL Queries (Recommended for One-Time Use)

1. Open Supabase SQL Editor
2. Run the queries in `delete-user.sql` in order:
   - Step 1: Find the user_id by querying premier_yearly users
   - Step 2-3: Preview and count images
   - Step 4: Delete images from database
   - Step 5: Verify deletion
   - Step 6: Delete profile
   - Step 7: Verify profile deletion
3. Manually delete storage files via Supabase Dashboard:
   - Go to Storage → `image` bucket
   - Find folder matching the user_id
   - Delete the entire folder

## Option B: Automated Script (Complete Cleanup)

The Node.js script handles everything automatically:

### Prerequisites

- Node.js installed
- Environment variables set (`.env.local` or `.env`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Usage

1. **Find the user_id:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT user_id, tier, created_at 
   FROM profiles 
   WHERE tier = 'premier_yearly' 
   ORDER BY updated_at DESC;
   ```

2. **Run the script:**
   ```bash
   node scripts/delete-user.js <user_id>
   ```

   Example:
   ```bash
   node scripts/delete-user.js user_2abc123xyz
   ```

3. **Confirm deletion** when prompted

### What the Script Does

1. ✅ Deletes all image files from Supabase Storage (`image` bucket)
2. ✅ Deletes all image records from `images` table
3. ✅ Deletes user profile from `profiles` table
4. ✅ Provides summary of deletion results

### Safety Features

- Requires explicit confirmation before deletion
- Shows preview of what will be deleted
- Provides detailed error messages
- Shows summary of deletion results

## Important Notes

⚠️ **WARNING**: This is a destructive operation that cannot be undone!

- All user data will be permanently deleted
- Images in storage will be removed
- Database records will be deleted
- User will need to sign up again to use the service

## Troubleshooting

### Script fails with "Missing environment variables"
- Ensure `.env.local` or `.env` file exists
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### Storage deletion fails
- Check that the storage bucket name is `image`
- Verify the user_id folder exists in storage
- Some files may already be deleted (this is OK)

### Profile not found
- User may have already been deleted
- Check the user_id is correct
- Verify in Supabase Dashboard

