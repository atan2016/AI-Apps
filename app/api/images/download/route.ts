import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

// GET - Download image by URL (proxy for authenticated users)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      console.error('Download route: Missing image URL parameter');
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    console.log('Download route: Attempting to download image from:', imageUrl.substring(0, 100) + '...');

    // Check if this is a Supabase Storage URL
    // Supabase public URLs format: https://[project].supabase.co/storage/v1/object/public/image/[path]
    const isSupabaseUrl = imageUrl.includes('supabase.co/storage/v1/object/public');
    
    let response: Response;
    
    if (isSupabaseUrl) {
      // For Supabase URLs, try to fetch directly
      // If it fails, we might need to use signed URLs, but public URLs should work
      response = await fetch(imageUrl, {
        headers: {
          'Accept': 'image/*',
        },
      });
    } else {
      // For other URLs (like Replicate), fetch normally
      response = await fetch(imageUrl);
    }
    
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status, response.statusText);
      console.error('Image URL:', imageUrl);
      
      // If Supabase URL fails, try to get a signed URL
      if (isSupabaseUrl && response.status === 404) {
        // Extract file path from Supabase URL
        const urlParts = imageUrl.split('/image/');
        if (urlParts.length >= 2) {
          const filePath = urlParts[1];
          try {
            // Try to get a signed URL (valid for 1 hour)
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('image')
              .createSignedUrl(filePath, 3600);
            
            if (!signedUrlError && signedUrlData?.signedUrl) {
              // Retry with signed URL
              response = await fetch(signedUrlData.signedUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch signed URL: ${response.statusText}`);
              }
            } else {
              throw new Error('Failed to create signed URL');
            }
          } catch (signError) {
            console.error('Error creating signed URL:', signError);
            return NextResponse.json(
              { error: 'Image not found or inaccessible' },
              { status: 404 }
            );
          }
        }
      } else {
        return NextResponse.json(
          { error: 'Failed to fetch image' },
          { status: response.status }
        );
      }
    }

    // Get the image blob
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Determine content type from blob or URL
    let contentType = blob.type || 'image/png';
    if (!contentType || contentType === 'application/octet-stream') {
      // Try to infer from URL
      if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (imageUrl.includes('.png')) {
        contentType = 'image/png';
      } else if (imageUrl.includes('.gif')) {
        contentType = 'image/gif';
      } else if (imageUrl.includes('.webp')) {
        contentType = 'image/webp';
      }
    }

    // Return the image with appropriate headers
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="enhanced-image.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    return NextResponse.json(
      { error: 'Failed to download image' },
      { status: 500 }
    );
  }
}

