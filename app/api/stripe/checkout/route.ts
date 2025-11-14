import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, tier } = await request.json();

    if (!priceId || !tier) {
      return NextResponse.json(
        { error: 'Price ID and tier are required' },
        { status: 400 }
      );
    }

    // Get or create profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ user_id: userId, tier: 'free', credits: 1 })
        .select()
        .single();
      profile = newProfile;
    }

    // Create or retrieve Stripe customer
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    // Determine mode based on tier (credit_pack is one-time payment, others are subscriptions)
    const mode = tier === 'credit_pack' ? 'payment' : 'subscription';

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${request.headers.get('origin')}?success=true`,
      cancel_url: `${request.headers.get('origin')}?canceled=true`,
      metadata: {
        userId: userId,
        tier: tier,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

