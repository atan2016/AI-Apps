// lib/storage.ts
import { supabaseAdmin } from './supabase';

/**
 * Converts a data URL to a Buffer
 */
export function dataURLtoBuffer(dataURL: string): Buffer {
  const base64Data = dataURL.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}

/**
 * Uploads an image to Supabase Storage
 * @param dataURL - The base64 data URL of the image
 * @param userId - The user ID (for organizing files)
 * @param filename - The filename to use
 * @returns The public URL of the uploaded image
 */
export async function uploadImageToStorage(
  dataURL: string,
  userId: string,
  filename: string
): Promise<string> {
  const supabase = supabaseAdmin();
  
  // Convert data URL to buffer
  const buffer = dataURLtoBuffer(dataURL);
  
  // Create a path: user_id/filename
  const filePath = `${userId}/${filename}`;
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('image')
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: false, // Don't overwrite existing files
    });
  
  if (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from('image')
    .getPublicUrl(filePath);
  
  return publicUrlData.publicUrl;
}

/**
 * Deletes an image from Supabase Storage
 */
export async function deleteImageFromStorage(fileUrl: string): Promise<void> {
  const supabase = supabaseAdmin();
  
  // Extract the file path from the URL
  // URL format: https://[project].supabase.co/storage/v1/object/public/image/[path]
  const urlParts = fileUrl.split('/image/');
  if (urlParts.length < 2) {
    throw new Error('Invalid storage URL');
  }
  
  const filePath = urlParts[1];
  
  const { error } = await supabase.storage
    .from('image')
    .remove([filePath]);
  
  if (error) {
    console.error('Error deleting from Supabase Storage:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

