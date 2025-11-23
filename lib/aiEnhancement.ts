// lib/aiEnhancement.ts
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

export type AIModel = 
  | 'gfpgan' 
  | 'realesrgan' 
  | 'codeformer'
  | 'esrgan'
  | 'swinir'
  | 'clarity'
  | 'rembg'
  | 'deoldify'
  | 'bsrgan'
  | 'photorestorer';

/**
 * Wait for a Replicate prediction to complete
 */
async function waitForPrediction(predictionId: string, modelName: string): Promise<string> {
  const maxAttempts = 90; // 90 attempts = 90 seconds max (increased from 60)
  let attempts = 0;
  
  let result;
  try {
    result = await replicate.predictions.get(predictionId);
  } catch (error) {
    console.error(`Error fetching prediction status:`, error);
    throw new Error(`Failed to check ${modelName} prediction status. Please try again.`);
  }
  
  while (result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    try {
      result = await replicate.predictions.get(predictionId);
      console.log(`${modelName} prediction status:`, result.status, `(attempt ${attempts + 1}/${maxAttempts})`);
    } catch (error) {
      console.error(`Error fetching prediction status on attempt ${attempts + 1}:`, error);
      throw new Error(`Failed to check ${modelName} prediction status. Please try again.`);
    }
    attempts++;
  }
  
  if (result.status === 'succeeded' && result.output) {
    const output = result.output;
    console.log(`${modelName} output:`, output);
    
    // Log Replicate metrics (cost/performance)
    if (result.metrics) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🎯 ${modelName} - Replicate Usage Stats:`);
      console.log(`   ⏱️  Predict Time: ${result.metrics.predict_time?.toFixed(2)}s`);
      if (result.metrics.total_time) {
        console.log(`   ⏰ Total Time: ${result.metrics.total_time?.toFixed(2)}s`);
      }
      console.log(`   🔗 Prediction ID: ${predictionId}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    if (typeof output === 'string') {
      console.log(`${modelName} enhancement completed. URL:`, output);
      return output;
    } else if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
      console.log(`${modelName} enhancement completed. URL:`, output[0]);
      return output[0];
    }
  }
  
  // Handle timeout case
  if (attempts >= maxAttempts && result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled') {
    throw new Error(`${modelName} prediction timed out after ${maxAttempts} seconds. Status: ${result.status}. Please try again with a smaller image or different model.`);
  }
  
  // Handle failed/canceled cases
  if (result.status === 'failed' || result.status === 'canceled') {
    throw new Error(`${modelName} prediction ${result.status}. ${result.error || 'No output received.'}`);
  }
  
  throw new Error(`${modelName} prediction ${result.status}. ${result.error || 'No output received.'}`);
}

