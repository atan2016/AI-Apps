# Premier Tier Setup Guide

## Step 1: Update Supabase Database Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Add premier tiers to the tier constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_tier_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_tier_check
CHECK (tier IN ('free', 'weekly', 'monthly', 'yearly', 'premier_weekly', 'premier_monthly', 'premier_yearly'));

-- Add AI credits column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 0;

-- Update existing premier users (if any) to have 100 AI credits
-- You can skip this if you don't have any premier users yet
```

## Step 2: Get Replicate API Token

1. Go to https://replicate.com/account/api-tokens
2. Create a new API token
3. Add to your `.env` file:
   ```
   REPLICATE_API_TOKEN=your_token_here
   ```
4. Add billing method: https://replicate.com/account/billing

**Note:** Replicate charges ~$0.01-0.02 per GFPGAN image, so 100 images ≈ $1-2 cost to you.

## Step 3: Create Stripe Products

Go to https://dashboard.stripe.com/test/products and create these products:

### Premier Plans (Subscriptions):

1. **Premier Weekly**
   - Name: `Premier Weekly Plan`
   - Price: `$9.99/week`
   - Billing: `Recurring - Weekly`
   - Copy the Price ID (starts with `price_...`)

2. **Premier Monthly**
   - Name: `Premier Monthly Plan`
   - Price: `$25.99/month`
   - Billing: `Recurring - Monthly`
   - Copy the Price ID

3. **Premier Yearly**
   - Name: `Premier Yearly Plan`
   - Price: `$280/year`
   - Billing: `Recurring - Yearly`
   - Copy the Price ID

### Credit Packs (One-time payments):

4. **AI Credit Pack**
   - Name: `100 AI Image Credits`
   - Price: `$5.00`
   - Billing: `One-time`
   - Copy the Price ID

## Step 4: Update Price IDs in Code

After creating the Stripe products, update the price IDs in `app/page.tsx`:

```typescript
const priceIds = {
  // Basic plans (client-side filters only)
  weekly: 'price_1SStMMJtYXMzJCdNgCsP5hnH',
  monthly: 'price_1ST5zOJtYXMzJCdNQ4ISfTqt',
  yearly: 'price_1SStMoJtYXMzJCdNu9mjlrW2',
  
  // Premier plans (AI enhancement included)
  premier_weekly: 'price_1ST613JtYXMzJCdNhoy66rjh',
  premier_monthly: 'price_1ST5zOJtYXMzJCdNQ4ISfTqt',
  premier_yearly: 'price_1ST5ycJtYXMzJCdNTh4Bgz1L',
  
  // Credit pack
  credit_pack: 'price_1ST63eJtYXMzJCdNTTL70mp8',
};
```

## Features Summary

### Free Tier
- 1 credit for testing
- Client-side filters only

### Basic Plans ($4.99/$20.99/$275)
- Unlimited client-side filtered images
- 5 filter presets (Enhance, Vibrant, Cool, Warm, B&W)

### Premier Plans ($9.99/$25.99/$280)
- Everything in Basic
- 100 AI-enhanced images per billing cycle
- GFPGAN face enhancement
- Purchase additional 100 images for $5

## Done! ✅

Your app now supports both Basic and Premier tiers with AI functionality.

