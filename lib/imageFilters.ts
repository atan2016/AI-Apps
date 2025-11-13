// Client-side image filtering utilities using Canvas API

export interface FilterOptions {
  brightness?: number; // 0-200 (100 is normal)
  contrast?: number; // 0-200 (100 is normal)
  saturation?: number; // 0-200 (100 is normal)
  sharpen?: boolean;
  blur?: number; // 0-10
}

export async function applyFilters(
  imageDataUrl: string,
  options: FilterOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Apply filters
      const brightness = options.brightness ?? 100;
      const contrast = options.contrast ?? 100;
      const saturation = options.saturation ?? 100;

      // Brightness and Contrast adjustments
      const brightnessAdjust = (brightness - 100) * 2.55;
      const contrastFactor = (contrast / 100) ** 2;

      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness
        let r = data[i] + brightnessAdjust;
        let g = data[i + 1] + brightnessAdjust;
        let b = data[i + 2] + brightnessAdjust;

        // Apply contrast
        r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
        g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
        b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

        // Apply saturation
        if (saturation !== 100) {
          const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
          const saturationFactor = saturation / 100;
          r = gray + (r - gray) * saturationFactor;
          g = gray + (g - gray) * saturationFactor;
          b = gray + (b - gray) * saturationFactor;
        }

        // Clamp values
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }

      // Apply sharpening if requested
      if (options.sharpen) {
        applySharpen(imageData);
      }

      // Apply blur if requested
      if (options.blur && options.blur > 0) {
        applyBlur(ctx, canvas, options.blur);
      }

      // Put modified image data back
      ctx.putImageData(imageData, 0, 0);

      // Convert to data URL
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

function applySharpen(imageData: ImageData) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Sharpening kernel
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  const tempData = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        // RGB only, skip alpha
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += tempData[idx] * kernel[kernelIdx];
          }
        }
        const idx = (y * width + x) * 4 + c;
        data[idx] = Math.max(0, Math.min(255, sum));
      }
    }
  }
}

function applyBlur(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  amount: number
) {
  ctx.filter = `blur(${amount}px)`;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (tempCtx) {
    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  }
  ctx.filter = 'none';
}

// Preset filters
export const FILTER_PRESETS = {
  enhance: {
    brightness: 110,
    contrast: 120,
    saturation: 115,
    sharpen: true,
  },
  vibrant: {
    brightness: 105,
    contrast: 110,
    saturation: 140,
  },
  cool: {
    brightness: 100,
    contrast: 105,
    saturation: 90,
  },
  warm: {
    brightness: 110,
    contrast: 105,
    saturation: 120,
  },
  bw: {
    brightness: 100,
    contrast: 120,
    saturation: 0,
    sharpen: true,
  },
};

