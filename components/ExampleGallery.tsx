"use client";

import Image from "next/image";
import { ExampleImage } from "@/lib/exampleImages";

interface ExampleGalleryProps {
  original: ExampleImage | null;
  filters: ExampleImage[];
  aiModels: ExampleImage[];
}

export function ExampleGallery({ original, filters, aiModels }: ExampleGalleryProps) {
  return (
    <div className="space-y-12">
      {/* Original Image */}
      {original && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold">Original Image</h3>
          <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden border shadow-lg">
            <Image
              src={original.path}
              alt={original.displayName}
              width={800}
              height={600}
              className="w-full h-auto object-contain"
              unoptimized
            />
          </div>
        </div>
      )}

      {/* Client-Side Filters */}
      {filters.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold">Client-Side Filters</h3>
          <p className="text-muted-foreground">
            Instant filters applied directly in your browser - no AI processing required
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filters.map((filter) => (
              <div
                key={filter.name}
                className="group relative rounded-lg overflow-hidden border shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-square bg-muted/30">
                  <Image
                    src={filter.path}
                    alt={filter.displayName}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3 text-center">
                  <p className="font-medium">{filter.displayName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Models */}
      {aiModels.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold">AI Enhancement Models</h3>
          <p className="text-muted-foreground">
            Advanced AI models powered by Replicate - experiment with different models to find the best result
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiModels.map((model) => (
              <div
                key={model.name}
                className="group relative rounded-lg overflow-hidden border shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-square bg-muted/30">
                  <Image
                    src={model.path}
                    alt={model.displayName}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3 text-center">
                  <p className="font-medium">{model.displayName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

