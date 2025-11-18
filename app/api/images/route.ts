import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

// GET - Fetch user images
export async function GET() {
  try {
    const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
    let userId: string | null = null;
    
    if (!SKIP_AUTH) {
      const authResult = await auth();
      userId = authResult.userId;
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in or sign up.' }, { status: 401 });
      }
    } else {
      userId = 'test-user-skip-auth';
    }

    const { data: images, error } = await supabase
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format images for frontend
    const formattedImages = images?.map((img) => ({
      id: img.id,
      originalUrl: img.original_url,
      enhancedUrl: img.enhanced_url,
      prompt: img.prompt || 'Enhanced Image',
      likes: img.likes || 0,
      isLiked: false,
      createdAt: img.created_at,
    })) || [];

    return NextResponse.json(formattedImages);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

