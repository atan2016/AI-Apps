"use client";

import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiCard } from "@/components/EmojiCard";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Loader2, Upload, X, CreditCard } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { applyFilters, FILTER_PRESETS } from "@/lib/imageFilters";

interface Profile {
  user_id: string;
  tier: 'free' | 'weekly' | 'monthly' | 'yearly';
  credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ImageData {
  id: string;
  originalUrl: string;
  enhancedUrl: string;
  likes: number;
  isLiked: boolean;
}

export default function Home() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterPreviewUrl, setFilterPreviewUrl] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<keyof typeof FILTER_PRESETS>('enhance');
  const [images, setImages] = useState<ImageData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile and images on mount
  useEffect(() => {
    if (isLoaded && user) {
      fetchProfile();
      fetchUserImages();
    } else if (isLoaded && !user) {
      setIsLoadingProfile(false);
    }
  }, [isLoaded, user]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchUserImages = async () => {
    try {
      const response = await fetch('/api/images');
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setSelectedFile(file);
      setError(null);
      
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
  };

  // Handle filter selection with live preview
  const handleFilterSelect = async (filter: keyof typeof FILTER_PRESETS) => {
    setSelectedFilter(filter);
    
    if (!previewUrl) return;
    
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

      // Apply filters client-side
      const filterOptions = FILTER_PRESETS[selectedFilter];
      const enhancedDataUrl = await applyFilters(dataUrl, filterOptions);

      // Send both original and enhanced to API for saving
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageUrl: dataUrl,
          enhancedUrl: enhancedDataUrl 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save enhanced image");
      }

      // Add the new image to the beginning of the list
      const newImage: ImageData = {
        id: data.imageId || Date.now().toString(),
        originalUrl: dataUrl,
        enhancedUrl: data.imageUrl,
        likes: 0,
        isLiked: false,
      };

      setImages((prev) => [newImage, ...prev]);
      
      // Refresh profile to update credits
      if (data.creditsRemaining !== undefined && profile) {
        setProfile({ ...profile, credits: data.creditsRemaining });
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

  const handleUpgrade = async (tier: 'weekly' | 'monthly' | 'yearly') => {
    try {
      const priceIds = {
        weekly: 'price_1SSsLiJtYXMzJCdN3oQB39hZ',
        monthly: 'price_1SSsMCJtYXMzJCdN1xaQfKmu',
        yearly: 'price_1SSsNbJtYXMzJCdNcdAOA1ZK',
      };

      const response = await fetch('/api/stripe/checkout', {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
            Image Enhancer
          </h1>
          
          {/* Credits Display */}
          {user && profile && (
            <div className="mt-6 inline-flex items-center gap-4 bg-muted/50 px-6 py-3 rounded-full">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="font-medium">
                  {profile.tier === 'free' 
                    ? `${profile.credits} credits remaining`
                    : `${profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)} Plan - Unlimited credits`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Subscription Plans */}
        {user && profile && profile.tier === 'free' && (
          <div className="max-w-2xl mx-auto mb-12 text-center">
            <p className="text-muted-foreground mb-4">
              Upgrade for unlimited image enhancements
            </p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => handleUpgrade('weekly')}
                variant="outline"
                size="lg"
              >
                Weekly - $4.99
              </Button>
              <Button
                onClick={() => handleUpgrade('monthly')}
                size="lg"
              >
                Monthly - $20.99
              </Button>
              <Button
                onClick={() => handleUpgrade('yearly')}
                variant="default"
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Yearly - $275 ⭐
              </Button>
            </div>
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
                      PNG, JPG, GIF up to 10MB
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
                  {filterPreviewUrl && (
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Preview: {selectedFilter === 'bw' ? 'B&W' : selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filter Selection */}
            {selectedFile && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Choose Enhancement Style (Free Preview):</label>
                <div className="grid grid-cols-5 gap-2">
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
                prompt={new URL(image.originalUrl).hostname}
                likes={image.likes}
                isLiked={image.isLiked}
                onLike={handleLike}
              />
            ))}
          </div>
        )}

        {/* Empty state with initial loading */}
        {images.length === 0 && !isGenerating && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              Upload an image to enhance your first photo
            </p>
          </div>
        )}
        
        {/* First generation loading state */}
        {isGenerating && images.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <LoadingSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}
