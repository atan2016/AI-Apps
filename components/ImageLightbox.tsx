"use client";

import { useEffect } from "react";
import Image from "next/image";
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
          {/* Image */}
          <div className="relative flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
            <Image
              src={imageUrl}
              alt={prompt}
              fill
              className="object-contain"
              sizes="95vw"
              priority
            />
          </div>

          {/* Caption */}
          <div className="mt-4 text-center">
            <p className="text-white text-lg font-medium">{prompt}</p>
            {originalUrl && (
              <p className="text-white/70 text-sm mt-1">
                Enhanced Image
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

