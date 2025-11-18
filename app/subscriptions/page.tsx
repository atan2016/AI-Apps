"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, CreditCard, Calendar, X, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
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
      const response = await fetch("/api/subscriptions");
      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }
      const data = await response.json();
      setSubscriptionData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      setError(null);
      const response = await fetch("/api/subscriptions", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }

      // Refresh subscription data
      await fetchSubscription();
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setLoadingPortal(true);
      setError(null);
      const response = await fetch("/api/subscriptions/portal", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to open portal");
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open customer portal");
      setLoadingPortal(false);
    }
  };

  const handleSyncSubscription = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await fetch("/api/subscriptions/sync", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync subscription");
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
      setError(err instanceof Error ? err.message : "Failed to sync subscription");
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
                          const response = await fetch("/api/subscriptions/manual-update", {
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
                          const response = await fetch("/api/subscriptions/manual-update", {
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
                        const response = await fetch("/api/subscriptions/debug");
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
                  {subscriptionData.isFree
                    ? "You're currently on the free plan"
                    : `Active subscription details`}
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
                          ${subscriptionData.plan.amount.toFixed(2)}{" "}
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

                      {subscriptionData.nextBillingDate && (
                        <div>
                          <p className="text-sm font-medium mb-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Next Billing Date
                          </p>
                          <p>{formatDate(subscriptionData.nextBillingDate)}</p>
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
                    </div>

                    {subscriptionData.subscription.cancel_at_period_end && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          <strong>Subscription will be cancelled</strong> on{" "}
                          {formatDate(subscriptionData.subscription.current_period_end)}. You'll continue to have
                          access until then.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground">No active subscription found.</p>
                    <Button asChild className="mt-4">
                      <Link href="/">View Plans</Link>
                    </Button>
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
                      Your subscription will remain active until the end of the current billing period. You'll
                      continue to have access to all features until{" "}
                      {subscriptionData.subscription &&
                        formatDate(subscriptionData.subscription.current_period_end)}
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

