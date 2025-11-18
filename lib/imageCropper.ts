// lib/imageCropper.ts
/**
 * Utility functions for cropping and rotating images using Canvas API
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a cropped and rotated image from the source image
 * Note: react-easy-crop provides crop coordinates that account for rotation
 * @param imageSrc - Source image URL or data URL
 * @param pixelCrop - Crop area in pixels (from react-easy-crop, already accounts for rotation)
 * @param rotation - Rotation angle in degrees (0-360)
 * @returns Promise resolving to data URL of cropped and rotated image
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation: number = 0
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate the size of the rotated image bounding box
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // Set canvas size to match bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Clear canvas with transparent background
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, bBoxWidth, bBoxHeight);

  // Translate to center, rotate, then translate back
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw the rotated image
  ctx.drawImage(image, 0, 0);

  // Now extract the cropped area from the rotated image
  // The pixelCrop coordinates are relative to the rotated image's bounding box
  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Could not get cropped canvas context');
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Extract the cropped region from the rotated canvas
  const imageData = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  croppedCtx.putImageData(imageData, 0, 0);

  // Return as data URL
  return croppedCanvas.toDataURL('image/png');
}

/**
 * Creates an Image object from a source URL
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}

/**
 * Calculates the bounding box size after rotation
 */
function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Converts a data URL to a File object
 */
export function dataURLtoFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

