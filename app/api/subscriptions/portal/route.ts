import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// POST - Create Stripe customer portal session
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please create a subscription first.' },
        { status: 404 }
      );
    }

    // Get origin for return URL
    const origin = request.headers.get('origin') || request.url.split('/').slice(0, 3).join('/');

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/subscriptions`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    
    // Handle Stripe errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as Stripe.errors.StripeError;
      
      if (stripeError.type === 'StripeInvalidRequestError') {
        if (stripeError.message?.includes('No such customer')) {
          return NextResponse.json(
            { error: 'Customer not found in Stripe. Please contact support.' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: `Stripe error: ${stripeError.message || 'Invalid request'}` },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Stripe error: ${stripeError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    // Handle generic errors
    if (error instanceof Error) {
      // Check for common Stripe errors
      if (error.message.includes('No such customer')) {
        return NextResponse.json(
          { error: 'Customer not found in Stripe. Please contact support.' },
          { status: 404 }
        );
      }
      if (error.message.includes('billing portal') || error.message.includes('portal')) {
        return NextResponse.json(
          { error: 'Stripe Customer Portal is not configured. Please configure it in your Stripe Dashboard under Settings > Billing > Customer portal.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Failed to create portal session: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create portal session. Please ensure Stripe Customer Portal is configured in your Stripe Dashboard.' },
      { status: 500 }
    );
  }
}

