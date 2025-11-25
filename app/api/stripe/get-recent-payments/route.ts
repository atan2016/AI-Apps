import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's Stripe customer ID from profiles
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ sessions: [] });
    }

    // Get recent checkout sessions for this customer
    const sessions = await stripe.checkout.sessions.list({
      customer: profile.stripe_customer_id,
      limit: 10,
      expand: ['data.payment_intent'],
    });

    // Filter to only paid sessions from the last 24 hours
    const recentPaidSessions = sessions.data
      .filter(session => 
        session.payment_status === 'paid' && 
        session.metadata?.userId === userId &&
        session.created > (Date.now() / 1000) - 86400 // Last 24 hours
      )
      .map(session => ({
        id: session.id,
        amount: session.amount_total,
        currency: session.currency,
        status: session.payment_status,
        created: session.created,
        metadata: session.metadata,
      }));

    return NextResponse.json({ sessions: recentPaidSessions });
  } catch (error) {
    console.error('Error fetching recent payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

