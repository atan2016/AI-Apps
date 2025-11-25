import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { getFreeCredits } from '@/lib/config';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Price ID for $1 payment (5 credits minimum purchase)
// Note: Stripe requires minimum $0.50 for checkout sessions
// This should be created in Stripe as a one-time payment product for $1.00
const PAY_PER_IMAGE_PRICE_ID = process.env.STRIPE_PAY_PER_IMAGE_PRICE_ID || 'price_1SXDcYJtYXMzJCdNsi2jGDni';

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

    // Create checkout session for $1 payment (5 credits minimum purchase)
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
      success_url: `${request.headers.get('origin')}/subscriptions?success=true&type=small_credit_pack&credits=5`,
      cancel_url: `${request.headers.get('origin')}/subscriptions?payment=canceled`,
      metadata: {
        userId: userId,
        tier: 'small_credit_pack',
        isGuest: 'false',
        paymentType: 'small_credit_pack',
        credits: '5',
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    });
  } catch (err) {
    console.error('Error creating pay-per-image checkout session:', err);
    // Log full error details for debugging
    if (err instanceof Error) {
      console.error('Error details:', err.message);
      console.error('Error stack:', err.stack);
    }
    // Check if it's a Stripe error
    if (err && typeof err === 'object' && 'type' in err) {
      const stripeError = err as { type?: string; message?: string; code?: string };
      return NextResponse.json(
        { 
          error: 'Failed to create checkout session',
          details: stripeError.message || 'Stripe API error',
          code: stripeError.code || stripeError.type
        },
        { status: 500 }
      );
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

