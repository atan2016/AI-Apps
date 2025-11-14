# UI Updates Summary

## Updates Completed So Far:
✅ Added `useAI` state
✅ Added `isPremierUser` helper
✅ Updated `handleSubmit` to send `useAI` parameter
✅ Updated credit refresh logic to handle AI credits

## Remaining UI Updates Needed:

### 1. Update Credits Display (lines 255-266)
- Show AI credits for premier users
- Format: "Premier Plan - 45 AI credits remaining"

### 2. Add AI Enhancement Toggle (before filter selection)
- Only show for premier users
- Toggle between client-side filters and AI enhancement
- When AI is selected, hide filter options and show "GFPGAN AI Enhancement"

### 3. Update Subscription Plans Section (lines 270-299)
- Split into two sections: Basic Plans and Premier Plans
- Basic Plans: $4.99/$20.99/$275 (unlimited client-side filters)
- Premier Plans: $9.99/$25.99/$280 (includes 100 AI images + unlimited filters)
- Show comparison features

### 4. Add Credit Purchase Button
- For premier users who run out of AI credits
- "Buy 100 AI Credits - $5"
- Only show when ai_credits < 10

## Stripe Price IDs Needed:

User needs to create these in Stripe:
```
premier_weekly: 'price_YOUR_PREMIER_WEEKLY_ID'
premier_monthly: 'price_YOUR_PREMIER_MONTHLY_ID'  
premier_yearly: 'price_YOUR_PREMIER_YEARLY_ID'
credit_pack: 'price_YOUR_CREDIT_PACK_ID'
```

## Next Steps:
1. User creates Stripe products (see PREMIER_TIER_SETUP.md)
2. User runs SQL to update database schema
3. User adds REPLICATE_API_TOKEN to .env
4. We update remaining UI components
5. Test the complete flow

