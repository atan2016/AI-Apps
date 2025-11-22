"use client";

import { useState } from "react";
import Image from "next/image";
import { Bookmark, Download, Eye, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useUser, SignInButton } from "@clerk/nextjs";

interface EmojiCardProps {
  id: string;
  imageUrl: string;
  originalUrl?: string;
  prompt: string;
  likes: number;
  isLiked: boolean;
  onLike: (id: string) => void;
  createdAt?: string;
}

export function EmojiCard({ 
  imageUrl, 
  originalUrl,
  prompt, 
  createdAt
}: EmojiCardProps) {
  const { user, isLoaded } = useUser();
  const [isHovered, setIsHovered] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  
  // Calculate hours until deletion (24 hours from creation)
  const getHoursUntilDeletion = (): number | null => {
    if (!createdAt) return null;
    const created = new Date(createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursElapsed;
    return hoursRemaining > 0 ? Math.floor(hoursRemaining) : 0;
  };
  
  const hoursRemaining = getHoursUntilDeletion();
  const isExpiringSoon = hoursRemaining !== null && hoursRemaining <= 6 && hoursRemaining > 0;


  const handleZoom = () => {
    // Allow zoom for all users, including guests
    setShowLightbox(true);
  };

  const handleDownload = async () => {
    // Allow download for all users, including guests

    try {
      // Use proxy endpoint for downloads to handle CORS and authentication issues
      const downloadUrl = `/api/images/download?url=${encodeURIComponent(imageUrl)}`;
      console.log('Attempting to download from:', downloadUrl);
      
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Failed to download: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If response is not JSON, use the status text
        }
        throw new Error(errorMessage);
      }
      
      // Check if response is actually an image
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        // Might be a JSON error response
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid response from server');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enhanced-${prompt.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download image. Please try again.";
      alert(errorMessage);
    }
  };

  return (
    <div
      className="relative flex flex-col rounded-lg border bg-card overflow-hidden shadow-sm transition-all hover:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image container */}
      <div 
        className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted cursor-pointer"
        onClick={() => !showComparison && handleZoom()}
      >
        {showComparison && originalUrl ? (
          // Comparison view: Original vs Enhanced
          <div className="flex h-full w-full">
            <div className="relative w-1/2 border-r-2 border-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Original
              </span>
            </div>
            <div className="relative w-1/2">
              <Image
                src={imageUrl}
                alt="Enhanced"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16.5vw, 10vw"
              />
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Enhanced
              </span>
            </div>
          </div>
                ) : (
                  // Single enhanced view
                  imageError ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-4">
                        <p className="text-sm text-destructive">Failed to load image</p>
                        <p className="text-xs text-muted-foreground mt-1">URL: {imageUrl.substring(0, 50)}...</p>
                      </div>
                    </div>
                  ) : (
                    <Image
                      src={imageUrl}
                      alt={prompt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      onError={() => {
                        console.error("Failed to load image:", imageUrl);
                        setImageError(true);
                      }}
                    />
                  )
                )}
        
        {/* Hover overlay with buttons */}
        <div
          className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity duration-200 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/90 hover:bg-white text-black"
            onClick={(e) => {
              e.stopPropagation();
              handleZoom();
            }}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/90 hover:bg-white text-black"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          {originalUrl && (
            <Button
              size="icon"
              variant="secondary"
              className="bg-white/90 hover:bg-white text-black"
              onClick={(e) => {
                e.stopPropagation();
                setShowComparison(!showComparison);
              }}
              title={showComparison ? "Show enhanced only" : "Compare original vs enhanced"}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {isLoaded && !user && (
            <SignInButton mode="modal">
              <Button
                size="icon"
                variant="secondary"
                className="bg-white/90 hover:bg-white text-black"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                title="Sign in to save"
              >
                <Bookmark className="h-4 w-4" />
              </Button>
            </SignInButton>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-2 border-t bg-background">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm truncate flex-1">{prompt}</p>
        </div>
        {hoursRemaining !== null && hoursRemaining > 0 && (
          <div className={`text-xs px-2 py-1 rounded ${
            isExpiringSoon 
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' 
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {isExpiringSoon 
              ? `⚠️ Download within ${hoursRemaining}h or it will be deleted`
              : `⏰ Download within ${hoursRemaining}h`}
          </div>
        )}
        {hoursRemaining === 0 && (
          <div className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            ⚠️ This image will be deleted soon
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightbox
        imageUrl={imageUrl}
        originalUrl={originalUrl}
        prompt={prompt}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
      />

    </div>
  );
}

