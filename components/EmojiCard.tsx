"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmojiCardProps {
  id: string;
  imageUrl: string;
  originalUrl?: string;
  prompt: string;
  likes: number;
  isLiked: boolean;
  onLike: (id: string) => void;
}

export function EmojiCard({ 
  id, 
  imageUrl, 
  originalUrl,
  prompt, 
  likes, 
  isLiked, 
  onLike 
}: EmojiCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [imageError, setImageError] = useState(false);

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
      <div className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted">
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
        >
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/90 hover:bg-white text-black"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          {originalUrl && (
            <Button
              size="icon"
              variant="secondary"
              className="bg-white/90 hover:bg-white text-black"
              onClick={() => setShowComparison(!showComparison)}
              title={showComparison ? "Show enhanced only" : "Compare original vs enhanced"}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/90 hover:bg-white text-black"
            onClick={() => onLike(id)}
          >
            <Heart
              className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between gap-2 border-t bg-background">
        <p className="text-sm truncate flex-1">{prompt}</p>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
          <span>{likes}</span>
        </div>
      </div>
    </div>
  );
}

