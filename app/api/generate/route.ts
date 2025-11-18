import { NextRequest, NextResponse } from "next/server";
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin, isPremierTier } from '@/lib/supabase';
import { uploadImageToStorage, downloadImageAsDataURL } from '@/lib/storage';
import { enhanceWithAI, type AIModel } from '@/lib/aiEnhancement';

const supabase = supabaseAdmin();

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  try {
    // Skip auth if SKIP_AUTH flag is set
    const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
    let userId: string | null = null;
    
    if (!SKIP_AUTH) {
      // Get user ID from Clerk
      const authResult = await auth();
      userId = authResult.userId;
      
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized. Please sign in or sign up." },
          { status: 401 }
        );
      }
    } else {
      // Use a default test user ID when auth is skipped
      userId = 'test-user-skip-auth';
    }

    const body = await request.text();
    let imageUrl, enhancedUrl, useAI, aiModel, filterName;
    
    try {
      const parsed = JSON.parse(body);
      imageUrl = parsed.imageUrl;
      enhancedUrl = parsed.enhancedUrl; // Client-side enhanced image
      useAI = parsed.useAI || false;
      aiModel = parsed.aiModel || 'gfpgan'; // AI model to use
      filterName = parsed.filterName || 'Enhance'; // Enhancement method name
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    if (!useAI && !enhancedUrl) {
      return NextResponse.json(
        { error: "Enhanced image URL is required for non-AI enhancement" },
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
        .insert({ user_id: userId, tier: 'free', credits: 1, ai_credits: 0 })
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
      // Check if AI enhancement is requested
      if (useAI) {
        // AI enhancement requires premier tier
        if (!isPremierTier(profile.tier)) {
          return NextResponse.json(
            { error: "AI enhancement requires a Premier plan. Please upgrade to Premier." },
            { status: 402 }
          );
        }
        
        // Check AI credits
        if (profile.ai_credits < 1) {
          return NextResponse.json(
            { error: "Insufficient AI credits. Purchase more credits to continue." },
            { status: 402 }
          );
        }
      } else {
        // Basic enhancement - check regular credits for free tier only
        if (profile.tier === 'free' && profile.credits < 1) {
          return NextResponse.json(
            { error: "Insufficient credits. Please upgrade your plan." },
            { status: 402 }
          );
        }
      }
    }

    console.log("Processing image for user:", userId, "useAI:", useAI);

    // Upload original image to storage first
    let storageOriginalUrl: string;
    let storageEnhancedUrl: string;
    
    try {
      const timestamp = Date.now();
      const originalFilename = `original_${timestamp}.png`;
      
      // Upload original image
      storageOriginalUrl = await uploadImageToStorage(imageUrl, userId, originalFilename);
      console.log("Original image uploaded:", storageOriginalUrl);
      
      // Handle enhancement based on useAI flag
      if (useAI) {
        // AI enhancement with selected model
        console.log('\n🚀 ═══════════════════════════════════════════════');
        console.log(`🤖 Starting AI Enhancement: ${aiModel.toUpperCase()}`);
        console.log(`📸 Input Image: ${storageOriginalUrl}`);
        console.log('💰 Replicate API Credit will be consumed...');
        console.log('═══════════════════════════════════════════════\n');
        
        const startTime = Date.now();
        const aiEnhancedUrl = await enhanceWithAI(storageOriginalUrl, aiModel as AIModel);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('\n✅ ═══════════════════════════════════════════════');
        console.log(`✨ AI Enhancement Complete! (${duration}s)`);
        console.log(`📤 Output Image: ${aiEnhancedUrl}`);
        console.log('💳 1 Replicate API credit used');
        console.log('═══════════════════════════════════════════════\n');
        
        // Download the AI-enhanced image from Replicate and upload to Supabase Storage
        // This ensures the image persists even after Replicate URLs expire
        console.log('📥 Downloading AI-enhanced image from Replicate...');
        const aiEnhancedDataUrl = await downloadImageAsDataURL(aiEnhancedUrl);
        const enhancedFilename = `enhanced_${timestamp}.png`;
        storageEnhancedUrl = await uploadImageToStorage(aiEnhancedDataUrl, userId, enhancedFilename);
        console.log("AI-enhanced image uploaded to Supabase:", storageEnhancedUrl);
      } else {
        // Client-side enhanced image - upload to storage
        const enhancedFilename = `enhanced_${timestamp}.png`;
        storageEnhancedUrl = await uploadImageToStorage(enhancedUrl, userId, enhancedFilename);
        console.log("Client-side enhanced image uploaded:", storageEnhancedUrl);
      }
    } catch (enhancementError) {
      console.error("Error processing image:", enhancementError);
      return NextResponse.json(
        { error: enhancementError instanceof Error ? enhancementError.message : "Failed to process image. Please try again." },
        { status: 500 }
      );
    }

    // Deduct credits based on enhancement type
    if (profile) {
      if (useAI) {
        // Deduct AI credit for premier users
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            ai_credits: profile.ai_credits - 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error("Error updating AI credits:", updateError);
        }
      } else if (profile.tier === 'free') {
        // Deduct regular credit for free tier users
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
    }

    // Save image URLs to database
    const methodLabel = useAI ? `AI - ${filterName}` : filterName || 'Enhance';
    const { data: imageRecord, error: imageError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        original_url: storageOriginalUrl,
        enhanced_url: storageEnhancedUrl,
        prompt: methodLabel,
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
      creditsRemaining: profile?.tier === 'free' ? profile.credits - 1 : null,
      aiCreditsRemaining: useAI && profile ? profile.ai_credits - 1 : profile?.ai_credits || 0
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

