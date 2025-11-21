"use client";

import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiCard } from "@/components/EmojiCard";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ImageCropper } from "@/components/ImageCropper";
import { Loader2, Upload, X, CreditCard, Crop, Undo2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { applyFilters, FILTER_PRESETS } from "@/lib/imageFilters";
import type { Profile } from "@/lib/supabase";
import { isPremierTier } from "@/lib/supabase";
import type { AIModel } from "@/lib/aiEnhancement";
import { getAIModelDisplayName } from "@/lib/aiEnhancement";
import { getApiPath } from "@/lib/api-utils";

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
  const [guestImageCreated, setGuestImageCreated] = useState(false);
  
  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [originalImageBeforeCrop, setOriginalImageBeforeCrop] = useState<string | null>(null);
  const [hasUndoneCrop, setHasUndoneCrop] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rotationAngle, setRotationAngle] = useState(0);
  const [originalFileBeforeCrop, setOriginalFileBeforeCrop] = useState<File | null>(null);

  // Check if user has premier tier
  const isPremierUser = profile && profile.tier.startsWith('premier_');

  // Initialize guest session on mount
  useEffect(() => {
    if (isLoaded && !user) {
      // Only access localStorage on client side
      if (typeof window !== 'undefined') {
        // Check for existing guest session
        const existingSessionId = localStorage.getItem('guestSessionId');
        const existingGuestImage = localStorage.getItem('guestImageCreated') === 'true';
        
        if (existingSessionId) {
          setGuestSessionId(existingSessionId);
          setGuestImageCreated(existingGuestImage);
        } else {
          // Create new guest session
          const newSessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem('guestSessionId', newSessionId);
          localStorage.setItem('guestImageCreated', 'false');
          setGuestSessionId(newSessionId);
          setGuestImageCreated(false);
        }
      }
    }
  }, [isLoaded, user]);

  // Fetch user profile and images on mount
  useEffect(() => {
    if (isLoaded && user) {
      fetchProfile();
      fetchUserImages();
    }
  }, [isLoaded, user]);

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

    // Check if guest has already used their free image
    // Skip this check if test guest mode is enabled
    const ENABLE_TEST_GUEST = process.env.NEXT_PUBLIC_ENABLE_TEST_GUEST === 'true';
    if (!user && guestImageCreated && !ENABLE_TEST_GUEST) {
      setError('You\'ve already used your free image. Please sign up to create more images.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Convert file to data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

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
      
      const requestBody: { imageUrl: string; enhancedUrl?: string; useAI: boolean; aiModel?: AIModel; filterName: string } = {
        imageUrl: dataUrl,
        useAI: useAI,
        aiModel: useAI ? selectedAIModel : undefined,
        filterName: useAI ? getAIModelDisplayName(selectedAIModel) : filterDisplayName,
        enhancedUrl: !useAI ? await (async () => {
          const filterOptions = FILTER_PRESETS[selectedFilter as keyof typeof FILTER_PRESETS];
          return await applyFilters(dataUrl, filterOptions);
        })() : undefined,
      };

      // Send to API for saving (and AI enhancement if requested)
      const requestPayload = {
        ...requestBody,
        guestSessionId: !user ? guestSessionId : undefined,
      };

      const response = await fetch(getApiPath("/api/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      // Get content type to determine how to parse
      const contentType = response.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        // Try to parse as JSON
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails, read as text
          const text = await response.text();
          throw new Error(`Failed to parse response: ${text || response.statusText}`);
        }
      } else {
        // Not JSON - read as text
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text || response.statusText}`);
      }

      // Check if response indicates an error
      if (!response.ok) {
        throw new Error(data.error || `Failed to save enhanced image: ${response.status} ${response.statusText}`);
      }

      // Add the new image to the beginning of the list
      const newImage: ImageData = {
        id: data.imageId || Date.now().toString(),
        originalUrl: dataUrl,
        enhancedUrl: data.imageUrl,
        prompt: useAI ? `AI - ${getAIModelDisplayName(selectedAIModel)}` : filterDisplayName,
        likes: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
      };

      setImages((prev) => [newImage, ...prev]);
      
      // If guest user, mark that they've used their free image
      if (data.isGuest && typeof window !== 'undefined') {
        localStorage.setItem('guestImageCreated', 'true');
        setGuestImageCreated(true);
      }
      
      // Refresh profile to update credits
      if (profile) {
        const updatedProfile = { ...profile };
        if (data.creditsRemaining !== undefined) {
          updatedProfile.credits = data.creditsRemaining;
        }
        if (data.aiCreditsRemaining !== undefined) {
          updatedProfile.ai_credits = data.aiCreditsRemaining;
        }
        setProfile(updatedProfile);
      }
      
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enhance image");
    } finally {
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

  const handleUpgrade = async (tier: 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly') => {
    try {
      const priceIds = {
        // Test mode - Basic plans (client-side filters only)
        weekly: 'price_1SUw6GJtYXMzJCdNZ5NTI75B', // $2.99/week
        monthly: 'price_1SUw6nJtYXMzJCdNEo2C9Z2K', // $5.99/month
        yearly: 'price_1SUw7jJtYXMzJCdNG6QlCFhJ', // $14.99/year
        
        // Test mode - Premier plans (AI enhancement included)
        premier_weekly: 'price_1SUwfWJtYXMzJCdNKfekXIXv', // $6.99/week
        premier_monthly: 'price_1SUw74JtYXMzJCdNdo7CymJs', // $14.99/month
        premier_yearly: 'price_1SUwZsJtYXMzJCdNuoGh5VrV', // $79.00/year
      };

      const response = await fetch(getApiPath('/api/stripe/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: priceIds[tier],
          tier: tier,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Failed to start checkout. Please try again.');
    }
  };

  const handleBuyCredits = async () => {
    try {
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
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Failed to start checkout. Please try again.');
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
              <div className="inline-flex items-center gap-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 border border-green-200 dark:border-green-800 px-6 py-3 rounded-full">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-800 dark:text-green-300">
                    {guestImageCreated 
                      ? 'You\'ve used your free image. Sign up to create more!'
                      : (
                          <span className="font-bold">
                            Create 1 image for FREE - No sign-up required!
                          </span>
                        )}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Credits Display */}
          {user && profile && (
            <div className="mt-6 flex flex-col items-center gap-2">
              {/* Plan Type Badge */}
              {profile.tier !== 'free' && (
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                  {profile.tier === 'weekly' && '⭐ Basic Weekly Plan'}
                  {profile.tier === 'monthly' && '⭐ Basic Monthly Plan'}
                  {profile.tier === 'yearly' && '⭐ Basic Yearly Plan'}
                  {profile.tier === 'premier_weekly' && '👑 Premier Weekly Plan'}
                  {profile.tier === 'premier_monthly' && '👑 Premier Monthly Plan'}
                  {profile.tier === 'premier_yearly' && '👑 Premier Yearly Plan'}
                </div>
              )}
              
              <div className="inline-flex items-center gap-4 bg-muted/50 px-6 py-3 rounded-full">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">
                    {profile.tier === 'free' 
                      ? (profile.credits === 1 
                          ? (
                              <span className="font-bold animate-flash animate-rainbow">
                                You get 1 credit to try for FREE
                              </span>
                            )
                          : profile.credits === 0
                            ? (
                                <button
                                  onClick={() => {
                                    const premierPlan = document.getElementById('premier-plan');
                                    if (premierPlan) {
                                      premierPlan.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                  }}
                                  className="text-primary hover:underline cursor-pointer"
                                >
                                  0 credits remaining - Purchase A Plan
                                </button>
                              )
                            : `${profile.credits} credits remaining`)
                      : isPremierUser
                        ? `${profile.ai_credits} AI credits remaining`
                        : `Unlimited filters`}
                  </span>
                </div>
              </div>
              
              {/* Buy Credits button for Premier users */}
              {isPremierUser && profile.ai_credits < 10 && (
                <Button
                  onClick={handleBuyCredits}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Buy 50 AI Credits - $5
                </Button>
              )}
              
              {/* Change Plan button for paid users */}
              {(profile.tier === 'weekly' || profile.tier === 'monthly' || profile.tier === 'yearly' || isPremierUser) && (
                <Button
                  onClick={() => {
                    // Scroll to plans section or go to subscriptions page
                    const plansSection = document.getElementById('subscription-plans');
                    if (plansSection) {
                      plansSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                      window.location.href = '/subscriptions';
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Change Plan
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Subscription Plans for Guest Users */}
        {isLoaded && !user && (
          <div className="max-w-5xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-center mb-6">
              Choose Your Plan
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Basic Plans */}
              <div className="border rounded-lg p-6 bg-card">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold mb-2">Basic Plan</h3>
                  <p className="text-sm text-muted-foreground">Unlimited client-side filters</p>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Unlimited filter enhancements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    5 filter presets
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Before/after comparison
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Download high-res images
                  </li>
                </ul>
                
                <div className="space-y-2">
                  <Button
                    onClick={() => window.location.href = '/sign-up'}
                    variant="outline"
                    className="w-full"
                  >
                    Weekly - $2.99
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/sign-up'}
                    variant="outline"
                    className="w-full"
                  >
                    Monthly - $5.99
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/sign-up'}
                    variant="outline"
                    className="w-full"
                  >
                    Yearly - $14.99
                  </Button>
                </div>
              </div>

              {/* Premier Plans */}
              <div id="premier-plan" className="border-2 border-purple-500 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  BEST VALUE
                </div>
                
                <div className="text-center mb-4 mt-2">
                  <h3 className="text-xl font-bold mb-2">Premier Plan ⭐</h3>
                  <p className="text-sm text-muted-foreground">AI-powered enhancement + filters</p>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    <strong>100 AI-enhanced images/cycle</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    GFPGAN face enhancement
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Unlimited filter enhancements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Buy more AI credits: $5/50 images
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Priority support
                  </li>
                </ul>
                
                <div className="space-y-2">
                  <Button
                    onClick={() => window.location.href = '/sign-up'}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Weekly - $6.99
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/sign-up'}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Monthly - $14.99
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/sign-up'}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Yearly - $79 ⭐
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Plans for Logged-in Users */}
        {user && profile && !isPremierTier(profile.tier) && (
          <div id="subscription-plans" className="max-w-5xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-center mb-6">
              {profile.tier === 'free' ? 'Choose Your Plan' : profile.tier === 'weekly' || profile.tier === 'monthly' || profile.tier === 'yearly' ? 'Change Your Plan' : 'Upgrade to Premier'}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Basic Plans - Show to free users and Basic plan users (weekly/monthly/yearly) */}
              {(profile.tier === 'free' || profile.tier === 'weekly' || profile.tier === 'monthly' || profile.tier === 'yearly') && (
                <div className="border rounded-lg p-6 bg-card">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold mb-2">Basic Plan</h3>
                  <p className="text-sm text-muted-foreground">Unlimited client-side filters</p>
                  {(profile.tier === 'weekly' || profile.tier === 'monthly' || profile.tier === 'yearly') && (
                    <p className="text-xs text-muted-foreground mt-1">Your current plan</p>
                  )}
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Unlimited filter enhancements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    5 filter presets
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Before/after comparison
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Download high-res images
                  </li>
                </ul>
                
                <div className="space-y-2">
                  <Button
                    onClick={() => handleUpgrade('weekly')}
                    variant={profile.tier === 'weekly' ? "default" : "outline"}
                    className="w-full"
                    disabled={profile.tier === 'weekly'}
                  >
                    {profile.tier === 'weekly' ? '✓ Weekly - $2.99 (Current)' : 'Weekly - $2.99'}
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('monthly')}
                    variant={profile.tier === 'monthly' ? "default" : "outline"}
                    className="w-full"
                    disabled={profile.tier === 'monthly'}
                  >
                    {profile.tier === 'monthly' ? '✓ Monthly - $5.99 (Current)' : 'Monthly - $5.99'}
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('yearly')}
                    variant={profile.tier === 'yearly' ? "default" : "outline"}
                    className="w-full"
                    disabled={profile.tier === 'yearly'}
                  >
                    {profile.tier === 'yearly' ? '✓ Yearly - $14.99 (Current)' : 'Yearly - $14.99'}
                  </Button>
                </div>
              </div>
              )}

              {/* Premier Plans - Show to all non-premier users */}
              <div id="premier-plan" className={`border-2 border-purple-500 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 relative ${profile.tier !== 'free' ? 'md:col-span-2' : ''}`}>
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  BEST VALUE
                </div>
                
                <div className="text-center mb-4 mt-2">
                  <h3 className="text-xl font-bold mb-2">Premier Plan ⭐</h3>
                  <p className="text-sm text-muted-foreground">AI-powered enhancement + filters</p>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    <strong>100 AI-enhanced images/cycle</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    GFPGAN face enhancement
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Unlimited filter enhancements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Buy more AI credits: $5/50 images
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Priority support
                  </li>
                </ul>
                
                <div className="space-y-2">
                  <Button
                    onClick={() => handleUpgrade('premier_weekly')}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Weekly - $6.99
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('premier_monthly')}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Monthly - $14.99
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('premier_yearly')}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Yearly - $79 ⭐
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 24-hour notice - Only show to logged-in users */}
        {user && profile && (
          <div className="max-w-2xl mx-auto mb-12 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
              <strong>⏰ Important:</strong> For privacy reasons your images will be temporarily stored in the backend database for troubleshooting and will be automatically deleted after 24 hours. Please download your enhanced images within this timeframe to keep them permanently.
            </p>
          </div>
        )}

        {/* Form */}
        <div className="max-w-2xl mx-auto mb-16">
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* AI Enhancement Toggle (Premier Users or Guest Users) */}
            {selectedFile && (isPremierUser || (!user && !guestImageCreated)) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Enhancement Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={!useAI ? "default" : "outline"}
                    onClick={() => setUseAI(false)}
                    disabled={isGenerating}
                  >
                    Client-Side Filters (Unlimited)
                  </Button>
                  <Button
                    type="button"
                    variant={useAI ? "default" : "outline"}
                    onClick={() => setUseAI(true)}
                    disabled={isGenerating}
                    className={useAI ? "bg-gradient-to-r from-purple-600 to-blue-600" : ""}
                  >
                    {!user ? "AI Enhancement (FREE)" : "AI Enhancement (1 AI Credit)"}
                  </Button>
                </div>
                {useAI && (
                  <div className="space-y-2 mt-2">
                    <label className="text-sm font-medium">AI Model:</label>
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
                    <p className="text-xs text-center text-purple-600 dark:text-purple-400">
                      {!user 
                        ? `Using ${getAIModelDisplayName(selectedAIModel)} - Free for guest users!`
                        : `Using ${getAIModelDisplayName(selectedAIModel)} - ${profile?.ai_credits} AI credits remaining`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* AI Button for Free Users (not guests) */}
            {selectedFile && !isPremierUser && user && profile && profile.tier === 'free' && (
              <div className="mb-4">
                <Button
                  type="button"
                  onClick={() => {
                    const premierPlan = document.getElementById('premier-plan');
                    if (premierPlan) {
                      premierPlan.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  disabled={isGenerating}
                >
                  AI Enhancement - Upgrade to Premier Plan
                </Button>
              </div>
            )}

            {/* Filter Selection (only for non-AI enhancement) */}
            {selectedFile && !useAI && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {!user 
                    ? (guestImageCreated 
                        ? "You can still preview for free without the AI, sign up/sign in to explore more"
                        : "Choose Filter Style - Create one image for FREE (no sign-up required):"
                      )
                    : (profile && profile.credits === 0
                        ? "You can still preview for free without the AI, sign up/sign in to explore more"
                        : (
                            <>
                              Choose Filter Style (Free Preview without AI, sign in to use AI to create one image for{' '}
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

            {/* AI Enhancement Info (when AI is selected) */}
            {selectedFile && useAI && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-center">
                  <strong>GFPGAN AI Enhancement</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Professional face restoration and enhancement powered by AI
                  </span>
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
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </form>
        </div>

        {/* Images Grid */}
        {(images.length > 0 || isGenerating) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <LoadingSkeleton />
          </div>
        )}
      </div>

      {/* Image Cropper Modal */}
      {isCropping && previewUrl && (
        <ImageCropper
          imageSrc={previewUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
