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
  tier: 'free'; // Only free tier now - pay-per-use model
  credits: number;
  ai_credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null; // Keep for migration period, will be cleared
  email: string | null; // For guest users
  created_at: string;
  updated_at: string;
}

// Helper function to check if tier is premium (deprecated - always returns false)
export function isPremierTier(tier: Profile['tier']): boolean {
  return false; // No more premier tiers
}

// Helper function to check if tier is paid (deprecated - always returns false)
export function isPaidTier(tier: Profile['tier']): boolean {
  return false; // No more paid tiers - pay-per-use model
}

// Helper function to get AI credits based on tier (deprecated - always returns 0)
export function getAICreditsForTier(tier: Profile['tier']): number {
  return 0; // No tier-based credits - pay-per-use model
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

