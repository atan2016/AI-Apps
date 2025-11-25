-- SQL Queries to Remove Test User
-- Run these in Supabase SQL Editor

-- Step 1: Find the user by tier (premier_yearly) - most recent first
-- This helps identify the test user
SELECT 
  user_id,
  tier,
  credits,
  ai_credits,
  stripe_customer_id,
  stripe_subscription_id,
  created_at,
  updated_at
FROM profiles 
WHERE tier = 'premier_yearly'
ORDER BY updated_at DESC
LIMIT 10;

-- Step 2: Preview images that will be deleted
-- Replace '<user_id>' with the actual user_id from Step 1
SELECT 
  id,
  user_id,
  original_url,
  enhanced_url,
  prompt,
  created_at
FROM images
WHERE user_id = '<user_id>';

-- Step 3: Count images before deletion
SELECT COUNT(*) as image_count
FROM images
WHERE user_id = '<user_id>';

-- Step 4: Delete user images from database
-- Replace '<user_id>' with the actual user_id
DELETE FROM images 
WHERE user_id = '<user_id>';

-- Step 5: Verify images are deleted
SELECT COUNT(*) as remaining_images
FROM images
WHERE user_id = '<user_id>';

-- Step 6: Delete user profile
-- Replace '<user_id>' with the actual user_id
DELETE FROM profiles 
WHERE user_id = '<user_id>';

-- Step 7: Verify profile is deleted
SELECT COUNT(*) as remaining_profiles
FROM profiles
WHERE user_id = '<user_id>';



