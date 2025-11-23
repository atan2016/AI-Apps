"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  imageUrl: string;
  originalUrl?: string;
  prompt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  imageUrl,
  originalUrl,
  prompt,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white text-black"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Image container */}
      <div
        className="relative max-w-[95vw] max-h-[95vh] w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
          {/* Images - Side by side if originalUrl exists, single if not */}
          {originalUrl ? (
            <div className="relative flex-1 flex items-center justify-center gap-2 bg-black/50 rounded-lg overflow-hidden p-2">
              {/* Original Image */}
              <div className="relative flex-1 h-full flex flex-col items-center justify-center min-w-0">
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <span className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-sm font-medium px-4 py-2 rounded shadow-lg">
                  Original
                </span>
              </div>
              
              {/* Divider */}
              <div className="w-px h-3/4 bg-white/30 self-center"></div>
              
              {/* Enhanced Image */}
              <div className="relative flex-1 h-full flex flex-col items-center justify-center min-w-0">
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Enhanced"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <span className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-sm font-medium px-4 py-2 rounded shadow-lg">
                  Enhanced
                </span>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={prompt}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {/* Caption */}
          <div className="mt-4 text-center">
            <p className="text-white text-lg font-medium">{prompt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

