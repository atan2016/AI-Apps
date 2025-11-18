// Utility to map asset images to their corresponding filters/models

export interface ExampleImage {
  type: 'original' | 'filter' | 'ai-model';
  name: string;
  displayName: string;
  path: string;
}

/**
 * Maps asset filenames to their display names and categories
 */
export function getExampleImages(): {
  original: ExampleImage | null;
  filters: ExampleImage[];
  aiModels: ExampleImage[];
} {
  const original: ExampleImage | null = {
    type: 'original',
    name: 'original',
    displayName: 'Original',
    path: '/assets/original_bw.png',
  };

  // Client-side filters (match button names)
  const filters: ExampleImage[] = [
    {
      type: 'filter',
      name: 'enhance',
      displayName: 'Enhance',
      path: '/assets/enhanced.png',
    },
    {
      type: 'filter',
      name: 'vibrant',
      displayName: 'Vibrant',
      path: '/assets/vibrant.png',
    },
    {
      type: 'filter',
      name: 'cool',
      displayName: 'Cool',
      path: '/assets/cool.png',
    },
    {
      type: 'filter',
      name: 'warm',
      displayName: 'Warm',
      path: '/assets/warm.png',
    },
    {
      type: 'filter',
      name: 'bw',
      displayName: 'B&W',
      path: '/assets/bw.png',
    },
  ];

  // AI Models - parse from filenames
  const aiModels: ExampleImage[] = [
    {
      type: 'ai-model',
      name: 'gfpgan',
      displayName: 'GFPGAN',
      path: '/assets/mom_bw_1-enhanced_gfpgan.png',
    },
    {
      type: 'ai-model',
      name: 'codeformer',
      displayName: 'CodeFormer',
      path: '/assets/mom_bw-1_codeformer.png',
    },
    {
      type: 'ai-model',
      name: 'realesrgan',
      displayName: 'Real-ESRGAN',
      path: '/assets/emoji-AI---Real-ESRGAN.png',
    },
    {
      type: 'ai-model',
      name: 'esrgan',
      displayName: 'Real-ESRGAN x2',
      path: '/assets/emoji-AI---Real-ESRGAN-x2.png',
    },
    {
      type: 'ai-model',
      name: 'swinir',
      displayName: 'Real-ESRGAN x3',
      path: '/assets/emoji-AI---Real-ESRGAN-x3.png',
    },
    {
      type: 'ai-model',
      name: 'bsrgan',
      displayName: 'BSRGAN',
      path: '/assets/emoji-AI---BSRGAN.png',
    },
    {
      type: 'ai-model',
      name: 'clarity',
      displayName: 'Clarity Upscaler',
      path: '/assets/emoji-AI---Clarity-Upscaler.png',
    },
    {
      type: 'ai-model',
      name: 'rembg',
      displayName: 'Background Removal',
      path: '/assets/emoji-AI---Background-Removal.png',
    },
    {
      type: 'ai-model',
      name: 'deoldify',
      displayName: 'Image Denoising',
      path: '/assets/emoji-AI---Image-Denoising.png',
    },
    {
      type: 'ai-model',
      name: 'photorestorer',
      displayName: 'Photo Restoration',
      path: '/assets/emoji-AI---Photo-Restoration.png',
    },
  ];

  return { original, filters, aiModels };
}

