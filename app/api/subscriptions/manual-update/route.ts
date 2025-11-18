import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

// POST - Manually update subscription tier (for testing/debugging)
// This bypasses Stripe lookup and directly updates the database
export async function POST(request: NextRequest) {
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

    const { tier } = await request.json();

    if (!tier) {
      return NextResponse.json(
        { error: 'Tier is required' },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers = ['free', 'weekly', 'monthly', 'yearly', 'premier_weekly', 'premier_monthly', 'premier_yearly'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    const isPremier = tier.startsWith('premier_');

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        tier: tier as any,
        credits: 999999,
        ai_credits: isPremier ? 100 : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({
        success: false,
        message: `Failed to update profile: ${updateError.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Profile updated to ${tier} tier`,
      tier,
    });
  } catch (error) {
    console.error('Error manually updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

