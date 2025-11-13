import { NextRequest, NextResponse } from "next/server";
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/storage';

const supabase = supabaseAdmin();

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  try {
    // Get user ID from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.text();
    let imageUrl, enhancedUrl;
    
    try {
      const parsed = JSON.parse(body);
      imageUrl = parsed.imageUrl;
      enhancedUrl = parsed.enhancedUrl; // Client-side enhanced image
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!imageUrl || !enhancedUrl) {
      return NextResponse.json(
        { error: "Both original and enhanced image URLs are required" },
        { status: 400 }
      );
    }

    // Get user profile and check credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      // If profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({ user_id: userId, tier: 'free', credits: 1 })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Use new profile for credit check
      if (!newProfile || newProfile.credits < 1) {
        return NextResponse.json(
          { error: "Insufficient credits. Please upgrade your plan." },
          { status: 402 }
        );
      }
    } else {
      // Check if user has enough credits (free tier only)
      if (profile.tier === 'free' && profile.credits < 1) {
        return NextResponse.json(
          { error: "Insufficient credits. Please upgrade your plan." },
          { status: 402 }
        );
      }
    }

    console.log("Uploading images to Supabase Storage for user:", userId);

    // Upload images to Supabase Storage
    let storageOriginalUrl: string;
    let storageEnhancedUrl: string;
    
    try {
      // Generate unique filenames
      const timestamp = Date.now();
      const originalFilename = `original_${timestamp}.png`;
      const enhancedFilename = `enhanced_${timestamp}.png`;
      
      // Upload both images to storage
      storageOriginalUrl = await uploadImageToStorage(imageUrl, userId, originalFilename);
      storageEnhancedUrl = await uploadImageToStorage(enhancedUrl, userId, enhancedFilename);
      
      console.log("Images uploaded successfully:", { storageOriginalUrl, storageEnhancedUrl });
    } catch (uploadError) {
      console.error("Error uploading images to storage:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload images. Please try again." },
        { status: 500 }
      );
    }

    // Deduct 1 credit if on free tier
    if (profile && profile.tier === 'free') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          credits: profile.credits - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error("Error updating credits:", updateError);
      }
    }

    // Save image URLs to database
    const { data: imageRecord, error: imageError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        original_url: storageOriginalUrl,
        enhanced_url: storageEnhancedUrl,
        prompt: 'enhanced image',
      })
      .select()
      .single();

    if (imageError) {
      console.error("Error saving image:", imageError);
      return NextResponse.json(
        { error: "Failed to save image record. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: storageEnhancedUrl,
      imageId: imageRecord?.id,
      creditsRemaining: profile?.tier === 'free' ? profile.credits - 1 : null
    });
  } catch (error) {
    console.error("Error enhancing image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to enhance image: ${errorMessage}` },
      { status: 500 }
    );
  }
}