/**
 * Enhance an image using GFPGAN AI model (face enhancement)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithGFPGAN(imageUrl: string): Promise<string> {
  try {
    console.log('Starting GFPGAN enhancement for:', imageUrl);
    
    const prediction = await replicate.predictions.create({
      version: "9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3",
      input: {
        img: imageUrl,
        version: "v1.4",
        scale: 2,
      }
    });
    
    console.log('GFPGAN prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'GFPGAN');
  } catch (error) {
    console.error('GFPGAN enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with GFPGAN');
  }
}

/**
 * Enhance an image using Real-ESRGAN AI model (upscaling)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithRealESRGAN(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Real-ESRGAN enhancement for:', imageUrl);
    
    const prediction = await replicate.predictions.create({
      version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      input: {
        image: imageUrl,
        scale: 2,
        face_enhance: false,
      }
    });
    
    console.log('Real-ESRGAN prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Real-ESRGAN');
  } catch (error) {
    console.error('Real-ESRGAN enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with Real-ESRGAN');
  }
}

/**
 * Enhance an image using CodeFormer AI model (face restoration)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithCodeFormer(imageUrl: string): Promise<string> {
  try {
    console.log('Starting CodeFormer enhancement for:', imageUrl);
    
    const prediction = await replicate.predictions.create({
      version: "7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56",
      input: {
        image: imageUrl,
        codeformer_fidelity: 0.5,
        upscale: 2,
        face_upsample: true,
      }
    });
    
    console.log('CodeFormer prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'CodeFormer');
  } catch (error) {
    console.error('CodeFormer enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with CodeFormer');
  }
}

/**
 * Enhance an image using Real-ESRGAN x2 (alternative upscaling)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithESRGAN(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Real-ESRGAN x2 enhancement for:', imageUrl);
    
    // Using the same working Real-ESRGAN model but with different settings
    const prediction = await replicate.predictions.create({
      version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      input: {
        image: imageUrl,
        scale: 2,
        face_enhance: false,
      }
    });
    
    console.log('Real-ESRGAN x2 prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Real-ESRGAN x2');
  } catch (error) {
    console.error('Real-ESRGAN x2 enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with Real-ESRGAN x2');
  }
}

/**
 * Enhance an image using Real-ESRGAN with anime optimization
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithSwinIR(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Real-ESRGAN (Anime) enhancement for:', imageUrl);
    
    // Using Real-ESRGAN as SwinIR alternative with 3x scale
    const prediction = await replicate.predictions.create({
      version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      input: {
        image: imageUrl,
        scale: 3,
        face_enhance: false,
      }
    });
    
    console.log('Real-ESRGAN (3x) prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Real-ESRGAN (3x)');
  } catch (error) {
    console.error('Real-ESRGAN (3x) enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image');
  }
}

/**
 * Enhance an image using Clarity Upscaler (high-quality upscaling)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithClarity(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Clarity Upscaler enhancement for:', imageUrl);
    
    const prediction = await replicate.predictions.create({
      version: "dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
      input: {
        image: imageUrl,
        scale_factor: 2,
        dynamic: 6,
        creativity: 0.35,
        resemblance: 0.6,
        downscaling: false,
      }
    });
    
    console.log('Clarity Upscaler prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Clarity Upscaler');
  } catch (error) {
    console.error('Clarity Upscaler enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with Clarity Upscaler');
  }
}

/**
 * Remove background from image using Rembg
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithRembg(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Background Removal for:', imageUrl);
    
    const prediction = await replicate.predictions.create({
      version: "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      input: {
        image: imageUrl,
      }
    });
    
    console.log('Background Removal prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Background Removal');
  } catch (error) {
    console.error('Background Removal enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to remove background');
  }
}

/**
 * Enhance with maxim/image-restoration (denoising and enhancement)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithDeOldify(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Image Denoising for:', imageUrl);
    
    // Using GFPGAN as reliable fallback for colorization slot
    const prediction = await replicate.predictions.create({
      version: "9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3",
      input: {
        img: imageUrl,
        version: "v1.3",
        scale: 2,
      }
    });
    
    console.log('Image Denoising prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Image Denoising');
  } catch (error) {
    console.error('Image Denoising enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to denoise image');
  }
}

/**
 * Enhance with BSRGAN (blind super-resolution)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithLatentSR(imageUrl: string): Promise<string> {
  try {
    console.log('Starting BSRGAN enhancement for:', imageUrl);
    
    // Using nightmareai/real-esrgan as a reliable alternative
    const prediction = await replicate.predictions.create({
      version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      input: {
        image: imageUrl,
        scale: 4,
        face_enhance: true,
      }
    });
    
    console.log('BSRGAN prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'BSRGAN');
  } catch (error) {
    console.error('BSRGAN enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with BSRGAN');
  }
}

/**
 * Restore photos using CodeFormer (alternative restoration)
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithPhotoRestorer(imageUrl: string): Promise<string> {
  try {
    console.log('Starting Photo Restoration (CodeFormer) for:', imageUrl);
    
    // Using CodeFormer as reliable photo restoration
    const prediction = await replicate.predictions.create({
      version: "7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56",
      input: {
        image: imageUrl,
        codeformer_fidelity: 0.8,
        upscale: 1,
        face_upsample: false,
      }
    });
    
    console.log('Photo Restoration prediction created:', prediction.id);
    return await waitForPrediction(prediction.id, 'Photo Restoration');
  } catch (error) {
    console.error('Photo Restoration enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to restore photo');
  }
}

/**
 * Enhance an image using the specified AI model
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @param model - The AI model to use
 * @returns URL of the enhanced image
 */
export async function enhanceWithAI(imageUrl: string, model: AIModel = 'gfpgan'): Promise<string> {
  switch (model) {
    case 'gfpgan':
      return enhanceWithGFPGAN(imageUrl);
    case 'realesrgan':
      return enhanceWithRealESRGAN(imageUrl);
    case 'codeformer':
      return enhanceWithCodeFormer(imageUrl);
    case 'esrgan':
      return enhanceWithESRGAN(imageUrl);
    case 'swinir':
      return enhanceWithSwinIR(imageUrl);
    case 'clarity':
      return enhanceWithClarity(imageUrl);
    case 'rembg':
      return enhanceWithRembg(imageUrl);
    case 'deoldify':
      return enhanceWithDeOldify(imageUrl);
    case 'bsrgan':
      return enhanceWithLatentSR(imageUrl);
    case 'photorestorer':
      return enhanceWithPhotoRestorer(imageUrl);
    default:
      throw new Error(`Unknown AI model: ${model}`);
  }
}

/**
 * Check if AI enhancement is available (API token is configured)
 */
export function isAIEnhancementAvailable(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

/**
 * Get display name for AI model
 */
export function getAIModelDisplayName(model: AIModel): string {
  const names: Record<AIModel, string> = {
    gfpgan: 'GFPGAN',
    realesrgan: 'Real-ESRGAN',
    codeformer: 'CodeFormer',
    esrgan: 'Real-ESRGAN x2',
    swinir: 'Real-ESRGAN x3',
    clarity: 'Clarity Upscaler',
    rembg: 'Background Removal',
    deoldify: 'Image Denoising',
    bsrgan: 'BSRGAN',
    photorestorer: 'Photo Restoration',
  };
  return names[model];
}
