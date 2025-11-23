"use client";

// Credit purchase page - simple page showing credit balance and purchase options
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, CreditCard } from "lucide-react";
import { getApiPath } from "@/lib/api-utils";
import { getFreeCredits } from "@/lib/config";
import type { Profile } from "@/lib/supabase";

export default function SubscriptionsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [images, setImages] = useState<Array<{ prompt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const FREE_CREDITS = getFreeCredits();

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
      return;
    }

    if (isLoaded && user) {
      fetchProfile();
      fetchUserImages();
      
      // Check if user just returned from successful payment
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'true') {
        setPaymentSuccess(true);
        // Wait a moment for webhook to process, then refresh profile multiple times
        // Webhooks can take a few seconds to process
        setTimeout(() => {
          fetchProfile();
          fetchUserImages();
        }, 2000);
        setTimeout(() => {
          fetchProfile();
          fetchUserImages();
        }, 5000);
        setTimeout(() => {
          fetchProfile();
          fetchUserImages();
          setPaymentSuccess(false);
        }, 10000);
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [isLoaded, user, router]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiPath("/api/profile"));
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserImages = async () => {
    try {
      const response = await fetch(getApiPath("/api/images"));
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (err) {
      console.error('Error fetching images:', err);
    }
  };

  const handleBuyCredits = async () => {
    try {
      setPurchasing(true);
      setError(null);
      
      const creditPackPriceId = 'price_1ST7PrJtYXMzJCdNlbBY2Fmg';

      const response = await fetch(getApiPath('/api/stripe/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: creditPackPriceId,
          tier: 'credit_pack',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Credits & Billing</h1>
          <p className="text-muted-foreground">
            Manage your AI credits and purchase more when needed
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {paymentSuccess && (
              <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20">
                <CardContent className="pt-6">
                  <p className="text-green-800 dark:text-green-200 font-medium">
                    Payment successful! Your credits are being processed. If they don't appear, click Refresh.
                  </p>
                </CardContent>
              </Card>
            )}
            {/* Credit Balance */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Credits</CardTitle>
                    <CardDescription>
                      AI credits are used when you enhance images with AI models
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchProfile}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <CreditCard className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    {/* Calculate free credits used and remaining */}
                    {(() => {
                      const aiImages = images.filter(img => img.prompt.startsWith('AI -'));
                      const freeAiImagesUsed = aiImages.length;
                      const freeCreditsRemaining = Math.max(0, FREE_CREDITS - freeAiImagesUsed);
                      const purchasedCredits = profile?.ai_credits || 0;
                      const totalAvailable = freeCreditsRemaining + purchasedCredits;
                      
                      return (
                        <>
                          <p className="text-2xl font-bold">
                            {totalAvailable} AI Credits Available
                          </p>
                          <div className="text-sm text-muted-foreground space-y-1 mt-1">
                            {freeCreditsRemaining > 0 && (
                              <p>• {freeCreditsRemaining} free credit{freeCreditsRemaining !== 1 ? 's' : ''} remaining</p>
                            )}
                            {purchasedCredits > 0 && (
                              <p>• {purchasedCredits} purchased credit{purchasedCredits !== 1 ? 's' : ''}</p>
                            )}
                            {freeCreditsRemaining === 0 && purchasedCredits === 0 && (
                              <p>• {FREE_CREDITS} free credits included for new users (all used)</p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Options */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Credits</CardTitle>
                <CardDescription>
                  Buy more AI credits to continue enhancing your images
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">50 AI Credits</h3>
                      <p className="text-sm text-muted-foreground">
                        Perfect for regular use
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">$5.00</p>
                      <p className="text-sm text-muted-foreground">$0.10 per image</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleBuyCredits}
                  disabled={purchasing}
                  className="w-full"
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    'Purchase 50 Credits for $5'
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* Info */}
            <Card className="mt-6">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">How Credits Work</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• You get {FREE_CREDITS} free AI credits when you sign up</li>
                  <li>• Each AI-enhanced image uses 1 credit</li>
                  <li>• Client-side filters (non-AI) are always free</li>
                  <li>• Credits never expire</li>
                  <li>• You can purchase more credits anytime</li>
                </ul>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <Link href="/" className="text-primary hover:underline">
                ← Back to Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
