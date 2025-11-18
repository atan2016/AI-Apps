"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import { getCroppedImg } from "@/lib/imageCropper";
import { RotateCw, RotateCcw, X } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onRotationChange = useCallback((rotation: number) => {
    setRotation(rotation);
  }, []);

  const onCropCompleteCallback = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleApplyCrop = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImageUrl = await getCroppedImg(
        imageSrc,
        {
          x: croppedAreaPixels.x,
          y: croppedAreaPixels.y,
          width: croppedAreaPixels.width,
          height: croppedAreaPixels.height,
        },
        rotation
      );
      onCropComplete(croppedImageUrl);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const rotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-4xl bg-background rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Crop & Rotate Image</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full" style={{ height: "400px" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={undefined}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onRotationChange={onRotationChange}
            onCropComplete={onCropCompleteCallback}
            style={{
              containerStyle: {
                width: "100%",
                height: "100%",
                position: "relative",
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t space-y-4">
          {/* Zoom Control */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground text-center">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Rotation Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rotation</label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={rotateLeft}
                disabled={isProcessing}
                title="Rotate Left"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground text-center mt-1">
                  {rotation}°
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={rotateRight}
                disabled={isProcessing}
                title="Rotate Right"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyCrop}
              disabled={isProcessing || !croppedAreaPixels}
              className="flex-1"
            >
              {isProcessing ? "Processing..." : "Apply Crop"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

