"use client";

// Subscriptions management page - requires authentication
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, CreditCard, Calendar, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { getApiPath } from "@/lib/api-utils";

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    created: string | null;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    canceled_at: string | null;
  } | null;
  plan: {
    priceId: string;
    productName: string;
    amount: number;
    currency: string;
    interval: string;
  } | null;
  tier: string;
  credits: number;
  ai_credits: number;
  nextBillingDate: string | null;
  isFree: boolean;
  error?: string;
}

export default function SubscriptionsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    tier: 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly';
    displayName: string;
    price: string;
  } | null>(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [upgradeSuccessInfo, setUpgradeSuccessInfo] = useState<{
    displayName: string;
    price: string;
    startDate: string;
  } | null>(null);

  // Only show testing features in development
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
      return;
    }

    if (isLoaded && user) {
      fetchSubscription();
    }
  }, [isLoaded, user, router]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiPath("/api/subscriptions"));
      
      // Check if response is OK
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Failed to fetch subscription (${response.status})`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch {
          // If we can't parse the error, use the default message
        }
        throw new Error(errorMessage);
      }
      
      // Check content type before parsing JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      setSubscriptionData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load subscription";
      setError(errorMessage);
      console.error("Error fetching subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      setError(null);
      const response = await fetch(getApiPath("/api/subscriptions"), {
        method: "DELETE",
      });

      // Get content type before reading body
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        let errorMessage = `Failed to cancel subscription (${response.status} ${response.statusText})`;
        try {
          if (contentType.includes("application/json")) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch (parseError) {
          // If we can't parse the error, include status info
          console.error("Error parsing error response:", parseError);
          errorMessage = `Failed to cancel subscription: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Response is OK - parse it
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      
      // Verify we got success response
      if (!data.success) {
        throw new Error(data.error || data.message || "Failed to cancel subscription");
      }

      // Refresh subscription data
      await fetchSubscription();
      setShowCancelConfirm(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to cancel subscription";
      setError(errorMessage);
      console.error("Error cancelling subscription:", err);
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setLoadingPortal(true);
      setError(null);
      const response = await fetch(getApiPath("/api/subscriptions/portal"), {
        method: "POST",
      });

      if (!response.ok) {
        let errorMessage = "Failed to open portal";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to open customer portal";
      setError(errorMessage);
      console.error("Error opening portal:", err);
      setLoadingPortal(false);
    }
  };

  const handleSyncSubscription = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await fetch(getApiPath("/api/subscriptions/sync"), {
        method: "POST",
      });

      if (!response.ok) {
        let errorMessage = "Failed to sync subscription";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      if (data.success) {
        // Refresh subscription data
        await fetchSubscription();
        setError(null);
        // Show success message briefly
        alert(`Subscription synced successfully! Your tier: ${data.tier}`);
      } else {
        const errorMsg = data.message || data.error || "No active subscription found";
        const debugInfo = data.debug ? `\n\nDebug info: ${JSON.stringify(data.debug, null, 2)}` : '';
        setError(errorMsg + debugInfo);
        console.error('Sync failed:', data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync subscription";
      setError(errorMessage);
      console.error("Error syncing subscription:", err);
    } finally {
      setSyncing(false);
    }
  };

  const getTierDisplayName = (tier: string) => {
    const tierMap: { [key: string]: string } = {
      free: "Free",
      weekly: "Basic Weekly",
      monthly: "Basic Monthly",
      yearly: "Basic Yearly",
      premier_weekly: "Premier Weekly",
      premier_monthly: "Premier Monthly",
      premier_yearly: "Premier Yearly",
    };
    return tierMap[tier] || tier;
  };

  // Get the correct display price for a tier (overrides Stripe amount if needed)
  const getTierPrice = (tier: string): number => {
    const priceMap: { [key: string]: number } = {
      weekly: 2.99,
      monthly: 5.99,
      yearly: 14.99,
      premier_weekly: 6.99,
      premier_monthly: 14.99,
      premier_yearly: 79.00,
    };
    return priceMap[tier] || 0;
  };

  // Handle upgrade/downgrade with warning for existing subscriptions
  const handleUpgrade = async (tier: 'weekly' | 'monthly' | 'yearly' | 'premier_weekly' | 'premier_monthly' | 'premier_yearly') => {
    const priceIds: { [key: string]: string } = {
      weekly: 'price_1SUwhiJtYXMzJCdNOBtN0Jm0',
      monthly: 'price_1SUw6nJtYXMzJCdNEo2C9Z2K',
      yearly: 'price_1SUw7jJtYXMzJCdNG6QlCFhJ',
      premier_weekly: 'price_1SUwfWJtYXMzJCdNKfekXIXv',
      premier_monthly: 'price_1SUw74JtYXMzJCdNdo7CymJs',
      premier_yearly: 'price_1SUwZsJtYXMzJCdNuoGh5VrV',
    };

    const prices: { [key: string]: string } = {
      weekly: '$2.99',
      monthly: '$5.99',
      yearly: '$14.99',
      premier_weekly: '$6.99',
      premier_monthly: '$14.99',
      premier_yearly: '$79.00',
    };

    // Check if user has an active subscription
    if (subscriptionData?.subscription?.id) {
      // Show warning modal for existing subscriptions
      setPendingUpgrade({
        tier,
        displayName: getTierDisplayName(tier),
        price: prices[tier] || '',
      });
      setShowUpgradeConfirm(true);
      return;
    }

    // For new subscriptions, use checkout
    try {
      const response = await fetch(getApiPath('/api/stripe/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: priceIds[tier],
          tier: tier,
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else throw new Error('No checkout URL received');
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    }
  };

  const confirmUpgrade = async () => {
    if (!pendingUpgrade) return;

    try {
      setSyncing(true);
      setError(null);
      
      const priceIds: { [key: string]: string } = {
        weekly: 'price_1SUwhiJtYXMzJCdNOBtN0Jm0',
        monthly: 'price_1SUw6nJtYXMzJCdNEo2C9Z2K',
        yearly: 'price_1SUw7jJtYXMzJCdNG6QlCFhJ',
        premier_weekly: 'price_1SUwfWJtYXMzJCdNKfekXIXv',
        premier_monthly: 'price_1SUw74JtYXMzJCdNdo7CymJs',
        premier_yearly: 'price_1SUwZsJtYXMzJCdNuoGh5VrV',
      };

      const response = await fetch(getApiPath('/api/subscriptions/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: priceIds[pendingUpgrade.tier],
          tier: pendingUpgrade.tier,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorMessage = "Failed to update subscription";
        let errorDetails = null;
        
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
          errorDetails = data.details || data.rawError || null;
          
          // If we have detailed error info, append it
          if (errorDetails && errorDetails !== errorMessage) {
            errorMessage = `${errorMessage}: ${errorDetails}`;
          }
          
          // Log full error for debugging
          console.error('Subscription update error:', {
            status: response.status,
            statusText: response.statusText,
            fullData: data,  // Log the entire response
            error: data.error,
            details: data.details,
            type: data.type,
            code: data.code,
            rawError: data.rawError,
          });
        } else {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      if (data.success) {
        await fetchSubscription();
        setShowUpgradeConfirm(false);
        const renewalDate = subscriptionData?.nextBillingDate 
          ? formatDate(subscriptionData.nextBillingDate) 
          : 'end of your current billing period';
        const upgradeInfo = pendingUpgrade;
        if (upgradeInfo) {
          setUpgradeSuccessInfo({
            displayName: upgradeInfo.displayName,
            price: upgradeInfo.price,
            startDate: renewalDate,
          });
          setShowUpgradeSuccess(true);
        }
        setPendingUpgrade(null);
      } else {
        throw new Error(data.message || 'Failed to update subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
      console.error('Error updating subscription:', err);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Invalid date';
    try {
      const date = new Date(dateString);
      // Check if date is valid and not epoch (timestamp 0)
      if (isNaN(date.getTime()) || date.getTime() <= 0) {
        return 'Invalid date';
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      console.error('Error formatting date:', e, dateString);
      return 'Invalid date';
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
          <p className="text-muted-foreground">Manage your subscription, billing, and payment methods</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncSubscription}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Syncing...
                </>
              ) : (
                "Sync Subscription"
              )}
            </Button>
          </div>
        )}

        {/* Sync button for free tier users who just purchased */}
        {subscriptionData && subscriptionData.isFree && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                    Just purchased a subscription?
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Click below to sync your subscription status from Stripe
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSyncSubscription}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Syncing...
                    </>
                  ) : (
                    "Sync Subscription"
                  )}
                </Button>
              </div>
              {/* Only show testing section in development */}
              {isDevelopment && (
                <div className="pt-3 border-t border-blue-200 dark:border-blue-800 space-y-3">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                      Quick fix: Manually update your tier (for testing):
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            setSyncing(true);
                            setError(null);
                            const response = await fetch(getApiPath("/api/subscriptions/manual-update"), {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ tier: "premier_yearly" }),
                            });

                            const data = await response.json();
                            if (data.success) {
                              await fetchSubscription();
                              setError(null);
                              alert("Updated to Premier Yearly tier!");
                            } else {
                              setError(data.message || "Failed to update");
                            }
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to update");
                          } finally {
                            setSyncing(false);
                          }
                        }}
                        disabled={syncing}
                        className="text-xs"
                      >
                        Set to Premier Yearly
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            setSyncing(true);
                            setError(null);
                            const response = await fetch(getApiPath("/api/subscriptions/manual-update"), {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ tier: "premier_weekly" }),
                            });

                            const data = await response.json();
                            if (data.success) {
                              await fetchSubscription();
                              setError(null);
                              alert("Updated to Premier Weekly tier!");
                            } else {
                              setError(data.message || "Failed to update");
                            }
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to update");
                          } finally {
                            setSyncing(false);
                          }
                        }}
                        disabled={syncing}
                        className="text-xs"
                      >
                        Set to Premier Weekly
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setSyncing(true);
                          setError(null);
                          const response = await fetch(getApiPath("/api/subscriptions/debug"));
                          if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                          }
                          const data = await response.json();
                          console.log("=== STRIPE DEBUG INFO ===", data);
                          console.table(data.subscriptions || []);
                          console.table(data.subscriptionsByCustomerId || []);
                          console.table(data.checkoutSessions || []);
                          // Also show in alert for easy viewing
                          const summary = {
                            profile: data.profile,
                            subscriptionsFound: (data.subscriptions || []).length,
                            subscriptions: data.subscriptions || data.subscriptionsByCustomerId || [],
                            checkoutSessions: data.checkoutSessions || [],
                          };
                          alert("Debug info logged to console!\n\nSummary:\n" + JSON.stringify(summary, null, 2) + "\n\nCheck browser DevTools (F12) → Console tab for full details");
                          setError(null);
                        } catch (err) {
                          console.error("Debug fetch error:", err);
                          setError(err instanceof Error ? err.message : "Failed to fetch debug info");
                        } finally {
                          setSyncing(false);
                        }
                      }}
                      disabled={syncing}
                      className="text-xs"
                    >
                      View Stripe Debug Info
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {subscriptionData && (
          <>
            {/* Current Subscription Status */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  {subscriptionData.tier === 'free'
                    ? "You're currently on the free plan"
                    : subscriptionData.subscription
                    ? `Active subscription details`
                    : `Your ${getTierDisplayName(subscriptionData.tier)} plan`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscriptionData.isFree ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold">{getTierDisplayName(subscriptionData.tier)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {subscriptionData.credits} filter credits remaining
                        {subscriptionData.ai_credits > 0 && ` • ${subscriptionData.ai_credits} AI credits remaining`}
                      </p>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-4">
                        Upgrade to unlock unlimited filters and AI enhancement features
                      </p>
                      <Button asChild>
                        <Link href="/">View Plans</Link>
                      </Button>
                    </div>
                  </div>
                ) : subscriptionData.subscription && subscriptionData.plan ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold">{subscriptionData.plan.productName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getTierDisplayName(subscriptionData.tier)} Plan
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm font-medium mb-1">Billing Amount</p>
                        <p className="text-lg">
                          ${getTierPrice(subscriptionData.tier).toFixed(2)}{" "}
                          <span className="text-sm text-muted-foreground">
                            / {subscriptionData.plan.interval}
                          </span>
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-1">Status</p>
                        <div className="flex items-center gap-2">
                          {subscriptionData.subscription.status === "active" &&
                          !subscriptionData.subscription.cancel_at_period_end ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">Active</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <span className="text-yellow-600 dark:text-yellow-400">
                                {subscriptionData.subscription.cancel_at_period_end
                                  ? "Cancelling at period end"
                                  : "Inactive"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {subscriptionData.subscription.created && (
                        <div>
                          <p className="text-sm font-medium mb-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Subscription Started
                          </p>
                          <p className="text-sm">{formatDate(subscriptionData.subscription.created)}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-medium mb-1">Auto Renewal</p>
                        <div className="flex items-center gap-2">
                          {subscriptionData.subscription.cancel_at_period_end ? (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <span className="text-yellow-600 dark:text-yellow-400">Off (Cancelling at period end)</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">On</span>
                            </>
                          )}
                        </div>
                      </div>

                      {subscriptionData.nextBillingDate && (
                        <div>
                          <p className="text-sm font-medium mb-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Next Billing Date
                          </p>
                          <p className="text-sm">{formatDate(subscriptionData.nextBillingDate)}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-medium mb-1">Credits</p>
                        <p className="text-sm">
                          {subscriptionData.credits === 999999
                            ? "Unlimited"
                            : `${subscriptionData.credits} filter credits`}
                          {subscriptionData.ai_credits > 0 && ` • ${subscriptionData.ai_credits} AI credits`}
                        </p>
                      </div>
                      
                      {/* Debug: Show Price ID */}
                      {subscriptionData.plan.priceId && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Price ID (for debugging):</p>
                          <p className="text-xs font-mono text-muted-foreground break-all">
                            {subscriptionData.plan.priceId}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Stripe Amount: ${subscriptionData.plan.amount.toFixed(2)} | Display Amount: ${getTierPrice(subscriptionData.tier).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Upgrade Options for Weekly/Monthly Plans */}
                    {subscriptionData.subscription.status === "active" && 
                     !subscriptionData.subscription.cancel_at_period_end && (
                      <div className="pt-4 border-t">
                        {subscriptionData.tier === 'weekly' && (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Upgrade to save more:</p>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpgrade('monthly')}
                              >
                                Upgrade to Monthly - $5.99
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpgrade('yearly')}
                              >
                                Upgrade to Yearly - $14.99
                              </Button>
                            </div>
                          </div>
                        )}
                        {subscriptionData.tier === 'premier_weekly' && (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Upgrade to save more:</p>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpgrade('premier_monthly')}
                              >
                                Upgrade to Premier Monthly - $14.99
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpgrade('premier_yearly')}
                              >
                                Upgrade to Premier Yearly - $79
                              </Button>
                            </div>
                          </div>
                        )}
                        {subscriptionData.tier === 'monthly' && (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Upgrade to save more:</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpgrade('yearly')}
                            >
                              Upgrade to Yearly - $14.99
                            </Button>
                          </div>
                        )}
                        {subscriptionData.tier === 'premier_monthly' && (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Upgrade to save more:</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpgrade('premier_yearly')}
                            >
                              Upgrade to Premier Yearly - $79
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {subscriptionData.subscription.cancel_at_period_end && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          <strong>Subscription will be cancelled</strong> on{" "}
                          {(() => {
                            const endDate = subscriptionData.nextBillingDate || subscriptionData.subscription?.current_period_end;
                            const formatted = formatDate(endDate);
                            return formatted !== 'Invalid date' ? formatted : 'the end of your current billing period';
                          })()}
                          . You&apos;ll continue to have access until then.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold">{getTierDisplayName(subscriptionData.tier)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {subscriptionData.credits === 999999
                          ? "Unlimited"
                          : `${subscriptionData.credits} filter credits`}
                        {subscriptionData.ai_credits > 0 && ` • ${subscriptionData.ai_credits} AI credits`}
                      </p>
                    </div>
                    {subscriptionData.error && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          {subscriptionData.error}
                        </p>
                      </div>
                    )}
                    
                    {/* Upgrade Options - Show even when subscription data isn't fully loaded */}
                    {subscriptionData.tier === 'weekly' && (
                      <div className="pt-4 border-t space-y-3">
                        <p className="text-sm font-medium">Upgrade to save more:</p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const priceIds: { [key: string]: string } = {
                                  monthly: 'price_1SUw6nJtYXMzJCdNEo2C9Z2K',
                                  yearly: 'price_1SUw7jJtYXMzJCdNG6QlCFhJ',
                                };
                                const response = await fetch(getApiPath('/api/stripe/checkout'), {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    priceId: priceIds.monthly,
                                    tier: 'monthly',
                                  }),
                                });
                                if (!response.ok) throw new Error('Failed to create checkout session');
                                const data = await response.json();
                                if (data.url) window.location.href = data.url;
                              } catch (error) {
                                console.error('Error upgrading:', error);
                                setError(error instanceof Error ? error.message : 'Failed to upgrade');
                              }
                            }}
                          >
                            Upgrade to Monthly - $5.99
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const priceIds: { [key: string]: string } = {
                                  yearly: 'price_1SUw7jJtYXMzJCdNG6QlCFhJ',
                                };
                                const response = await fetch(getApiPath('/api/stripe/checkout'), {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    priceId: priceIds.yearly,
                                    tier: 'yearly',
                                  }),
                                });
                                if (!response.ok) throw new Error('Failed to create checkout session');
                                const data = await response.json();
                                if (data.url) window.location.href = data.url;
                              } catch (error) {
                                console.error('Error upgrading:', error);
                                setError(error instanceof Error ? error.message : 'Failed to upgrade');
                              }
                            }}
                          >
                            Upgrade to Yearly - $14.99
                          </Button>
                        </div>
                      </div>
                    )}
                    {subscriptionData.tier === 'premier_weekly' && (
                      <div className="pt-4 border-t space-y-3">
                        <p className="text-sm font-medium">Upgrade to save more:</p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpgrade('premier_monthly')}
                          >
                            Upgrade to Premier Monthly - $14.99
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpgrade('premier_yearly')}
                          >
                            Upgrade to Premier Yearly - $79
                          </Button>
                        </div>
                      </div>
                    )}
                    {subscriptionData.tier === 'monthly' && (
                      <div className="pt-4 border-t space-y-3">
                        <p className="text-sm font-medium">Upgrade to save more:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpgrade('yearly')}
                        >
                          Upgrade to Yearly - $14.99
                        </Button>
                      </div>
                    )}
                    {subscriptionData.tier === 'premier_monthly' && (
                      <div className="pt-4 border-t space-y-3">
                        <p className="text-sm font-medium">Upgrade to save more:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpgrade('premier_yearly')}
                        >
                          Upgrade to Premier Yearly - $79
                        </Button>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-4">
                        {subscriptionData.error 
                          ? "Please sync your subscription to view full details and subscription dates."
                          : "Subscription details are being synced. Please sync to view subscription dates."}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleSyncSubscription}
                          disabled={syncing}
                        >
                          {syncing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Syncing...
                            </>
                          ) : (
                            "Sync Subscription"
                          )}
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/">View Plans</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              {!subscriptionData.isFree && subscriptionData.subscription && (
                <CardFooter className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={handleOpenPortal}
                    disabled={loadingPortal}
                    className="flex items-center gap-2"
                  >
                    {loadingPortal ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Manage Payment Methods
                  </Button>
                  {subscriptionData.subscription.status === "active" &&
                    !subscriptionData.subscription.cancel_at_period_end && (
                      <Button
                        variant="destructive"
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={cancelling}
                      >
                        Cancel Subscription
                      </Button>
                    )}
                </CardFooter>
              )}
            </Card>

            {/* Upgrade/Change Plan Section */}
            {subscriptionData && !subscriptionData.isFree && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Change Your Plan</CardTitle>
                  <CardDescription>
                    Upgrade or downgrade your subscription plan
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const currentTier = subscriptionData.tier;
                    const isBasicPlan = currentTier === 'weekly' || currentTier === 'monthly' || currentTier === 'yearly';
                    const isPremierPlan = currentTier.startsWith('premier_');

                    return (
                      <div className="space-y-6">
                        {/* Basic Plans - Show if user has Basic plan */}
                        {isBasicPlan && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">Basic Plans</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Button
                                onClick={() => handleUpgrade('weekly')}
                                variant={currentTier === 'weekly' ? 'default' : 'outline'}
                                className="w-full"
                                disabled={currentTier === 'weekly'}
                              >
                                {currentTier === 'weekly' ? '✓ Weekly - $2.99 (Current)' : 'Weekly - $2.99'}
                              </Button>
                              <Button
                                onClick={() => handleUpgrade('monthly')}
                                variant={currentTier === 'monthly' ? 'default' : 'outline'}
                                className="w-full"
                                disabled={currentTier === 'monthly'}
                              >
                                {currentTier === 'monthly' ? '✓ Monthly - $5.99 (Current)' : 'Monthly - $5.99'}
                              </Button>
                              <Button
                                onClick={() => handleUpgrade('yearly')}
                                variant={currentTier === 'yearly' ? 'default' : 'outline'}
                                className="w-full"
                                disabled={currentTier === 'yearly'}
                              >
                                {currentTier === 'yearly' ? '✓ Yearly - $14.99 (Current)' : 'Yearly - $14.99'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Premier Plans - Show to all non-premier users */}
                        {!isPremierPlan && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">Premier Plans ⭐</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Button
                                onClick={() => handleUpgrade('premier_weekly')}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                              >
                                Weekly - $6.99
                              </Button>
                              <Button
                                onClick={() => handleUpgrade('premier_monthly')}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                              >
                                Monthly - $14.99
                              </Button>
                              <Button
                                onClick={() => handleUpgrade('premier_yearly')}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                              >
                                Yearly - $79 ⭐
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Premier Plans - Show if user has Premier plan (to change between premier tiers) */}
                        {isPremierPlan && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">Premier Plans (Current)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Button
                                onClick={() => handleUpgrade('premier_weekly')}
                                variant={currentTier === 'premier_weekly' ? 'default' : 'outline'}
                                className="w-full"
                                disabled={currentTier === 'premier_weekly'}
                              >
                                {currentTier === 'premier_weekly' ? '✓ Weekly - $6.99 (Current)' : 'Weekly - $6.99'}
                              </Button>
                              <Button
                                onClick={() => handleUpgrade('premier_monthly')}
                                variant={currentTier === 'premier_monthly' ? 'default' : 'outline'}
                                className="w-full"
                                disabled={currentTier === 'premier_monthly'}
                              >
                                {currentTier === 'premier_monthly' ? '✓ Monthly - $14.99 (Current)' : 'Monthly - $14.99'}
                              </Button>
                              <Button
                                onClick={() => handleUpgrade('premier_yearly')}
                                variant={currentTier === 'premier_yearly' ? 'default' : 'outline'}
                                className="w-full"
                                disabled={currentTier === 'premier_yearly'}
                              >
                                {currentTier === 'premier_yearly' ? '✓ Yearly - $79 (Current)' : 'Yearly - $79 ⭐'}
                              </Button>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                              <h3 className="text-lg font-semibold mb-3">Basic Plans (Downgrade)</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Button
                                  onClick={() => handleUpgrade('weekly')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  Weekly - $2.99
                                </Button>
                                <Button
                                  onClick={() => handleUpgrade('monthly')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  Monthly - $5.99
                                </Button>
                                <Button
                                  onClick={() => handleUpgrade('yearly')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  Yearly - $14.99
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Upgrade Confirmation Modal */}
            {showUpgradeConfirm && pendingUpgrade && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Confirm Plan Change
                    </CardTitle>
                    <CardDescription>
                      You&apos;re about to change your subscription plan
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        Important: Plan changes take effect at the end of your current billing period
                      </p>
                      <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                        <li>Your current plan will remain active until {subscriptionData?.nextBillingDate ? formatDate(subscriptionData.nextBillingDate) : 'the end of your billing period'}</li>
                        <li>The new plan ({pendingUpgrade.displayName} - {pendingUpgrade.price}) will start on your next billing date</li>
                        <li>You&apos;ll be charged the new amount on your next billing cycle</li>
                        <li>No prorated charges will be applied</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Current Plan:</span> {getTierDisplayName(subscriptionData?.tier || 'free')}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">New Plan:</span> {pendingUpgrade.displayName} - {pendingUpgrade.price}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowUpgradeConfirm(false);
                        setPendingUpgrade(null);
                      }}
                      disabled={syncing}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmUpgrade}
                      disabled={syncing}
                      className="bg-primary"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        'Confirm Change'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            {/* Upgrade Success Modal */}
            {showUpgradeSuccess && upgradeSuccessInfo && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      🎉 Awesome! You&apos;ve successfully upgraded!
                    </CardTitle>
                    <CardDescription>
                      Congratulations on your upgrade!
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-3">
                        Your upgrade is confirmed!
                      </p>
                      <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
                        <p>
                          <span className="font-medium">New Plan:</span> {upgradeSuccessInfo.displayName} - {upgradeSuccessInfo.price}
                        </p>
                        <p>
                          <span className="font-medium">Starts On:</span> {upgradeSuccessInfo.startDate}
                        </p>
                        <p className="text-xs mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                          Your current plan will remain active until then. You&apos;ll be charged the new amount on your next billing cycle.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2 justify-end">
                    <Button
                      onClick={() => {
                        setShowUpgradeSuccess(false);
                        setUpgradeSuccessInfo(null);
                      }}
                      className="bg-primary"
                    >
                      Awesome!
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Cancel Subscription
                    </CardTitle>
                    <CardDescription>
                      Are you sure you want to cancel your subscription?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Your subscription will remain active until the end of the current billing period. You&apos;ll
                      continue to have access to all features until{" "}
                      {(() => {
                        const endDate = subscriptionData.nextBillingDate || subscriptionData.subscription?.current_period_end;
                        const formatted = formatDate(endDate);
                        return formatted !== 'Invalid date' ? formatted : 'the end of your current billing period';
                      })()}
                      . After that, your account will be downgraded to the free plan.
                    </p>
                  </CardContent>
                  <CardFooter className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelling}
                    >
                      Keep Subscription
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Cancelling...
                        </>
                      ) : (
                        "Yes, Cancel Subscription"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle>Billing & Payment Management</CardTitle>
                <CardDescription>Manage your billing and view invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  The Stripe Customer Portal allows you to:
                </p>
                <ul className="text-sm text-muted-foreground mb-4 space-y-1 list-disc list-inside">
                  <li>View and download invoices</li>
                  <li>Update payment methods</li>
                  <li>View billing history</li>
                  <li>Update billing information</li>
                </ul>
                <Button variant="outline" onClick={handleOpenPortal} disabled={loadingPortal || subscriptionData.isFree}>
                  {loadingPortal ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Opening...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Customer Portal
                    </>
                  )}
                </Button>
                {subscriptionData.isFree && (
                  <p className="text-xs text-muted-foreground mt-2">
                    You need an active subscription to access the customer portal.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

