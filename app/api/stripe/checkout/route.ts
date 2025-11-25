import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { getFreeCredits } from '@/lib/config';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
    let userId: string | null = null;
    
    if (!SKIP_AUTH) {
      const authResult = await auth();
      userId = authResult.userId;
    } else {
      userId = 'test-user-skip-auth';
    }

    const { priceId, tier } = await request.json();

    if (!priceId || !tier) {
      return NextResponse.json(
        { error: 'Price ID and tier are required' },
        { status: 400 }
      );
    }

    // Require authentication - no guest checkout allowed
    if (!userId) {
      return NextResponse.json(
        { error: 'Please sign up or sign in to purchase credits.' },
        { status: 401 }
      );
    }

    // All payments are one-time now (credit_pack or pay_per_image)

    // Get or create profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ 
          user_id: userId, 
          tier: 'free', 
          credits: getFreeCredits(),
          ai_credits: 0
          // Note: email column will be added in a future migration
        })
        .select()
        .single();
      profile = newProfile;
    }
    // Note: email will be stored in Stripe customer record, not in profiles table yet

    // Create or retrieve Stripe customer
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customerData: Stripe.CustomerCreateParams = {
        metadata: {
          userId: userId,
        },
      };
      
      const customer = await stripe.customers.create(customerData);
      customerId = customer.id;

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    // Create checkout session for one-time payment
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
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
        isGuest: 'false',
      },
    };

    // Set customer (all users are authenticated now)
    if (customerId) {
      sessionParams.customer = customerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    // Log the full error for debugging
    if (err instanceof Error) {
      console.error('Error details:', err.message);
      console.error('Error stack:', err.stack);
    }
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

