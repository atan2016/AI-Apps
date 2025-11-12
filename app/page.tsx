"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiCard } from "@/components/EmojiCard";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Loader2, Upload, X } from "lucide-react";

interface ImageData {
  id: string;
  originalUrl: string;
  enhancedUrl: string;
  likes: number;
  isLiked: boolean;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: dataUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to enhance image");
      }

      // Add the new image to the beginning of the list
      const newImage: ImageData = {
        id: Date.now().toString(),
        originalUrl: dataUrl,
        enhancedUrl: data.imageUrl,
        likes: 0,
        isLiked: false,
      };

      setImages((prev) => [newImage, ...prev]);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
            Face Enhancer
          </h1>
          <p className="text-muted-foreground">
            Restore and enhance faces in your photos using AI
          </p>
        </div>

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
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
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
                </div>
              )}
            </div>

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
                "Enhance Face"
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
