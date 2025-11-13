// lib/aiEnhancement.ts
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

/**
 * Enhance an image using GFPGAN AI model
 * @param imageUrl - URL of the image to enhance (must be publicly accessible)
 * @returns URL of the enhanced image
 */
export async function enhanceWithGFPGAN(imageUrl: string): Promise<string> {
  try {
    console.log('Starting GFPGAN enhancement for:', imageUrl);
    
    // Use predictions API for more reliable output
    const prediction = await replicate.predictions.create({
      version: "9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3",
      input: {
        img: imageUrl,
        version: "v1.4",
        scale: 2,
      }
    });
    
    console.log('Prediction created:', prediction.id, 'Status:', prediction.status);
    
    // Wait for the prediction to complete
    const maxAttempts = 60; // 60 attempts = 1 minute max
    let attempts = 0;
    let result = prediction;
    
    while (result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      result = await replicate.predictions.get(prediction.id);
      console.log('Prediction status:', result.status);
      attempts++;
    }
    
    if (result.status === 'succeeded' && result.output) {
      // Output is usually a URL or array of URLs
      const output = result.output;
      console.log('GFPGAN output:', output);
      
      if (typeof output === 'string') {
        console.log('GFPGAN enhancement completed. URL:', output);
        return output;
      } else if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
        console.log('GFPGAN enhancement completed. URL:', output[0]);
        return output[0];
      }
    }
    
    throw new Error(`GFPGAN prediction ${result.status}. ${result.error || 'No output received.'}`);
  } catch (error) {
    console.error('GFPGAN enhancement error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance image with AI');
  }
}

/**
 * Check if AI enhancement is available (API token is configured)
 */
export function isAIEnhancementAvailable(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}
