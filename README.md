# Face Enhancer 🎨

A beautiful web app for restoring and enhancing faces in photos using AI. Built with Next.js 15 and powered by Replicate's GFPGAN model (free to use!).

## Features

- ✨ Restore and enhance faces using AI
- 🖼️ View all enhanced images in a responsive grid
- ❤️ Like your favorite results
- 💾 Download enhanced images as PNG files
- 🎭 Beautiful loading states and animations
- 🎯 Hover effects with interactive buttons
- 🆓 **Completely free** - uses GFPGAN model on Replicate

## Prerequisites

- Node.js 18+
- No API token required! GFPGAN model is free on Replicate

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Run the development server:**

```bash
npm run dev
```

3. **Open your browser:**

Navigate to [http://localhost:3000](http://localhost:3000) to start enhancing faces!

## Usage

1. Click the upload area or drag and drop an image containing a face
2. Preview your selected image
3. Click "Enhance Face" button
4. Wait for the AI to restore and enhance the face
5. Hover over any result to:
   - Download the enhanced image to your device
   - Like/unlike it
6. All enhanced images are displayed in the grid below

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4
- **UI Components:** shadcn/ui
- **Icons:** Lucide React
- **AI Model:** GFPGAN (Tencent ARC) via Replicate
- **Language:** TypeScript

## Project Structure

```
face-enhancer/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts       # API route for face enhancement
│   ├── page.tsx               # Main application page
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── components/
│   ├── EmojiCard.tsx          # Image card component
│   ├── LoadingSkeleton.tsx    # Loading skeleton component
│   └── ui/                    # shadcn/ui components
└── lib/
    └── utils.ts               # Utility functions
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

No environment variables needed - the GFPGAN model is free to use!

## License

MIT
