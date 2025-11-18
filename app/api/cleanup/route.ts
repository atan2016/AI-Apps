import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteImageFromStorage } from '@/lib/storage';

const supabase = supabaseAdmin();

// Supabase free plan storage limit: 1 GB = 1073741824 bytes
const STORAGE_LIMIT_BYTES = 1073741824;
const STORAGE_ALERT_THRESHOLD = 0.9; // Alert at 90% usage

/**
 * DELETE /api/cleanup
 * Cleanup endpoint to delete images older than 24 hours
 * This should be called by a cron job or scheduled task
 */
export async function DELETE(request: Request) {
  try {
    // Optional: Add authentication/authorization here
    // For example, check for an API key or admin token
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CLEANUP_API_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    console.log('🧹 Starting cleanup of images older than 24 hours...');
    console.log('Cutoff time:', twentyFourHoursAgo.toISOString());

    // Find all images older than 24 hours
    const { data: oldImages, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .lt('created_at', twentyFourHoursAgo.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!oldImages || oldImages.length === 0) {
      console.log('✅ No images to clean up');
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: 'No images older than 24 hours found',
      });
    }

    console.log(`Found ${oldImages.length} images to delete`);

    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Delete each image from storage and database
    for (const image of oldImages) {
      try {
        // Delete from Supabase Storage
        if (image.original_url) {
          try {
            await deleteImageFromStorage(image.original_url);
          } catch (err) {
            console.warn(`Failed to delete original image ${image.original_url}:`, err);
          }
        }
        
        if (image.enhanced_url) {
          try {
            await deleteImageFromStorage(image.enhanced_url);
          } catch (err) {
            console.warn(`Failed to delete enhanced image ${image.enhanced_url}:`, err);
          }
        }

        // Delete from database
        const { error: deleteError } = await supabase
          .from('images')
          .delete()
          .eq('id', image.id);

        if (deleteError) {
          throw deleteError;
        }

        deletedCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to delete image ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`✅ Cleanup complete: ${deletedCount} images deleted, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      deletedCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Deleted ${deletedCount} images older than 24 hours`,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup images',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cleanup
 * Check storage usage and send alerts if needed
 */
export async function GET() {
  try {
    // Get storage usage from Supabase
    // Note: Supabase doesn't provide a direct API for storage usage
    // We'll estimate based on the number of images
    const { data: allImages, error } = await supabase
      .from('images')
      .select('id, original_url, enhanced_url');

    if (error) {
      throw error;
    }

    // Estimate storage (rough calculation)
    // Average image size ~500KB, so 2 images per user (original + enhanced) = ~1MB
    const estimatedBytes = (allImages?.length || 0) * 1024 * 512; // 512KB per image pair
    const percentage = (estimatedBytes / STORAGE_LIMIT_BYTES) * 100;

    // Check if we need to send an alert
    if (percentage >= STORAGE_ALERT_THRESHOLD * 100) {
      const { sendStorageAlert } = await import('@/lib/email');
      await sendStorageAlert(estimatedBytes, STORAGE_LIMIT_BYTES, percentage);
    }

    return NextResponse.json({
      estimatedUsage: estimatedBytes,
      limit: STORAGE_LIMIT_BYTES,
      percentage: percentage.toFixed(2),
      imageCount: allImages?.length || 0,
      alertSent: percentage >= STORAGE_ALERT_THRESHOLD * 100,
    });
  } catch (error) {
    console.error('Error checking storage:', error);
    return NextResponse.json(
      {
        error: 'Failed to check storage',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

