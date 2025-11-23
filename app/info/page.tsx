import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExampleGallery } from "@/components/ExampleGallery";
import { getExampleImages } from "@/lib/exampleImages";

// Info page - accessible without login
import { 
  Sparkles, 
  Crop, 
  RotateCw, 
  Wand2, 
  Download, 
  Eye, 
  Zap,
  Image as ImageIcon,
  Clock
} from "lucide-react";

export default function InfoPage() {
  const { original, filters, aiModels } = getExampleImages();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Transform Your Photos with{" "}
              <span className="text-primary">AI-Powered Enhancement</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              One place to experiment with different AI models and pick the best result.
              Enhance, restore, and perfect your images with cutting-edge technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/">Try It Now</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#examples">View Examples</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to enhance your photos in one place
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Free-form Cropping */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Crop className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Free-form Cropping</h3>
            </div>
            <p className="text-muted-foreground">
              Crop your images exactly how you want with our intuitive cropping tool. 
              Adjust the crop area freely and rotate your photos to get the perfect composition.
            </p>
          </div>

          {/* Feature 2: Free Rotation */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <RotateCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Free Rotation</h3>
            </div>
            <p className="text-muted-foreground">
              Rotate your photos freely from 0 to 360 degrees. Fine-tune the angle 
              with precision controls or use quick 90-degree increments.
            </p>
          </div>

          {/* Feature 3: 10+ AI Models */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wand2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">10+ AI Enhancement Models</h3>
            </div>
            <p className="text-muted-foreground">
              Experiment with multiple AI models including GFPGAN, CodeFormer, Real-ESRGAN variants, 
              BSRGAN, and more. Compare results and choose the best enhancement for your image.
            </p>
          </div>

          {/* Feature 4: Client-Side Filters */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Instant Client-Side Filters</h3>
            </div>
            <p className="text-muted-foreground">
              Apply instant filters like Enhance, Vibrant, Cool, Warm, and B&W directly in your browser. 
              No AI processing required - see results instantly.
            </p>
          </div>

          {/* Feature 5: Before/After Comparison */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Before/After Comparison</h3>
            </div>
            <p className="text-muted-foreground">
              Easily compare your original and enhanced images side-by-side. 
              Toggle between views to see the transformation at a glance.
            </p>
          </div>

          {/* Feature 6: Download High-Res Images */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Download High-Res Images</h3>
            </div>
            <p className="text-muted-foreground">
              Download your enhanced images in high resolution. All processed images 
              are stored securely and available for download.
            </p>
          </div>

          {/* Feature 7: One-Time Undo */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">One-Time Undo</h3>
            </div>
            <p className="text-muted-foreground">
              Made a mistake with cropping? No problem. Use our one-time undo feature 
              to restore your original image and try again.
            </p>
          </div>

          {/* Feature 8: 24-Hour Storage */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">24-Hour Storage</h3>
            </div>
            <p className="text-muted-foreground">
              Your enhanced images are stored securely for 24 hours. Download them anytime 
              within this period. Automatic cleanup keeps storage efficient.
            </p>
          </div>

          {/* Feature 9: Easy to Use */}
          <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Simple & Intuitive</h3>
            </div>
            <p className="text-muted-foreground">
              Upload, enhance, and download - it&apos;s that simple. Our clean interface makes 
              photo enhancement accessible to everyone, no technical skills required.
            </p>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="bg-muted/30 border-t border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">See It In Action</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Compare the original image with enhanced versions using different filters and AI models. 
              Each model produces unique results - experiment to find your perfect match.
            </p>
          </div>
          <ExampleGallery original={original} filters={filters} aiModels={aiModels} />
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="bg-muted/30 border-t">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Common questions about how our service works
            </p>
          </div>

          <div className="space-y-6">
            {/* FAQ Item: What happens to uploaded photos */}
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-xl font-semibold mb-3">
                What happens to my uploaded photos?
              </h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  <strong className="text-foreground">⏰ Important:</strong> For privacy reasons, your images will be temporarily stored in the backend database for troubleshooting purposes only and will be automatically deleted after 24 hours.
                </p>
                <p>
                  Please download your enhanced images within this timeframe to keep them permanently. We recommend downloading your enhanced images immediately after processing to ensure you have a permanent copy.
                </p>
                <p>
                  All images are stored securely and are only accessible to you. The automatic cleanup process runs daily to remove images older than 24 hours, helping us maintain efficient storage and protect your privacy.
                </p>
              </div>
            </div>

            {/* You can add more FAQ items here in the future */}
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to Enhance Your Photos?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start experimenting with different AI models and filters today. 
            Find the perfect enhancement for your images in one place.
          </p>
          <Button asChild size="lg">
            <Link href="/">Get Started Now</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

