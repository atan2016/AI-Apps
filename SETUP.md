# Emoji Generator Setup

## Environment Variables

Create a `.env` file in the root of the project with the following:

```
REPLICATE_API_TOKEN=your_token_here
```

Get your API token from: https://replicate.com/account/api-tokens

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- Generate custom emojis from text prompts using Replicate's SDXL-Emoji model
- View all generated emojis in a responsive grid
- Like your favorite emojis
- Download emojis as PNG files
- Beautiful loading states and animations

