import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    console.log('Webhook event received:', event.type);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        const paymentType = session.metadata?.paymentType;

        console.log('Webhook received checkout.session.completed:', {
          sessionId: session.id,
          userId,
          tier,
          paymentType,
          metadata: session.metadata,
          paymentStatus: session.payment_status,
          customer: session.customer,
        });
        
        // Only process if payment was successful
        if (session.payment_status !== 'paid') {
          console.log(`Skipping webhook - payment status is ${session.payment_status}, not 'paid'`);
          break;
        }

        if (userId && tier) {
          if (tier === 'credit_pack') {
            // One-time credit purchase - add 50 AI credits
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('ai_credits')
              .eq('user_id', userId)
              .single();

            if (profileError && profileError.code === 'PGRST116') {
              // Profile doesn't exist, create it with 50 credits
              const { getFreeCredits } = await import('@/lib/config');
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  user_id: userId,
                  tier: 'free',
                  credits: getFreeCredits(),
                  ai_credits: 50,
                  updated_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (createError) {
                console.error(`Error creating profile for user ${userId}:`, createError);
              } else {
                console.log(`Created profile and added 50 AI credits for user ${userId}`);
              }
            } else if (profile) {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  ai_credits: (profile.ai_credits || 0) + 50,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              if (updateError) {
                console.error(`Error updating credits for user ${userId}:`, updateError);
              } else {
                console.log(`Added 50 AI credits for user ${userId}. New total: ${(profile.ai_credits || 0) + 50}`);
              }
            } else if (profileError) {
              console.error(`Error fetching profile for user ${userId}:`, profileError);
            }
          } else if (tier === 'pay_per_image' || tier === 'small_credit_pack' || paymentType === 'single_image' || paymentType === 'small_credit_pack') {
            // Pay-per-image payment or small credit pack - add 5 AI credits (minimum purchase)
            console.log(`Processing ${tier || paymentType} payment for user ${userId} - adding 5 credits`);
            
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('ai_credits')
              .eq('user_id', userId)
              .single();

            if (profileError && profileError.code === 'PGRST116') {
              // Profile doesn't exist, create it with 5 credits
              const { getFreeCredits } = await import('@/lib/config');
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  user_id: userId,
                  tier: 'free',
                  credits: getFreeCredits(),
                  ai_credits: 5,
                  updated_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (createError) {
                console.error(`Error creating profile for user ${userId}:`, createError);
              } else {
                console.log(`Created profile and added 5 AI credits for user ${userId}`);
              }
            } else if (profile) {
              const currentCredits = profile.ai_credits || 0;
              const newCredits = currentCredits + 5;
              
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  ai_credits: newCredits,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              if (updateError) {
                console.error(`Error updating credits for user ${userId}:`, updateError);
              } else {
                console.log(`Added 5 AI credits for user ${userId} (${tier || paymentType}). Previous: ${currentCredits}, New total: ${newCredits}`);
              }
            } else if (profileError) {
              console.error(`Error fetching profile for user ${userId}:`, profileError);
            }
          }
        } else {
          console.warn('Webhook received but missing userId or tier:', { userId, tier, metadata: session.metadata });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

