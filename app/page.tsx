"use client";

import { useState, FormEvent, ChangeEvent, useEffect, useRef } from "react";
import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiCard } from "@/components/EmojiCard";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ImageCropper } from "@/components/ImageCropper";
import { Loader2, Upload, X, CreditCard, Crop, Undo2 } from "lucide-react";
import { useUser, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { applyFilters, FILTER_PRESETS } from "@/lib/imageFilters";
import type { Profile } from "@/lib/supabase";
import type { AIModel } from "@/lib/aiEnhancement";
import { getAIModelDisplayName } from "@/lib/aiEnhancement";
import { getApiPath } from "@/lib/api-utils";
import { getFreeCredits } from "@/lib/config";

interface ImageData {
  id: string;
  originalUrl: string;
  enhancedUrl: string;
  prompt: string;
  likes: number;
  isLiked: boolean;
  createdAt?: string;
}

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterPreviewUrl, setFilterPreviewUrl] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<keyof typeof FILTER_PRESETS | 'original'>('enhance');
  const [useAI, setUseAI] = useState(false);
  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('gfpgan');
  const [images, setImages] = useState<ImageData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [guestImageCount, setGuestImageCount] = useState(0);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const signUpButtonRef = useRef<HTMLButtonElement>(null);
  
  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [originalImageBeforeCrop, setOriginalImageBeforeCrop] = useState<string | null>(null);
  const [hasUndoneCrop, setHasUndoneCrop] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rotationAngle, setRotationAngle] = useState(0);
  const [originalFileBeforeCrop, setOriginalFileBeforeCrop] = useState<File | null>(null);

  // Get free credits from configuration
  const FREE_CREDITS = getFreeCredits();
  
  // Track free AI images used and purchased credits
  const [freeAiImagesUsed, setFreeAiImagesUsed] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Initialize guest session on mount
  useEffect(() => {
    if (isLoaded && !user) {
      // Only access localStorage on client side
      if (typeof window !== 'undefined') {
        // Check for existing guest session
        const existingSessionId = localStorage.getItem('guestSessionId');
        const existingGuestImageCount = localStorage.getItem('guestImageCount');
        
        if (existingSessionId) {
          setGuestSessionId(existingSessionId);
          setGuestImageCount(existingGuestImageCount ? parseInt(existingGuestImageCount, 10) : 0);
        } else {
          // Create new guest session
          const newSessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem('guestSessionId', newSessionId);
          localStorage.setItem('guestImageCount', '0');
          setGuestSessionId(newSessionId);
          setGuestImageCount(0);
        }
      }
    }
  }, [isLoaded, user]);

  // Fetch user profile and images on mount
  useEffect(() => {
    if (isLoaded && user) {
      fetchProfile();
      fetchUserImages();
      
      // If user just signed up (was not signed in before), redirect to subscriptions
      // Check if we should redirect after sign-up
      const shouldRedirectToSubscriptions = sessionStorage.getItem('redirectAfterSignUp');
      if (shouldRedirectToSubscriptions === 'true') {
        sessionStorage.removeItem('redirectAfterSignUp');
        router.push('/subscriptions');
      }
    }
  }, [isLoaded, user, router]);

  // Handle payment success redirect
  useEffect(() => {
    if (typeof window !== 'undefined' && isLoaded) {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentSuccess = urlParams.get('payment') === 'success';

      if (paymentSuccess) {
        // Clean up URL parameters
        window.history.replaceState({}, '', window.location.pathname);

        // Refresh profile to get updated credits
        if (user) {
          // Use setTimeout to avoid dependency issues
          setTimeout(() => {
            fetchProfile();
          }, 100);
        }

        // Show success message
        setError(null);
        // Success message will be shown via profile update

        // Restore pending enhancement if exists
        const pendingEnhancement = sessionStorage.getItem('pendingEnhancement');
        if (pendingEnhancement) {
          try {
            const enhancementData = JSON.parse(pendingEnhancement);
            // Check if it's recent (within last 10 minutes)
            if (Date.now() - enhancementData.timestamp < 10 * 60 * 1000) {
              // Restore the image
              const img = new Image();
              img.onload = () => {
                // Convert data URL back to file
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  canvas.toBlob((blob) => {
                    if (blob) {
                      const file = new File([blob], 'restored-image.png', { type: 'image/png' });
                      setSelectedFile(file);
                      setPreviewUrl(enhancementData.imageDataUrl);
                      setUseAI(enhancementData.useAI);
                      setSelectedAIModel(enhancementData.aiModel);
                      setSelectedFilter(enhancementData.selectedFilter);
                      
                      // Clear the stored enhancement
                      sessionStorage.removeItem('pendingEnhancement');
                      
                      // Wait for profile to update, then automatically trigger enhancement
                      setTimeout(() => {
                        // Create a synthetic form event to trigger handleSubmit
                        const form = document.querySelector('form');
                        if (form) {
                          const syntheticEvent = new Event('submit', { bubbles: true, cancelable: true });
                          Object.defineProperty(syntheticEvent, 'preventDefault', {
                            value: () => {},
                            writable: false
                          });
                          handleSubmit(syntheticEvent as unknown as FormEvent);
                        }
                      }, 1500); // Wait 1.5 seconds for profile to update
                    }
                  });
                }
              };
              img.src = enhancementData.imageDataUrl;
            } else {
              // Too old, remove it
              sessionStorage.removeItem('pendingEnhancement');
            }
          } catch (err) {
            console.error('Error restoring pending enhancement:', err);
            sessionStorage.removeItem('pendingEnhancement');
          }
        }
      }
    }
  }, [isLoaded, user]);

  // Count free AI images used
  useEffect(() => {
    if (images.length > 0) {
      const aiImages = images.filter(img => img.prompt.startsWith('AI -'));
      setFreeAiImagesUsed(aiImages.length);
    }
  }, [images]);

  // Trigger Clerk sign-up modal when showSignUpModal is true
  useEffect(() => {
    if (showSignUpModal && signUpButtonRef.current) {
      // Trigger click to open Clerk modal
      setTimeout(() => {
        signUpButtonRef.current?.click();
        setShowSignUpModal(false); // Reset state after triggering
      }, 100);
    }
  }, [showSignUpModal]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(getApiPath('/api/profile'));
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserImages = async () => {
    try {
      const response = await fetch(getApiPath('/api/images'));
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  // Compress image if it's too large
  const compressImage = async (file: File, maxSize: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIMENSION = 4000; // Max width or height
          const quality = 0.9; // Start with high quality
          
          // Resize if too large
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = (height / width) * MAX_DIMENSION;
              width = MAX_DIMENSION;
            } else {
              width = (width / height) * MAX_DIMENSION;
              height = MAX_DIMENSION;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels until we get under the size limit
          const tryCompress = (q: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }
                
                // If still too large and quality can be reduced further
                if (blob.size > maxSize && q > 0.5) {
                  tryCompress(q - 0.1); // Reduce quality by 0.1
                } else if (blob.size > maxSize) {
                  // If still too large even at minimum quality, reject
                  reject(new Error('Image too large even after compression'));
                } else {
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                }
              },
              'image/jpeg',
              q
            );
          };
          
          tryCompress(quality);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Compress image for API upload - ensures base64 data URL is under Vercel's 4.5MB payload limit
  // When sending both original and enhanced images, we need to be more conservative
  // Target 2MB for original image (leaving room for enhanced image + other data)
  const compressImageForAPI = async (file: File): Promise<string> => {
    const MAX_BASE64_SIZE = 2 * 1024 * 1024; // 2MB base64 (safe when combined with enhanced image)
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // More aggressive resizing for API - max 2000px to keep file size down
          const MAX_DIMENSION = 2000;
          
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = (height / width) * MAX_DIMENSION;
              width = MAX_DIMENSION;
            } else {
              width = (width / height) * MAX_DIMENSION;
              height = MAX_DIMENSION;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels until base64 is under limit
          const tryCompress = (q: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }
                
                // Convert to base64 to check actual size
                const reader2 = new FileReader();
                reader2.onload = () => {
                  const base64 = reader2.result as string;
                  // Base64 string length is approximately 4/3 of the original size
                  // Check if base64 string is under our limit
                  const base64Size = (base64.length * 3) / 4;
                  
                  if (base64Size > MAX_BASE64_SIZE && q > 0.3) {
                    // Reduce quality further
                    tryCompress(q - 0.1);
                  } else if (base64Size > MAX_BASE64_SIZE) {
                    // If still too large, reduce dimensions
                    const newMaxDim = Math.max(800, Math.floor(MAX_DIMENSION * 0.8));
                    if (newMaxDim < MAX_DIMENSION) {
                      if (width > height) {
                        height = (height / width) * newMaxDim;
                        width = newMaxDim;
                      } else {
                        width = (width / height) * newMaxDim;
                        height = newMaxDim;
                      }
                      canvas.width = width;
                      canvas.height = height;
                      const ctx2 = canvas.getContext('2d');
                      if (ctx2) {
                        ctx2.drawImage(img, 0, 0, width, height);
                        tryCompress(0.7);
                      } else {
                        reject(new Error('Could not get canvas context'));
                      }
                    } else {
                      reject(new Error('Image too large even after maximum compression'));
                    }
                  } else {
                    resolve(base64);
                  }
                };
                reader2.onerror = () => reject(new Error('Failed to read compressed image'));
                reader2.readAsDataURL(blob);
              },
              'image/jpeg',
              q
            );
          };
          
          tryCompress(0.85); // Start with 85% quality
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Compress a base64 data URL to ensure it's under the size limit
  const compressDataUrl = async (dataUrl: string, maxBase64Size: number = 1.5 * 1024 * 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize if needed - more aggressive for enhanced images
        const MAX_DIMENSION = 1500;
        
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_DIMENSION;
            width = MAX_DIMENSION;
          } else {
            width = (width / height) * MAX_DIMENSION;
            height = MAX_DIMENSION;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels
        const tryCompress = (q: number) => {
          const compressed = canvas.toDataURL('image/jpeg', q);
          const base64Size = (compressed.length * 3) / 4;
          
          if (base64Size > maxBase64Size && q > 0.3) {
            tryCompress(q - 0.1);
          } else if (base64Size > maxBase64Size) {
            // Reduce dimensions further
            const newMaxDim = Math.max(800, Math.floor(MAX_DIMENSION * 0.7));
            if (newMaxDim < MAX_DIMENSION && width > newMaxDim && height > newMaxDim) {
              if (width > height) {
                height = (height / width) * newMaxDim;
                width = newMaxDim;
              } else {
                width = (width / height) * newMaxDim;
                height = newMaxDim;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx2 = canvas.getContext('2d');
              if (ctx2) {
                ctx2.drawImage(img, 0, 0, width, height);
                tryCompress(0.7);
              } else {
                reject(new Error('Could not get canvas context'));
              }
            } else {
              reject(new Error('Image too large even after maximum compression'));
            }
          } else {
            resolve(compressed);
          }
        };
        
        tryCompress(0.8);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Check file size (Supabase limit is 50MB, but base64 encoding increases size by ~33%)
      // So we limit to ~35MB to account for base64 encoding overhead
      const MAX_FILE_SIZE = 35 * 1024 * 1024; // 35MB in bytes
      
      if (file.size > MAX_FILE_SIZE) {
        // Try to compress the image automatically
        setError('Compressing large image...');
        try {
          const compressedFile = await compressImage(file, MAX_FILE_SIZE);
          setSelectedFile(compressedFile);
          setError(null);
        } catch {
          setError(`File size too large. Maximum size is 35MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB. Please compress or resize your image before uploading.`);
          return;
        }
      } else {
        setSelectedFile(file);
        setError(null);
      }
      
      // Reset cropping state when new file is selected
      setIsCropping(false);
      setOriginalImageBeforeCrop(null);
      setHasUndoneCrop(false);
      setCroppedImageUrl(null);
      setRotationAngle(0);
      setOriginalFileBeforeCrop(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFilterPreviewUrl(null);
    setSelectedFilter('enhance');
    setError(null);
    // Reset cropping state
    setIsCropping(false);
    setOriginalImageBeforeCrop(null);
    setHasUndoneCrop(false);
    setCroppedImageUrl(null);
    setRotationAngle(0);
    setOriginalFileBeforeCrop(null);
  };

  const handleCropClick = () => {
    if (previewUrl && selectedFile) {
      // Store original for undo - use the original file's URL, not cropped one
      const originalUrl = originalImageBeforeCrop || previewUrl;
      setOriginalImageBeforeCrop(originalUrl);
      setOriginalFileBeforeCrop(selectedFile);
      setIsCropping(true);
    }
  };

  const handleCropComplete = async (croppedImageUrl: string) => {
    // Revoke old preview URL if it was cropped (but not the original)
    if (croppedImageUrl && previewUrl && previewUrl !== originalImageBeforeCrop) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setCroppedImageUrl(croppedImageUrl);
    setPreviewUrl(croppedImageUrl);
    setIsCropping(false);
    setHasUndoneCrop(false);
    
    // Convert cropped image to File for selectedFile
    // Preserve original filename if available
    const originalFilename = selectedFile?.name || 'cropped-image.png';
    const { dataURLtoFile } = await import('@/lib/imageCropper');
    const croppedFile = dataURLtoFile(croppedImageUrl, originalFilename);
    setSelectedFile(croppedFile);
  };

  const handleCropCancel = () => {
    setIsCropping(false);
  };

  const handleUndoCrop = () => {
    if (originalImageBeforeCrop && originalFileBeforeCrop && !hasUndoneCrop) {
      // Revoke cropped image URL
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
      }
      if (previewUrl && previewUrl !== originalImageBeforeCrop) {
        URL.revokeObjectURL(previewUrl);
      }
      
      // Restore original
      const originalUrl = URL.createObjectURL(originalFileBeforeCrop);
      setPreviewUrl(originalUrl);
      setCroppedImageUrl(null);
      setRotationAngle(0);
      setHasUndoneCrop(true);
      setSelectedFile(originalFileBeforeCrop);
    }
  };

  // Handle filter selection with live preview
  const handleFilterSelect = async (filter: keyof typeof FILTER_PRESETS | 'original') => {
    setSelectedFilter(filter);
    
    if (!previewUrl) return;
    
    if (filter === 'original') {
      // Show original image
      setFilterPreviewUrl(null);
      return;
    }
    
    setIsApplyingFilter(true);
    try {
      const filterOptions = FILTER_PRESETS[filter];
      const filteredUrl = await applyFilters(previewUrl, filterOptions);
      setFilterPreviewUrl(filteredUrl);
    } catch (error) {
      console.error('Error applying filter preview:', error);
    } finally {
      setIsApplyingFilter(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    // For AI enhancement, check if user needs to purchase credits
    if (useAI) {
      // For guest users, use localStorage count; for signed-in users, use images array
      let aiImagesCount: number;
      if (!user) {
        // Guest user: use localStorage count
        aiImagesCount = guestImageCount;
      } else {
        // Signed-in user: count from images array
        aiImagesCount = images.filter(img => img.prompt.startsWith('AI -')).length;
      }
      
      const hasFreeCreditsLeft = aiImagesCount < FREE_CREDITS;
      const hasPurchasedCredits = profile && (profile.ai_credits || 0) > 0;
      
      if (!hasFreeCreditsLeft && !hasPurchasedCredits) {
        // Store enhancement state before showing payment options
        if (selectedFile && previewUrl) {
          const dataUrl = previewUrl;
          sessionStorage.setItem('pendingEnhancement', JSON.stringify({
            imageDataUrl: dataUrl,
            useAI: useAI,
            aiModel: selectedAIModel,
            selectedFilter: selectedFilter,
            timestamp: Date.now()
          }));
        }
        
        // No free credits left and no purchased credits - prompt to sign up or purchase
        if (!user) {
          // Guest user - require sign-up before payment
          setShowSignUpModal(true);
          setError(`You've used all ${FREE_CREDITS} free AI credits. Please sign up to get ${FREE_CREDITS} more free credits or purchase credits.`);
          return;
        } else {
          // Signed-in user - show error with purchase option
          setError('You\'ve used all free AI credits. Please purchase credits to continue.');
          // Optionally show a button to purchase credits
          // For now, we'll just show the error and they can use the subscriptions page
        }
        return;
      }
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Compress and convert file to data URL for API upload
      // This ensures the payload stays under Vercel's 4.5MB limit
      let dataUrl: string;
      try {
        dataUrl = await compressImageForAPI(selectedFile);
      } catch {
        setError('Failed to compress image. Please try a smaller image or compress it manually.');
        setIsGenerating(false);
        return;
      }

      // Prepare request body with filter name for display
      const filterNameMap: { [key: string]: string } = {
        enhance: 'Enhance',
        vibrant: 'Vibrant',
        cool: 'Cool',
        warm: 'Warm',
        bw: 'B&W',
      };
      // Don't allow submission if "Original" is selected (no filter applied)
      if (!useAI && selectedFilter === 'original') {
        setError('Please select a filter style before enhancing');
        return;
      }
      
      const filterDisplayName = filterNameMap[selectedFilter] || selectedFilter;
      
      // For client-side filters, apply filter and compress the enhanced image
      let enhancedUrl: string | undefined;
      if (!useAI) {
        try {
          const filterOptions = FILTER_PRESETS[selectedFilter as keyof typeof FILTER_PRESETS];
          const filteredDataUrl = await applyFilters(dataUrl, filterOptions);
          // Compress the enhanced image to keep total payload under limit
          // Use 1.5MB limit for enhanced image (leaving room for original + other data)
          try {
            enhancedUrl = await compressDataUrl(filteredDataUrl, 1.5 * 1024 * 1024);
          } catch (compressErr) {
            console.warn('Failed to compress filtered image, using original filtered image:', compressErr);
            // Fallback to original filtered image (might still be too large, but better than nothing)
            enhancedUrl = filteredDataUrl;
          }
          
          // Ensure enhancedUrl is set
          if (!enhancedUrl) {
            throw new Error('Failed to generate enhanced image');
          }
        } catch (filterErr) {
          console.error('Error applying filter:', filterErr);
          setError(filterErr instanceof Error ? filterErr.message : 'Failed to apply filter. Please try again.');
          setIsGenerating(false);
          return;
        }
      }

      // Validate that enhancedUrl is provided for client-side filters
      if (!useAI && !enhancedUrl) {
        setError('Failed to generate enhanced image. Please try again.');
        setIsGenerating(false);
        return;
      }

      const requestBody: { imageUrl: string; enhancedUrl?: string; useAI: boolean; aiModel?: AIModel; filterName: string } = {
        imageUrl: dataUrl,
        useAI: useAI,
        aiModel: useAI ? selectedAIModel : undefined,
        filterName: useAI ? getAIModelDisplayName(selectedAIModel) : filterDisplayName,
        enhancedUrl: enhancedUrl,
      };

      // Send to API for saving (and AI enhancement if requested)
      const requestPayload = {
        ...requestBody,
        guestSessionId: !user ? guestSessionId : undefined,
      };

      // Create AbortController for timeout
      // Increased to 5 minutes (300 seconds) to allow for AI processing which can take longer
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 seconds timeout (5 minutes)

      let response;
      try {
        response = await fetch(getApiPath("/api/generate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The enhancement is taking longer than expected. Please try again.');
        }
        throw fetchError;
      }
      clearTimeout(timeoutId);

      // Get content type to determine how to parse
      const contentType = response.headers.get("content-type") || "";
      let data: unknown = null;

      // Parse response body (can only be read once)
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          // If JSON parsing fails, read as text
          try {
            const text = await response.text();
            data = text || null;
          } catch (textError) {
            console.error('Failed to read response:', textError);
            data = null;
          }
        }
      } else {
        // Not JSON - read as text
        try {
          const text = await response.text();
          data = text || null;
        } catch (textError) {
          console.error('Failed to read response as text:', textError);
          data = null;
        }
      }

      // Check if response indicates an error
      if (!response.ok) {
        // Handle payment required error
        if (response.status === 402 && data && typeof data === 'object' && data !== null) {
          const errorData = data as { requiresPayment?: boolean; isGuest?: boolean; error?: string };
          if (errorData.requiresPayment) {
            // Store enhancement state before showing payment options
            if (selectedFile && previewUrl) {
              const dataUrl = previewUrl;
              sessionStorage.setItem('pendingEnhancement', JSON.stringify({
                imageDataUrl: dataUrl,
                useAI: useAI,
                aiModel: selectedAIModel,
                selectedFilter: selectedFilter,
                timestamp: Date.now()
              }));
            }
            
            if (errorData.isGuest) {
              // Guest user needs to sign up before payment
              setShowSignUpModal(true);
              setError(`You've used all ${FREE_CREDITS} free AI credits. Please sign up to get ${FREE_CREDITS} more free credits or purchase credits.`);
              setIsGenerating(false);
              return;
            } else {
              // Signed-in user needs to buy credits
              setError(errorData.error || 'Please purchase credits to continue');
              setIsGenerating(false);
              return;
            }
          }
        }
        
        // Extract error message from response
        let errorMessage = `Failed to enhance image (${response.status})`;
        
        if (data) {
          if (typeof data === 'object' && data !== null) {
            const errorObj = data as { error?: string; message?: string };
            if (errorObj.error) {
              errorMessage = errorObj.error;
            } else if (errorObj.message) {
              errorMessage = errorObj.message;
            } else if (Object.keys(data).length === 0) {
              // Empty object - use status text
              errorMessage = response.statusText || `Server error (${response.status})`;
            }
          } else if (typeof data === 'string' && data.trim()) {
            errorMessage = data;
          }
        } else {
          // No data - use status text
          errorMessage = response.statusText || `Server error (${response.status})`;
        }
        
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          contentType: contentType,
          data: data,
          errorMessage: errorMessage
        });
        
        if (response.statusText && !errorMessage.includes(response.statusText)) {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        
        setError(errorMessage);
        setIsGenerating(false);
        return;
      }
      
      // Type guard for successful response data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response data');
      }
      
      const responseData = data as { 
        imageId?: string; 
        imageUrl: string; 
        freeCreditsRemaining?: number; 
        aiCreditsRemaining?: number; 
        isGuest?: boolean;
      };

      // Track free AI images used
      if (useAI) {
        setFreeAiImagesUsed(prev => prev + 1);
      }

      // Add the new image to the beginning of the list
      const newImage: ImageData = {
        id: responseData.imageId || Date.now().toString(),
        originalUrl: dataUrl,
        enhancedUrl: responseData.imageUrl,
        prompt: useAI ? `AI - ${getAIModelDisplayName(selectedAIModel)}` : filterDisplayName,
        likes: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
      };

      setImages((prev) => [newImage, ...prev]);
      
      // If guest user, increment their image count
      if (responseData.isGuest && typeof window !== 'undefined') {
        const newCount = guestImageCount + 1;
        localStorage.setItem('guestImageCount', newCount.toString());
        setGuestImageCount(newCount);
      }
      
      // Refresh profile to update credits
      if (profile) {
        const updatedProfile = { ...profile };
        if (responseData.freeCreditsRemaining !== undefined) {
          // Free credits are tracked separately
        }
        if (responseData.aiCreditsRemaining !== undefined) {
          updatedProfile.ai_credits = responseData.aiCreditsRemaining;
        }
        setProfile(updatedProfile);
      }
      
      // Update free AI images count from response
      if (useAI && responseData.freeCreditsRemaining !== undefined) {
        const used = FREE_CREDITS - responseData.freeCreditsRemaining;
        setFreeAiImagesUsed(used);
      }
      
      // Don't clear selection - keep the image so user can enhance again
      // clearSelection();
      setIsGenerating(false);
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      let errorMessage = "Failed to enhance image";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object') {
        if ('message' in err) {
          errorMessage = String(err.message);
        } else if ('error' in err) {
          errorMessage = String(err.error);
        }
      }
      setError(errorMessage);
      setIsGenerating(false);
    }
  };

  const handleLike = (id: string) => {
    setImages((prev) =>
      prev.map((image) =>
        image.id === id
          ? {
              ...image,
              likes: image.isLiked ? image.likes - 1 : image.likes + 1,
              isLiked: !image.isLiked,
            }
          : image
      )
    );
  };


  const handleBuyCredits = async (type: 'small' | 'pack') => {
    // This function is only for authenticated users now
    // Guest users must sign up first
    if (!user) {
      setError('Please sign up to purchase credits');
      setShowSignUpModal(true);
      return;
    }

    try {
      // Store current enhancement state before redirecting to payment
      // First check if there's already a pending enhancement (from handleSubmit)
      const pendingEnhancement = sessionStorage.getItem('pendingEnhancement');
      if (!pendingEnhancement && selectedFile && previewUrl) {
        // Convert file to data URL for storage (synchronously using previewUrl if available)
        const dataUrl = previewUrl;
        sessionStorage.setItem('pendingEnhancement', JSON.stringify({
          imageDataUrl: dataUrl,
          useAI: useAI,
          aiModel: selectedAIModel,
          selectedFilter: selectedFilter,
          timestamp: Date.now()
        }));
      }

      if (type === 'small') {
        // Buy 5 credits for $1 (minimum purchase)
        const response = await fetch(getApiPath('/api/stripe/pay-per-image'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error || 'Failed to create checkout session';
          const errorDetails = errorData.details ? ` (${errorData.details})` : '';
          throw new Error(`${errorMessage}${errorDetails}`);
        }

        const data = await response.json();
        
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        // Buy 50 credits for $5
        const creditPackPriceId = 'price_1ST7PrJtYXMzJCdNlbBY2Fmg';

        const response = await fetch(getApiPath('/api/stripe/checkout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: creditPackPriceId,
            tier: 'credit_pack',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error || 'Failed to create checkout session';
          const errorDetails = errorData.details ? ` (${errorData.details})` : '';
          throw new Error(`${errorMessage}${errorDetails}`);
        }

        const data = await response.json();
        
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    }
  };

  // Guard against errors during Clerk initialization
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
            Image Enhancer
          </h1>
          
          {/* Guest User Display */}
          {isLoaded && !user && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <div 
                className={`inline-flex items-center gap-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 border border-green-200 dark:border-green-800 px-6 py-3 rounded-full ${
                  guestImageCount >= FREE_CREDITS 
                    ? 'cursor-pointer hover:from-green-100 hover:to-blue-100 dark:hover:from-green-900/40 dark:hover:to-blue-900/40 transition-colors' 
                    : ''
                }`}
                onClick={() => {
                  if (guestImageCount >= FREE_CREDITS) {
                    // Set flag to redirect after sign-up
                    sessionStorage.setItem('redirectAfterSignUp', 'true');
                    // Trigger sign-up modal
                    setShowSignUpModal(true);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-800 dark:text-green-300">
                    {guestImageCount >= FREE_CREDITS 
                      ? `You've used all ${FREE_CREDITS} free images. Sign up to get ${FREE_CREDITS} more free credits!`
                      : (
                          <span className="font-bold">
                            Restore {FREE_CREDITS - guestImageCount} images for FREE - No sign-up required!{' '}
                            <Link href="/info" className="underline hover:text-green-900 dark:hover:text-green-200 font-normal">
                              Click here to see what AI can do to restore your photos
                            </Link>
                          </span>
                        )}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          
        </div>

        {/* Form and Examples Side-by-Side, Images below Form */}
        <div className="flex flex-col lg:flex-row gap-6 mb-16">
          {/* Left Column: Form + Images Grid */}
          <div className="flex-1 max-w-2xl lg:max-w-none">
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* File Upload Area */}
            <div className="relative">
              {!previewUrl ? (
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, GIF up to 35MB (auto-compressed if larger)
                    </p>
                  </div>
                  <Input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isGenerating}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  {/* Crop and Undo Buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCropClick}
                      disabled={isGenerating || isCropping}
                      className="flex items-center gap-2"
                    >
                      <Crop className="h-4 w-4" />
                      Crop & Rotate
                    </Button>
                    {croppedImageUrl && !hasUndoneCrop && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUndoCrop}
                        disabled={isGenerating || isCropping}
                        className="flex items-center gap-2"
                      >
                        <Undo2 className="h-4 w-4" />
                        Undo Crop
                      </Button>
                    )}
                  </div>
                  
                  {/* Preview Image */}
                  <div className="relative w-full h-64 rounded-lg overflow-hidden border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filterPreviewUrl || previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain transition-opacity duration-300"
                      style={{ opacity: isApplyingFilter ? 0.7 : 1 }}
                    />
                    {isApplyingFilter && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={clearSelection}
                      disabled={isGenerating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {(filterPreviewUrl || selectedFilter === 'original') && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Preview: {selectedFilter === 'original' ? 'Original' : selectedFilter === 'bw' ? 'B&W' : selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI Enhancement Toggle (Show for all users - Premier, Guests, and Free Users) */}
            {selectedFile && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Enhancement Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={!useAI ? "default" : "outline"}
                    onClick={() => setUseAI(false)}
                    disabled={isGenerating}
                  >
                    Client-Side Filters
                  </Button>
                  <Button
                    type="button"
                    variant={useAI ? "default" : "outline"}
                    onClick={() => setUseAI(true)}
                    disabled={isGenerating}
                    className={useAI ? "bg-gradient-to-r from-purple-600 to-blue-600" : ""}
                  >
                    {!user ? "AI Enhancement" : "AI Enhancement (1 AI Credit)"}
                  </Button>
                </div>
                {useAI && (
                  <div className="space-y-2 mt-2">
                    <label className="text-base font-medium">
                      AI Model:{' '}
                      <Link href="/info#ai-models" className="text-primary hover:underline text-base font-normal">
                        Click <span className="font-bold animate-flash animate-rainbow">here</span> to understand these AI Models
                      </Link>
                    </label>
                    <select
                      value={selectedAIModel}
                      onChange={(e) => setSelectedAIModel(e.target.value as AIModel)}
                      className="w-full p-2 border rounded-md bg-background"
                      disabled={isGenerating}
                    >
                      <optgroup label="🎨 Face Enhancement">
                        <option value="gfpgan">GFPGAN - Professional Face Restoration</option>
                        <option value="codeformer">CodeFormer - Robust Face Enhancement</option>
                      </optgroup>
                      <optgroup label="⬆️ Upscaling">
                        <option value="realesrgan">Real-ESRGAN (2x) - High Quality Standard</option>
                        <option value="esrgan">Real-ESRGAN (2x) - No Face Enhancement</option>
                        <option value="swinir">Real-ESRGAN (3x) - Triple Upscale</option>
                        <option value="bsrgan">Real-ESRGAN (4x) - Maximum Quality</option>
                      </optgroup>
                      <optgroup label="🔧 Restoration & Effects">
                        <option value="photorestorer">Photo Restoration - Fix Old Photos</option>
                        <option value="deoldify">Image Denoising - Remove Noise</option>
                        <option value="clarity">Clarity Upscaler - Crystal Clear (2x)</option>
                      </optgroup>
                      <optgroup label="✨ Special">
                        <option value="rembg">Background Removal - Remove Backgrounds</option>
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>
            )}


            {/* Filter Selection (only for non-AI enhancement) */}
            {selectedFile && !useAI && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {!user 
                    ? (guestImageCount >= FREE_CREDITS 
                        ? "You can still preview for free without the AI. Sign up to get more free AI credits!"
                        : `Choose Filter Style - Restore ${FREE_CREDITS - guestImageCount} images for FREE (no sign-up required):`
                      )
                    : (profile && profile.credits === 0
                        ? "You can still preview for free without the AI, sign up/sign in to explore more"
                        : (
                            <>
                              Choose Filter Style (Free Preview without AI, sign in to use AI to create {profile?.credits || FREE_CREDITS} images for{' '}
                              <span className="font-bold animate-flash animate-rainbow">FREE</span>):
                            </>
                          )
                      )}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  <Button
                    type="button"
                    variant={selectedFilter === 'original' ? "default" : "outline"}
                    onClick={() => handleFilterSelect('original')}
                    disabled={isGenerating || isApplyingFilter}
                  >
                    Original
                  </Button>
                  {(Object.keys(FILTER_PRESETS) as Array<keyof typeof FILTER_PRESETS>).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      variant={selectedFilter === filter ? "default" : "outline"}
                      className="capitalize"
                      onClick={() => handleFilterSelect(filter)}
                      disabled={isGenerating || isApplyingFilter}
                    >
                      {filter === 'bw' ? 'B&W' : filter}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Click any filter to preview - no credits used until you click &quot;Enhance Image&quot;
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isGenerating || !selectedFile}
              className="w-full h-12 text-base font-medium"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Enhancing...
                </>
              ) : (
                "Enhance Image"
              )}
            </Button>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-destructive text-center">{error}</p>
                {error.includes('purchase credits') && user && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.location.href = '/subscriptions'}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Buy 50 Credits ($5)
                    </Button>
                    <Button
                      onClick={() => handleBuyCredits('small')}
                      size="sm"
                      className="flex-1"
                    >
                      Buy 5 Credits ($1)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </form>

            {/* Images Grid - Right below the form */}
            {(images.length > 0 || isGenerating) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {isGenerating && images.length > 0 && <LoadingSkeleton />}
                {images.map((image) => (
                  <EmojiCard
                    key={image.id}
                    id={image.id}
                    imageUrl={image.enhancedUrl}
                    originalUrl={image.originalUrl}
                    prompt={image.prompt}
                    likes={image.likes}
                    isLiked={image.isLiked}
                    onLike={handleLike}
                    createdAt={image.createdAt}
                  />
                ))}
              </div>
            )}

            {/* First generation loading state */}
            {isGenerating && images.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <LoadingSkeleton />
              </div>
            )}
          </div>

          {/* Sidebar - AI Examples Section */}
          <div className="lg:w-80 lg:sticky lg:top-8 lg:h-fit">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <h2 className="text-xl font-bold mb-4 text-center">
                Use AI to restore and enhance your photos
              </h2>
              <div className="space-y-4">
                {/* Original */}
                <div className="text-center">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-muted mb-2">
                    <img
                      src="/assets/original_bw.png"
                      alt="Original"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium">Original</p>
                </div>
                
                {/* GFPGAN */}
                <div className="text-center">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-muted mb-2">
                    <img
                      src="/assets/mom_bw_1-enhanced_gfpgan.png"
                      alt="GFPGAN Enhanced"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium">GFPGAN</p>
                </div>
                
                {/* CodeFormer */}
                <div className="text-center">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-muted mb-2">
                    <img
                      src="/assets/mom_bw-1_codeformer.png"
                      alt="CodeFormer Enhanced"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium">CodeFormer</p>
                </div>
                
                {/* BSRGAN */}
                <div className="text-center">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-muted mb-2">
                    <img
                      src="/assets/emoji-AI---BSRGAN.png"
                      alt="BSRGAN Enhanced"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium">BSRGAN</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {isCropping && previewUrl && (
        <ImageCropper
          imageSrc={previewUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Hidden SignUpButton for programmatic triggering */}
      <div className="hidden">
        <SignUpButton mode="modal">
          <button
            ref={signUpButtonRef}
          />
        </SignUpButton>
      </div>

      {/* Payment Modal - Only for authenticated users (guests must sign up first) */}
      {showPaymentModal && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Purchase Credits</h2>
            <p className="text-muted-foreground mb-4">
              You&apos;ve used all {FREE_CREDITS} free AI credits. Visit the subscriptions page to purchase credits.
            </p>
            
            <div className="space-y-4">
              <Button
                onClick={() => {
                  window.location.href = '/subscriptions';
                }}
                className="w-full"
              >
                Go to Subscriptions
              </Button>
              
              <Button
                onClick={() => {
                  setShowPaymentModal(false);
                  setError(null);
                }}
                variant="ghost"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
