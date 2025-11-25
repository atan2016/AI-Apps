import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    // Verify the session belongs to this user
    if (session.metadata?.userId !== userId) {
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed', paymentStatus: session.payment_status },
        { status: 400 }
      );
    }

    // Process the payment based on tier
    const tier = session.metadata?.tier;
    const creditsToAdd = tier === 'credit_pack' ? 50 : 5; // 50 for large pack, 5 for small pack

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ai_credits')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { getFreeCredits } = await import('@/lib/config');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          tier: 'free',
          credits: getFreeCredits(),
          ai_credits: creditsToAdd,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error(`Error creating profile for user ${userId}:`, createError);
        return NextResponse.json(
          { error: 'Failed to create profile', details: createError },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        credits: newProfile.ai_credits,
        creditsAdded: creditsToAdd,
      });
    } else if (profile) {
      const currentCredits = profile.ai_credits || 0;
      const newCredits = currentCredits + creditsToAdd;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ai_credits: newCredits,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error(`Error updating credits for user ${userId}:`, updateError);
        return NextResponse.json(
          { error: 'Failed to update credits', details: updateError },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        credits: newCredits,
        creditsAdded: creditsToAdd,
        previousCredits: currentCredits,
      });
    } else if (profileError) {
      console.error(`Error fetching profile for user ${userId}:`, profileError);
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: profileError },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

