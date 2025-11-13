# Image Enhancer 🎨

A beautiful web app for enhancing images with instant filters. Built with Next.js 15 and powered by client-side JavaScript image processing - completely free!

## Features

- ✨ Enhance images with instant filters (Enhance, Vibrant, Cool, Warm, B&W)
- 🖼️ View all enhanced images in a responsive grid
- ❤️ Like your favorite results
- 💾 Download enhanced images as PNG files
- 🎭 Beautiful loading states and animations
- 🎯 Hover effects with interactive buttons
- 👁️ Before/after comparison view
- 💰 Credit system with upgrade tiers (Weekly, Monthly, Yearly)
- 💳 Stripe payment integration
- 🔐 Secure authentication with Clerk
- 📦 **Efficient storage** - Images stored in Supabase Storage
- 🆓 **Free tier** - 1 free credit to test

## Prerequisites

- Node.js 18+
- Supabase account - [Get it here](https://supabase.com)
- Clerk account for authentication - [Get it here](https://dashboard.clerk.com)
- Stripe account for payments - [Get it here](https://stripe.com)

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Set up Supabase Storage:**

Follow the instructions in [SUPABASE_STORAGE_SETUP.md](SUPABASE_STORAGE_SETUP.md) to:
- Create a storage bucket for images
- Set up storage policies for uploads and downloads

3. **Configure environment variables:**

Make sure your `.env` file has:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. **Run the development server:**

```bash
npm run dev
```

> **Note:** By default, authentication is disabled (`SKIP_AUTH=true` in `.env`) so you can test freely. To test the login flow in development, set `SKIP_AUTH=false` and add your Clerk keys. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

5. **Open your browser:**

Navigate to [http://localhost:3000](http://localhost:3000) to start enhancing images!

## Usage

1. Click the upload area or drag and drop an image
2. Preview your selected image
3. Select a filter (Enhance, Vibrant, Cool, Warm, B&W)
4. Click "Enhance Image" button
5. View your enhanced image instantly
6. Hover over any result to:
   - Download the enhanced image to your device
   - Like/unlike it
   - Toggle before/after view with the eye icon
7. All enhanced images are stored in Supabase Storage and displayed in the grid below

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4
- **UI Components:** shadcn/ui
- **Icons:** Lucide React
- **Image Processing:** Client-side Canvas API (JavaScript filters)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Authentication:** Clerk
- **Payments:** Stripe
- **Language:** TypeScript

## Project Structure

```
emoji-generator/
├── app/
│   ├── api/
│   │   ├── generate/
│   │   │   └── route.ts       # API route for image enhancement
│   │   ├── profile/
│   │   │   └── route.ts       # User profile API
│   │   ├── images/
│   │   │   └── route.ts       # Fetch user images
│   │   └── stripe/
│   │       ├── checkout/      # Stripe checkout
│   │       └── webhook/       # Stripe webhooks
│   ├── page.tsx               # Main application page
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── components/
│   ├── EmojiCard.tsx          # Image card component
│   ├── LoadingSkeleton.tsx    # Loading skeleton component
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── utils.ts               # Utility functions
│   ├── supabase.ts            # Supabase client
│   ├── storage.ts             # Supabase Storage helpers
│   └── imageFilters.ts        # Client-side image filters
└── middleware.ts              # Clerk authentication middleware
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

No environment variables needed - the GFPGAN model is free to use!

## License

MIT
