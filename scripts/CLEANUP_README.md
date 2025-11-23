# Cleanup Scripts

This directory contains scripts to clean up test data from your system. Use these scripts when you need to reset your development/test environment.

## ⚠️ WARNING

These scripts are **destructive** and **cannot be undone**. They will permanently delete:
- All Stripe test customers and subscriptions
- All user profiles from the database
- All images from the database
- All files from Supabase Storage

**Only use these scripts in TEST/DEVELOPMENT environments!**

## Scripts

### 1. `full-cleanup.js` - Complete System Cleanup (Recommended)

This is the master script that orchestrates the full cleanup process:

```bash
node scripts/full-cleanup.js
```

**What it does:**
1. Clears all Stripe test data (customers, subscriptions)
2. Deletes all users from database (profiles, images)
3. Deletes all files from Supabase Storage

**Safety Features:**
- Checks that you're using Stripe TEST mode keys (sk_test_...)
- Requires explicit confirmation before proceeding
- Provides detailed summary of what was deleted

### 2. `clear-stripe-test-data.js` - Stripe Only

Clears only Stripe test data:

```bash
node scripts/clear-stripe-test-data.js
```

**What it does:**
- Cancels all active subscriptions
- Deletes all cancelled/ended subscriptions
- Deletes all customers
- Lists payment intents (for reference - cannot be deleted)

**Safety Features:**
- Automatically detects if you're using LIVE mode keys and aborts
- Requires confirmation before proceeding

### 3. `clear-all-users.js` - Database & Storage Only

Clears all user data from database and storage:

```bash
node scripts/clear-all-users.js
```

**What it does:**
- Deletes all images from Supabase Storage (organized by user_id folders)
- Deletes all images from the `images` table
- Deletes all profiles from the `profiles` table

**Safety Features:**
- Requires confirmation before proceeding
- Provides detailed summary of deletions

## Prerequisites

1. **Environment Variables** - Make sure your `.env.local` file has:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   STRIPE_SECRET_KEY=sk_test_...  # Must be TEST mode key!
   ```

2. **Node.js** - Scripts require Node.js to run

3. **Dependencies** - Make sure you've installed npm packages:
   ```bash
   npm install
   ```

## Usage Examples

### Full Cleanup (Recommended)

```bash
# Run the complete cleanup
node scripts/full-cleanup.js

# You'll be prompted to confirm
# Type "yes" to proceed
```

### Stripe Only

```bash
# Clear only Stripe test data
node scripts/clear-stripe-test-data.js
```

### Database & Storage Only

```bash
# Clear only database and storage
node scripts/clear-all-users.js
```

## What Gets Deleted

### Stripe Test Data
- ✅ All customers (and their payment methods)
- ✅ All subscriptions (active, cancelled, ended)
- ⚠️ Payment intents (cannot be deleted, but archived automatically)
- ⚠️ Checkout sessions (expire automatically after 24 hours)

### Database
- ✅ All records from `profiles` table
- ✅ All records from `images` table

### Supabase Storage
- ✅ All files in the `image` bucket
- ✅ All user folders (organized by `user_id`)

## What Does NOT Get Deleted

- Clerk authentication users (separate system - delete manually if needed)
- Stripe webhook events (historical records, cannot be deleted)
- Database schema/tables (structure remains intact)

## Troubleshooting

### "Missing environment variables"
- Ensure `.env.local` exists in the project root
- Check that all required variables are set

### "This appears to be a LIVE mode API key!"
- The script detected a production Stripe key
- Double-check your `STRIPE_SECRET_KEY` starts with `sk_test_`
- Never use production keys with these scripts!

### "Could not delete customer/subscription"
- Some records may already be deleted
- This is usually safe to ignore
- Check the summary for actual deletion counts

### Storage deletion errors
- Some files may already be deleted
- Check Supabase Dashboard to verify
- You can manually delete remaining files via Dashboard

## After Cleanup

After running the cleanup:

1. ✅ Your database tables will be empty but intact
2. ✅ Your Supabase Storage bucket will be empty
3. ✅ Your Stripe test account will have no customers/subscriptions
4. ✅ You can start fresh with new test data

## Manual Cleanup (Alternative)

If you prefer to clean up manually:

### Stripe Dashboard
1. Go to https://dashboard.stripe.com/test
2. Delete customers one by one
3. Cancel/delete subscriptions

### Supabase Dashboard
1. Go to your Supabase project
2. Storage → `image` bucket → Delete all files/folders
3. Table Editor → `images` table → Delete all rows
4. Table Editor → `profiles` table → Delete all rows

### SQL (Supabase SQL Editor)
```sql
-- Delete all images
DELETE FROM images;

-- Delete all profiles
DELETE FROM profiles;
```

## Safety Checklist

Before running cleanup scripts:

- [ ] Confirmed you're in TEST/DEVELOPMENT environment
- [ ] Verified Stripe key starts with `sk_test_`
- [ ] Backed up any important test data (if needed)
- [ ] Not running in production environment
- [ ] All team members are aware of the cleanup

## Support

If you encounter issues:
1. Check the error messages in the console
2. Verify your environment variables
3. Check Supabase and Stripe dashboards for remaining data
4. Review the script output for detailed error messages

