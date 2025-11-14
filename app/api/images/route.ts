import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

// GET - Fetch user images
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

