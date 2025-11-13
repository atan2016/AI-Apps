# Supabase Storage Setup

## Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard:
   https://supabase.com/dashboard/project/ddnzufqxxlzvakzkgdwe

2. Click **"Storage"** in the left sidebar

3. Click **"Create a new bucket"**

4. Configure the bucket:
   - **Name:** `image_enhancer`
   - **Public bucket:** ✅ **YES** (check this box)
   - Click **"Create bucket"**

## Step 2: Set Storage Policies

After creating the bucket, you need to set up policies:

1. Click on the **"image_enhancer"** bucket
2. Click **"Policies"** tab
3. Click **"New Policy"**

### Policy 1: Allow Public Read

```sql
-- Allow anyone to read images (public access)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'image_enhancer');
```

### Policy 2: Allow Authenticated Users to Upload

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'image_enhancer' 
  AND auth.role() = 'authenticated'
);
```

### Policy 3: Allow Users to Delete Their Own Images

```sql
-- Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'image_enhancer' 
  AND auth.role() = 'authenticated'
);
```

## Step 3: Verify Setup

After setting up:
1. Your bucket should appear in the Storage section
2. The bucket should be marked as "Public"
3. You should see 3 policies active

## Done! ✅

Your app will now store images efficiently in Supabase Storage instead of as base64 in the database.

**Image URLs will look like:**
```
https://ddnzufqxxlzvakzkgdwe.supabase.co/storage/v1/object/public/image_enhancer/[user-id]/[filename].png
```

