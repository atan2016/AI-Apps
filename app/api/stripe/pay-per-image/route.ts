import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { getFreeCredits } from '@/lib/config';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Price ID for $0.10 single image payment
// This should be created in Stripe as a one-time payment product
const PAY_PER_IMAGE_PRICE_ID = process.env.STRIPE_PAY_PER_IMAGE_PRICE_ID || 'price_placeholder';

export async function POST(request: NextRequest) {
  try {
    const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
    let userId: string | null = null;
    
    if (!SKIP_AUTH) {
      const { auth } = await import('@clerk/nextjs/server');
      const authResult = await auth();
      userId = authResult.userId;
    } else {
      userId = 'test-user-skip-auth';
    }

    // Require authentication - no guest checkout allowed
    if (!userId) {
      return NextResponse.json(
        { error: 'Please sign up or sign in to purchase credits.' },
        { status: 401 }
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

    // Create checkout session for $0.10 payment
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PAY_PER_IMAGE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${request.headers.get('origin')}?payment=success&type=single_image`,
      cancel_url: `${request.headers.get('origin')}?payment=canceled`,
      metadata: {
        userId: userId,
        tier: 'pay_per_image',
        isGuest: 'false',
        paymentType: 'single_image',
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating pay-per-image checkout session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

