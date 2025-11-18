"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Download, Eye, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ImageLightbox";

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
  id, 
  imageUrl, 
  originalUrl,
  prompt, 
  likes, 
  isLiked, 
  onLike,
  createdAt
}: EmojiCardProps) {
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

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emoji-${prompt.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download emoji:", error);
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
        onClick={() => !showComparison && setShowLightbox(true)}
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
              setShowLightbox(true);
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
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/90 hover:bg-white text-black"
            onClick={(e) => {
              e.stopPropagation();
              onLike(id);
            }}
            title="Like"
          >
            <Heart
              className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-2 border-t bg-background">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm truncate flex-1">{prompt}</p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
            <span>{likes}</span>
          </div>
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

