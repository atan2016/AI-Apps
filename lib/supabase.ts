import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client for client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (bypasses RLS)
// Only use this in API routes, never in client components
export const supabaseAdmin = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Database types
export interface Profile {
  user_id: string;
  tier: 'free' | 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly';
  credits: number;
  ai_credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// Helper function to check if tier is premium
export function isPremierTier(tier: Profile['tier']): boolean {
  return tier.startsWith('premier_');
}

// Helper function to check if tier is paid (basic or premier)
export function isPaidTier(tier: Profile['tier']): boolean {
  return tier !== 'free';
}

// Helper function to get AI credits based on tier
export function getAICreditsForTier(tier: Profile['tier']): number {
  switch (tier) {
    case 'premier_yearly':
      return 800;
    case 'premier_monthly':
      return 200;
    case 'premier_weekly':
      return 100;
    default:
      return 0;
  }
}

export interface ImageRecord {
  id: string;
  user_id: string;
  original_url: string;
  enhanced_url: string;
  prompt: string;
  likes: number;
  created_at: string;
}

