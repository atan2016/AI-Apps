import { NextRequest, NextResponse } from "next/server";
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage, downloadImageAsDataURL } from '@/lib/storage';
import { enhanceWithAI, type AIModel } from '@/lib/aiEnhancement';
import { getFreeCredits } from '@/lib/config';

const supabase = supabaseAdmin();

export const runtime = 'nodejs';
export const maxDuration = 300; // 300 seconds timeout (5 minutes) to allow for Replicate processing which can take longer

// Helper function to get client IP
function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Skip auth if SKIP_AUTH flag is set
    const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
    let userId: string | null = null;
    let isGuest = false;
    
    if (!SKIP_AUTH) {
      // Get user ID from Clerk
      const authResult = await auth();
      userId = authResult.userId;
    } else {
      // Use a default test user ID when auth is skipped
      userId = 'test-user-skip-auth';
    }

    // Get client IP for abuse prevention (currently not used but kept for future abuse prevention)
    // const clientIP = getClientIP(request);

    // Read and parse request body once
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { imageUrl, enhancedUrl, useAI = false, aiModel = 'gfpgan', filterName = 'Enhance', guestSessionId } = body;

    // If no authenticated user and guestSessionId is provided, allow guest access
    if (!userId && guestSessionId) {
      isGuest = true;
      userId = `guest_${guestSessionId}`;
    }

    // Require authentication if no user ID (either authenticated or guest)
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in or sign up." },
        { status: 401 }
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

    const FREE_CREDITS = getFreeCredits();
    
    // Get or create profile for both guests and signed-in users
    let profile = null;
    let freeImagesUsed = 0;
    
    // Get profile (create if doesn't exist)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      // Insert profile without email column (database may not have it yet)
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({ 
          user_id: userId, 
          tier: 'free', 
          credits: FREE_CREDITS, 
          ai_credits: 0
          // Note: email column will be added in a future migration
        })
        .select()
        .single();
      
      if (createError) throw createError;
      profile = newProfile;
    } else if (profileError) {
      throw profileError;
    } else {
      profile = profileData;
    }

    // Count how many AI images this user has created (to track free credits used)
    if (useAI) {
      const { data: aiImages } = await supabase
        .from('images')
        .select('id')
        .eq('user_id', userId)
        .like('prompt', 'AI - %');
      
      freeImagesUsed = aiImages?.length || 0;
    }

    // Check credits for AI enhancement
    if (useAI) {
      const hasFreeCreditsLeft = freeImagesUsed < FREE_CREDITS;
      const hasPurchasedCredits = (profile?.ai_credits || 0) > 0;
      
      if (!hasFreeCreditsLeft && !hasPurchasedCredits) {
        // No free credits left and no purchased credits
        if (isGuest) {
          return NextResponse.json(
            { 
              error: "You've used all free AI credits. Please purchase 5 credits for $1, or 50 credits for $5.",
              requiresPayment: true,
              isGuest: true
            },
            { status: 402 }
          );
        } else {
          return NextResponse.json(
            { 
              error: "You've used all free AI credits. Please purchase credits to continue.",
              requiresPayment: true,
              isGuest: false
            },
            { status: 402 }
          );
        }
      }
    }

    // Non-AI images (client-side filters) are always free - no credit check needed

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
        // Check if Replicate API token is configured
        if (!process.env.REPLICATE_API_TOKEN) {
          throw new Error('Replicate API token is not configured. Please contact support.');
        }
        
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
      const errorMessage = enhancementError instanceof Error 
        ? enhancementError.message 
        : enhancementError instanceof Object && 'message' in enhancementError
          ? String(enhancementError.message)
          : "Failed to process image. Please try again.";
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Deduct credits for AI enhancement only (after free credits are used)
    if (useAI && profile) {
      const hasFreeCreditsLeft = freeImagesUsed < FREE_CREDITS;
      
      if (!hasFreeCreditsLeft) {
        // Free credits exhausted, deduct from purchased credits
        if ((profile.ai_credits || 0) > 0) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              ai_credits: profile.ai_credits - 1,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          if (updateError) {
            console.error("Error updating AI credits:", updateError);
          } else {
            profile.ai_credits = profile.ai_credits - 1;
          }
        }
      }
      // If free credits are available, no deduction needed (free image)
    }
    // Non-AI images are always free - no credit deduction

    // Save image URLs to database
    const methodLabel = useAI ? `AI - ${filterName}` : filterName || 'Enhance';
    const { data: imageRecord, error: imageError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        original_url: storageOriginalUrl,
        enhanced_url: storageEnhancedUrl,
        prompt: methodLabel,
        likes: 0, // Initialize likes to 0
      })
      .select()
      .single();

    if (imageError) {
      console.error("Error saving image:", imageError);
      console.error("Image error details:", JSON.stringify(imageError, null, 2));
      return NextResponse.json(
        { error: `Failed to save image record: ${imageError.message || 'Unknown error'}. Please try again.` },
        { status: 500 }
      );
    }

    // Calculate remaining credits
    const freeCreditsRemaining = useAI ? Math.max(0, FREE_CREDITS - (freeImagesUsed + 1)) : null;
    const purchasedCreditsRemaining = useAI && !(freeImagesUsed < FREE_CREDITS) ? (profile?.ai_credits || 0) : (profile?.ai_credits || 0);

    return NextResponse.json({ 
      success: true, 
      imageUrl: storageEnhancedUrl,
      imageId: imageRecord?.id,
      freeCreditsRemaining: freeCreditsRemaining,
      aiCreditsRemaining: purchasedCreditsRemaining,
      isGuest: isGuest
    });
  } catch (error) {
    console.error("Error enhancing image:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: `Failed to enhance image: ${errorMessage}` },
      { status: 500 }
    );
  }
}

