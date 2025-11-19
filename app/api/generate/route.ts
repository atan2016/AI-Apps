import { NextRequest, NextResponse } from "next/server";
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin, isPremierTier } from '@/lib/supabase';
import { uploadImageToStorage, downloadImageAsDataURL } from '@/lib/storage';
import { enhanceWithAI, type AIModel } from '@/lib/aiEnhancement';

const supabase = supabaseAdmin();

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

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

    // Get client IP for abuse prevention
    const clientIP = getClientIP(request);

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

    // Guest users: Only allow one free image (with or without AI)
    if (isGuest) {
      // Check if test guest mode is enabled (bypasses restrictions for testing)
      // Check both NEXT_PUBLIC_ (client-side) and regular (server-side) env vars
      const ENABLE_TEST_GUEST = process.env.NEXT_PUBLIC_ENABLE_TEST_GUEST === 'true' || process.env.ENABLE_TEST_GUEST === 'true';
      
      if (!ENABLE_TEST_GUEST) {
        // Normal guest restrictions - only allow one free image
        // First, check if this specific guest session already has an image
        const { data: existingImages, error: checkError } = await supabase
          .from('images')
          .select('id')
          .eq('user_id', userId)
          .limit(1);
        
        if (!checkError && existingImages && existingImages.length > 0) {
          return NextResponse.json(
            { error: "You've already used your free image. Please sign up to create more images." },
            { status: 402 }
          );
        }

        // Server-side abuse prevention: Check IP address to prevent clearing localStorage abuse
        // Only check if we can get the client IP
        if (clientIP) {
          // Count guest images created from this IP in the last 24 hours
          // We can't directly track IP in the database, so we'll use a heuristic:
          // Check if there are multiple different guest sessions that might be from the same IP
          // by checking recent guest images and limiting per IP (approximate)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: recentGuestImages } = await supabase
            .from('images')
            .select('user_id, created_at')
            .like('user_id', 'guest_%')
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false });
          
          if (recentGuestImages) {
            // Count unique guest sessions from the last 24 hours
            // Since we can't track IP directly, we use a global threshold
            // Each guest session is already limited to 1 image, so this is just for extreme abuse prevention
            const uniqueGuestSessions = new Set(recentGuestImages.map(img => img.user_id));
            
            // Only block if there are 100+ unique guest sessions in the last 24 hours globally
            // This is a very high threshold to prevent extreme abuse while allowing legitimate users
            // Each legitimate user can only create 1 image per session anyway
            if (uniqueGuestSessions.size >= 100) {
              console.log(`Abuse prevention: Too many guest images created globally (${uniqueGuestSessions.size} in 24h)`);
              return NextResponse.json(
                { error: "You've reached the daily limit for guest images. Please sign up to create unlimited images." },
                { status: 402 }
              );
            }
          }
        }
      } else {
        console.log('Test guest mode enabled - bypassing all guest restrictions');
      }

      // Create a temporary profile for guest user to satisfy foreign key constraint
      // Check if profile already exists (shouldn't, but just in case)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (!existingProfile) {
        // Create a guest profile entry
        const { error: profileCreateError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            tier: 'free',
            credits: 0, // Guest users don't use credits
            ai_credits: 0,
          });

        if (profileCreateError) {
          console.error("Error creating guest profile:", profileCreateError);
          // Continue anyway - the insert might still work if constraint allows
        }
      }
    }

    // Get user profile and check credits (for logged-in users only)
    let profile = null;
    if (!isGuest) {
      const { data: profileData, error: profileError } = await supabase
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
        profile = newProfile;
      } else {
        profile = profileData;
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

    // Deduct credits based on enhancement type (logged-in users only)
    if (!isGuest && profile) {
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

    return NextResponse.json({ 
      success: true, 
      imageUrl: storageEnhancedUrl,
      imageId: imageRecord?.id,
      creditsRemaining: !isGuest && profile?.tier === 'free' ? profile.credits - 1 : null,
      aiCreditsRemaining: !isGuest && useAI && profile ? profile.ai_credits - 1 : (!isGuest ? profile?.ai_credits || 0 : 0),
      isGuest: isGuest
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

