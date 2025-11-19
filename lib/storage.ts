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
 * Downloads an image from a URL and converts it to a data URL
 * @param imageUrl - The URL of the image to download
 * @returns A data URL string (base64 encoded image)
 */
export async function downloadImageAsDataURL(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error downloading image:', error);
    throw new Error(`Failed to download image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  
  // Check buffer size (Supabase Storage typically has a 50MB limit, but some buckets may have lower limits)
  const bufferSizeMB = buffer.length / (1024 * 1024);
  const MAX_UPLOAD_SIZE_MB = 50; // Supabase default limit
  
  if (bufferSizeMB > MAX_UPLOAD_SIZE_MB) {
    throw new Error(`Image is too large (${bufferSizeMB.toFixed(2)}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB. Please compress or resize your image.`);
  }
  
  console.log(`Uploading image: ${bufferSizeMB.toFixed(2)}MB (${buffer.length} bytes)`);
  
  // Create a path: user_id/filename
  const filePath = `${userId}/${filename}`;
  
  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from('image')
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: false, // Don't overwrite existing files
    });
  
  if (error) {
    console.error('Error uploading to Supabase Storage:', error);
    console.error('Buffer size:', buffer.length, 'bytes (', bufferSizeMB.toFixed(2), 'MB)');
    
    // Provide more helpful error messages
    if (error.message.includes('maximum allowed size') || error.message.includes('exceeded')) {
      throw new Error(`Image is too large (${bufferSizeMB.toFixed(2)}MB). Please compress or resize your image before uploading. The Supabase Storage bucket may have a size limit configured.`);
    }
    
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
  // Skip deletion if URL is from Replicate (old expired URLs)
  if (fileUrl.includes('replicate.delivery')) {
    console.log('Skipping deletion of Replicate URL (already expired):', fileUrl);
    return;
  }

  const supabase = supabaseAdmin();
  
  // Extract the file path from the URL
  // URL format: https://[project].supabase.co/storage/v1/object/public/image/[path]
  const urlParts = fileUrl.split('/image/');
  if (urlParts.length < 2) {
    console.warn('Invalid storage URL format, skipping deletion:', fileUrl);
    return;
  }
  
  const filePath = urlParts[1];
  
  const { error } = await supabase.storage
    .from('image')
    .remove([filePath]);
  
  if (error) {
    // Don't throw - some files might already be deleted
    console.warn(`Error deleting image from storage (${filePath}):`, error.message);
  }
}

