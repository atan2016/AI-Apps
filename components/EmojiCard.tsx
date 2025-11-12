"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmojiCardProps {
  id: string;
  imageUrl: string;
  prompt: string;
  likes: number;
  isLiked: boolean;
  onLike: (id: string) => void;
}

export function EmojiCard({ 
  id, 
  imageUrl, 
  prompt, 
  likes, 
  isLiked, 
  onLike 
}: EmojiCardProps) {
  const [isHovered, setIsHovered] = useState(false);

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
        <Image
          src={imageUrl}
          alt={prompt}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        
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

