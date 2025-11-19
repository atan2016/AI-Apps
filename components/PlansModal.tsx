"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignUpButton, SignInButton, useUser } from "@clerk/nextjs";
import { getApiPath } from "@/lib/api-utils";

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'download' | 'zoom';
}

export function PlansModal({ isOpen, onClose, action }: PlansModalProps) {
  const { user, isLoaded } = useUser();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const actionText = action === 'download' ? 'download images' : 'view full-size images';

  // Price IDs mapping
  const priceIds: { [key: string]: string } = {
    weekly: 'price_1SUw6GJtYXMzJCdNZ5NTI75B', // $2.99/week
    monthly: 'price_1SUw6nJtYXMzJCdNEo2C9Z2K', // $5.99/month
    yearly: 'price_1SUw7jJtYXMzJCdNG6QlCFhJ', // $14.99/year
    premier_weekly: 'price_1SUwfWJtYXMzJCdNKfekXIXv', // $6.99/week
    premier_monthly: 'price_1SUw74JtYXMzJCdNdo7CymJs', // $14.99/month
    premier_yearly: 'price_1SUwZsJtYXMzJCdNuoGh5VrV', // $79.00/year
  };

  const handleCheckout = useCallback(async (tier: string) => {
    if (isProcessingCheckout) return; // Prevent multiple calls
    
    try {
      setIsProcessingCheckout(true);
      const response = await fetch(getApiPath('/api/stripe/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: priceIds[tier],
          tier: tier,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
      setIsProcessingCheckout(false);
    }
  }, [isProcessingCheckout, priceIds]);

  const handlePlanClick = (tier: string) => {
    if (user) {
      // User is already signed in, go directly to checkout
      handleCheckout(tier);
    } else {
      // Store the selected tier in localStorage so it persists across page reloads
      // This ensures the tier is available even if the component unmounts during sign-up
      localStorage.setItem('pendingCheckoutTier', tier);
      setSelectedTier(tier);
    }
  };

  // Handle checkout after user signs up/in
  useEffect(() => {
    if (isLoaded && user && selectedTier && !isProcessingCheckout) {
      setIsProcessingCheckout(true);
      handleCheckout(selectedTier);
      setSelectedTier(null); // Reset after handling
    }
  }, [user, isLoaded, selectedTier, isProcessingCheckout, handleCheckout]);

  // Also check localStorage on mount in case user signed up on a different page
  useEffect(() => {
    if (isLoaded && user && !isProcessingCheckout) {
      const pendingTier = localStorage.getItem('pendingCheckoutTier');
      if (pendingTier) {
        localStorage.removeItem('pendingCheckoutTier');
        setIsProcessingCheckout(true);
        handleCheckout(pendingTier);
      }
    }
  }, [user, isLoaded, isProcessingCheckout, handleCheckout]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold mb-2">Sign Up to {actionText.charAt(0).toUpperCase() + actionText.slice(1)}</h2>
          <p className="text-muted-foreground">
            Please create an account to {actionText}. Choose a plan below to get started.
          </p>
        </div>

        {/* Plans */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Plan</CardTitle>
                <CardDescription>Unlimited client-side filters</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Unlimited filter enhancements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    5 filter presets
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Before/after comparison
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Download high-res images
                  </li>
                </ul>
                
                <div className="space-y-2">
                  {user ? (
                    <>
                      <Button
                        onClick={() => handleCheckout('weekly')}
                        variant="outline"
                        className="w-full"
                      >
                        Weekly - $2.99
                      </Button>
                      <Button
                        onClick={() => handleCheckout('monthly')}
                        variant="outline"
                        className="w-full"
                      >
                        Monthly - $5.99
                      </Button>
                      <Button
                        onClick={() => handleCheckout('yearly')}
                        variant="outline"
                        className="w-full"
                      >
                        Yearly - $14.99
                      </Button>
                    </>
                  ) : (
                    <>
                      <SignUpButton 
                        mode="modal"
                        afterSignUpUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                        afterSignInUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                      >
                        <Button
                          onClick={() => {
                            handlePlanClick('weekly');
                            // Don't prevent default - let SignUpButton handle the modal
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          Weekly - $2.99
                        </Button>
                      </SignUpButton>
                      <SignUpButton 
                        mode="modal"
                        afterSignUpUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                        afterSignInUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                      >
                        <Button
                          onClick={() => {
                            handlePlanClick('monthly');
                            // Don't prevent default - let SignUpButton handle the modal
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          Monthly - $5.99
                        </Button>
                      </SignUpButton>
                      <SignUpButton 
                        mode="modal"
                        afterSignUpUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                        afterSignInUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                      >
                        <Button
                          onClick={() => {
                            handlePlanClick('yearly');
                            // Don't prevent default - let SignUpButton handle the modal
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          Yearly - $14.99
                        </Button>
                      </SignUpButton>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Premier Plan */}
            <Card className="border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                BEST VALUE
              </div>
              <CardHeader className="mt-2">
                <CardTitle>Premier Plan ⭐</CardTitle>
                <CardDescription>AI-powered enhancement + filters</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    <strong>100 AI-enhanced images/cycle</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    GFPGAN face enhancement
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Unlimited filter enhancements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Buy more AI credits: $5/50 images
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-500">✓</span>
                    Priority support
                  </li>
                </ul>
                
                <div className="space-y-2">
                  {user ? (
                    <>
                      <Button
                        onClick={() => handleCheckout('premier_weekly')}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        Weekly - $6.99
                      </Button>
                      <Button
                        onClick={() => handleCheckout('premier_monthly')}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        Monthly - $14.99
                      </Button>
                      <Button
                        onClick={() => handleCheckout('premier_yearly')}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        Yearly - $79 ⭐
                      </Button>
                    </>
                  ) : (
                    <>
                      <SignUpButton 
                        mode="modal"
                        afterSignUpUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                        afterSignInUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                      >
                        <Button
                          onClick={() => {
                            handlePlanClick('premier_weekly');
                            // Don't prevent default - let SignUpButton handle the modal
                          }}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                          Weekly - $6.99
                        </Button>
                      </SignUpButton>
                      <SignUpButton 
                        mode="modal"
                        afterSignUpUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                        afterSignInUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                      >
                        <Button
                          onClick={() => {
                            handlePlanClick('premier_monthly');
                            // Don't prevent default - let SignUpButton handle the modal
                          }}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                          Monthly - $14.99
                        </Button>
                      </SignUpButton>
                      <SignUpButton 
                        mode="modal"
                        afterSignUpUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                        afterSignInUrl={typeof window !== 'undefined' ? window.location.href : '/'}
                      >
                        <Button
                          onClick={() => {
                            handlePlanClick('premier_yearly');
                            // Don't prevent default - let SignUpButton handle the modal
                          }}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                          Yearly - $79 ⭐
                        </Button>
                      </SignUpButton>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          {!user && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <SignInButton mode="modal">
                  <button 
                    className="text-primary hover:underline"
                    onClick={() => {
                      // If a tier was selected, preserve it for after sign-in
                      if (selectedTier) {
                        localStorage.setItem('pendingCheckoutTier', selectedTier);
                      }
                    }}
                  >
                    Sign in
                  </button>
                </SignInButton>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

