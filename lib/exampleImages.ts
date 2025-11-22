// Utility to map asset images to their corresponding filters/models

export interface ExampleImage {
  type: 'original' | 'filter' | 'ai-model';
  name: string;
  displayName: string;
  path: string;
  description?: string;
  publicationUrl?: string;
  githubUrl?: string;
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
      description: 'Professional face restoration that enhances facial details and reduces artifacts. Best for portraits and old photos with faces.',
      publicationUrl: 'https://arxiv.org/abs/2101.04061',
      githubUrl: 'https://github.com/TencentARC/GFPGAN',
    },
    {
      type: 'ai-model',
      name: 'codeformer',
      displayName: 'CodeFormer',
      path: '/assets/mom_bw-1_codeformer.png',
      description: 'Robust face enhancement that preserves identity while improving quality. Ideal for damaged or low-resolution face photos.',
      publicationUrl: 'https://arxiv.org/abs/2206.11253',
      githubUrl: 'https://github.com/sczhou/CodeFormer',
    },
    {
      type: 'ai-model',
      name: 'realesrgan',
      displayName: 'Real-ESRGAN',
      path: '/assets/emoji-AI---Real-ESRGAN.png',
      description: 'High-quality 2x upscaling for general images. Enhances details and sharpness while maintaining natural appearance.',
      publicationUrl: 'https://arxiv.org/abs/2107.10833',
      githubUrl: 'https://github.com/xinntao/Real-ESRGAN',
    },
    {
      type: 'ai-model',
      name: 'esrgan',
      displayName: 'Real-ESRGAN x2',
      path: '/assets/emoji-AI---Real-ESRGAN-x2.png',
      description: '2x upscaling optimized for non-face images. Perfect for landscapes, objects, and scenes.',
      publicationUrl: 'https://arxiv.org/abs/2107.10833',
      githubUrl: 'https://github.com/xinntao/Real-ESRGAN',
    },
    {
      type: 'ai-model',
      name: 'swinir',
      displayName: 'Real-ESRGAN x3',
      path: '/assets/emoji-AI---Real-ESRGAN-x3.png',
      description: 'Triple upscaling (3x) for maximum detail enhancement. Great for enlarging small images significantly.',
      publicationUrl: 'https://arxiv.org/abs/2107.10833',
      githubUrl: 'https://github.com/xinntao/Real-ESRGAN',
    },
    {
      type: 'ai-model',
      name: 'bsrgan',
      displayName: 'BSRGAN',
      path: '/assets/emoji-AI---BSRGAN.png',
      description: 'Maximum quality 4x upscaling with face enhancement. Best for dramatically enlarging images while preserving faces.',
      publicationUrl: 'https://arxiv.org/abs/2103.14006',
      githubUrl: 'https://github.com/ckcz123/BSRGAN',
    },
    {
      type: 'ai-model',
      name: 'clarity',
      displayName: 'Clarity Upscaler',
      path: '/assets/emoji-AI---Clarity-Upscaler.png',
      description: 'Crystal-clear 2x upscaling with advanced detail preservation. Produces sharp, natural-looking results.',
      // Clarity is a commercial model, no publication available
    },
    {
      type: 'ai-model',
      name: 'rembg',
      displayName: 'Background Removal',
      path: '/assets/emoji-AI---Background-Removal.png',
      description: 'Automatically removes backgrounds from images. Perfect for creating transparent images or product photos.',
      githubUrl: 'https://github.com/danielgatis/rembg',
    },
    {
      type: 'ai-model',
      name: 'deoldify',
      displayName: 'Image Denoising',
      path: '/assets/emoji-AI---Image-Denoising.png',
      description: 'Removes noise and grain from photos. Ideal for improving quality of low-light or compressed images.',
      githubUrl: 'https://github.com/jantic/DeOldify',
    },
    {
      type: 'ai-model',
      name: 'photorestorer',
      displayName: 'Photo Restoration',
      path: '/assets/emoji-AI---Photo-Restoration.png',
      description: 'Restores and fixes old, damaged photos. Removes scratches, tears, and other imperfections.',
      publicationUrl: 'https://arxiv.org/abs/2004.09484',
      githubUrl: 'https://github.com/microsoft/Bringing-Old-Photos-Back-to-Life',
    },
  ];

  return { original, filters, aiModels };
}

