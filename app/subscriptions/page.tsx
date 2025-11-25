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
      
      // Check for any unprocessed payments on page load
      const checkForUnprocessedPayments = async () => {
        const sessionId = sessionStorage.getItem('pendingPaymentSessionId');
        if (sessionId) {
          // Wait a bit, then verify
          setTimeout(async () => {
            await verifyPayment(sessionId);
          }, 2000);
        } else {
          // No stored session, but check for recent payments anyway
          setTimeout(async () => {
            const response = await fetch(getApiPath("/api/profile"));
            if (response.ok) {
              const currentProfile = await response.json();
              // If user has 0 credits but made a recent payment, try to verify
              if (currentProfile?.ai_credits === 0) {
                await verifyPayment(); // Will fetch recent payments automatically
              }
            }
          }, 3000);
        }
      };
      
      checkForUnprocessedPayments();
      
      // Check if user just returned from successful payment
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'true' || urlParams.get('payment') === 'success') {
        const paymentType = urlParams.get('type');
        const credits = urlParams.get('credits');
        
        setPaymentSuccess(true);
        
        // Try to get session ID from sessionStorage
        const sessionId = sessionStorage.getItem('pendingPaymentSessionId');
        
        // Refresh profile immediately
        fetchProfile();
        fetchUserImages();
        
        // Wait a moment for webhook, then verify manually if needed
        if (sessionId) {
          setTimeout(async () => {
            // Fetch current profile to check credits
            const response = await fetch(getApiPath("/api/profile"));
            if (response.ok) {
              const currentProfile = await response.json();
              const currentCredits = currentProfile?.ai_credits || 0;
              
              // If credits are still 0 or very low, verify payment manually
              // (assuming user had 0 credits before purchase of 5)
              if (currentCredits < 5) {
                console.log('Credits not updated yet, verifying payment manually...');
                const verified = await verifyPayment(sessionId);
                if (verified) {
                  console.log('Payment verified and credits added manually');
                  await fetchProfile();
                  await fetchUserImages();
                }
              }
            }
          }, 3000);
        }
        
        // Continue refreshing profile multiple times in case webhook processes later
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

  const fetchProfile = async (checkForPayments = false) => {
    try {
      setLoading(true);
      const response = await fetch(getApiPath("/api/profile"));
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      setProfile(data);
      
      // If credits are 0 and we should check for payments, verify recent payments
      if (checkForPayments && (data.ai_credits || 0) === 0) {
        const sessionId = sessionStorage.getItem('pendingPaymentSessionId');
        if (sessionId) {
          // Verify the stored session
          setTimeout(() => verifyPayment(sessionId), 500);
        } else {
          // Check for any recent payments
          setTimeout(() => verifyPayment(), 500);
        }
      }
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

  const handleBuyCredits = async (type: 'small' | 'large' = 'large') => {
    try {
      setPurchasing(true);
      setError(null);
      
      let response;
      
      if (type === 'small') {
        // Purchase 5 credits for $1
        response = await fetch(getApiPath('/api/stripe/pay-per-image'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        // Purchase 50 credits for $5
        const creditPackPriceId = 'price_1ST7PrJtYXMzJCdNlbBY2Fmg';
        response = await fetch(getApiPath('/api/stripe/checkout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: creditPackPriceId,
            tier: 'credit_pack',
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      
      // Store session ID for verification after payment
      if (data.sessionId) {
        sessionStorage.setItem('pendingPaymentSessionId', data.sessionId);
      }
      
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

  const verifyPayment = async (sessionId?: string) => {
    try {
      // If no sessionId provided, try to get recent payments
      if (!sessionId) {
        const paymentsResponse = await fetch(getApiPath('/api/stripe/get-recent-payments'));
        if (paymentsResponse.ok) {
          const paymentsData = await paymentsResponse.json();
          const recentSessions = paymentsData.sessions || [];
          // Try to verify the most recent payment
          if (recentSessions.length > 0) {
            sessionId = recentSessions[0].id;
          }
        }
      }

      if (!sessionId) {
        setError('No payment session found to verify');
        return false;
      }

      const response = await fetch(getApiPath('/api/stripe/verify-payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment verification failed:', errorData);
        setError(errorData.error || 'Failed to verify payment');
        return false;
      }

      const data = await response.json();
      
      if (data.success) {
        // Refresh profile to show updated credits
        await fetchProfile();
        await fetchUserImages();
        // Clear stored session ID
        sessionStorage.removeItem('pendingPaymentSessionId');
        setError(null);
        setPaymentSuccess(true);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify payment');
      return false;
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
                    Payment successful! Your credits are being processed. If they don&apos;t appear, click Refresh.
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
                    onClick={() => fetchProfile(true)}
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
                <div className="grid gap-3 md:grid-cols-2">
                  {/* Small Credit Pack - 5 credits for $1 */}
                  <button
                    onClick={() => handleBuyCredits('small')}
                    disabled={purchasing}
                    className="group relative flex flex-col p-6 border-2 rounded-lg hover:border-primary transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold">5 Credits</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Try it out
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">$1</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        $0.20 per credit
                      </p>
                    </div>
                  </button>
                  
                  {/* Large Credit Pack - 50 credits for $5 */}
                  <button
                    onClick={() => handleBuyCredits('large')}
                    disabled={purchasing}
                    className="group relative flex flex-col p-6 border-2 border-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute top-3 right-3">
                      <span className="text-xs font-semibold bg-primary text-primary-foreground px-2 py-1 rounded">
                        BEST VALUE
                      </span>
                    </div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold">50 Credits</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Most popular
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">$5</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        $0.10 per credit • Save 50%
                      </p>
                    </div>
                  </button>
                </div>
                
                {purchasing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing your purchase...
                  </div>
                )}
              </CardContent>
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
