"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Crown,
  Rocket,
  Sparkles,
  Zap,
  CreditCard,
  Calendar,
  Clock,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SubscriptionPlan, StripeSubscriptionStatus } from "@/lib/supabase/types"

interface SubscriptionInfo {
  plan: SubscriptionPlan
  status: StripeSubscriptionStatus | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEnd: string | null
  isTester: boolean
}

interface SubscriptionManagementProps {
  userId: string
}

const PLAN_DETAILS: Record<
  string,
  {
    name: string
    icon: React.ElementType
    color: string
    bgColor: string
    description: string
    jobsPerDay: number
  }
> = {
  free: {
    name: "Free",
    icon: Zap,
    color: "text-zinc-600 dark:text-zinc-400",
    bgColor: "bg-zinc-100 dark:bg-zinc-800",
    description: "Basic job search",
    jobsPerDay: 3,
  },
  starter: {
    name: "Starter",
    icon: Sparkles,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "For active job seekers",
    jobsPerDay: 10,
  },
  pro: {
    name: "Pro",
    icon: Rocket,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    description: "Best value for job hunters",
    jobsPerDay: 50,
  },
  ultra: {
    name: "Ultra",
    icon: Crown,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    description: "Maximum job search power",
    jobsPerDay: 50,
  },
}

export function SubscriptionManagement({ userId }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = React.useState<SubscriptionInfo | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const router = useRouter()

  // Fetch subscription info
  React.useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/stripe/subscription")
        const data = await response.json()

        if (response.ok && data.data) {
          const sub = data.data.subscription
          setSubscription({
            plan: data.data.plan || "free",
            status: sub?.status || null,
            currentPeriodStart: sub?.currentPeriodStart || null,
            currentPeriodEnd: sub?.currentPeriodEnd || null,
            cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
            trialEnd: sub?.trialEnd || null,
            isTester: data.data.isTester || false,
          })
        } else {
          // Default to free plan
          setSubscription({
            plan: "free",
            status: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            trialEnd: null,
            isTester: false,
          })
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error)
        setSubscription({
          plan: "free",
          status: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          trialEnd: null,
          isTester: false,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscription()
  }, [])

  const handleUpgrade = () => {
    router.push("/choose-plan")
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    return null
  }

  const planInfo = PLAN_DETAILS[subscription.plan] || PLAN_DETAILS.free
  const PlanIcon = planInfo.icon
  const isFreePlan = subscription.plan === "free"
  const isTrialing = subscription.status === "trialing"
  const isPastDue = subscription.status === "past_due"
  const isCanceling = subscription.cancelAtPeriodEnd

  // Calculate days remaining in trial
  const trialDaysRemaining = subscription.trialEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0

  // Calculate days until renewal
  const daysUntilRenewal = subscription.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-zinc-500" />
          Subscription
        </CardTitle>
        <CardDescription>Manage your plan and billing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Display */}
        <div
          className={cn(
            "p-4 rounded-xl border",
            planInfo.bgColor,
            "border-transparent"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  isFreePlan
                    ? "bg-zinc-200 dark:bg-zinc-700"
                    : "bg-white/50 dark:bg-black/20"
                )}
              >
                <PlanIcon className={cn("w-6 h-6", planInfo.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{planInfo.name} Plan</h3>
                  {subscription.isTester && (
                    <Badge
                      variant="outline"
                      className="gap-1 bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                    >
                      <FlaskConical className="w-3 h-3" />
                      Tester
                    </Badge>
                  )}
                  {isTrialing && (
                    <Badge
                      variant="outline"
                      className="gap-1 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                    >
                      <Clock className="w-3 h-3" />
                      Trial
                    </Badge>
                  )}
                  {isCanceling && (
                    <Badge variant="destructive" className="gap-1">
                      Canceling
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {planInfo.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="font-medium">
                    {planInfo.jobsPerDay} jobs/day
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    AI Assistant included
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trial Warning */}
        {isTrialing && trialDaysRemaining > 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}{" "}
                  left in your trial
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your card will be charged when the trial ends.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Past Due Warning */}
        {isPastDue && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Payment past due
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Please update your payment method to continue using premium
                  features.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Canceling Notice */}
        {isCanceling && subscription.currentPeriodEnd && (
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-zinc-600 mt-0.5" />
              <div>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  Subscription ending
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Your subscription will end on{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                  You can reactivate anytime before then.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Billing Info */}
        {!isFreePlan && !subscription.isTester && subscription.currentPeriodEnd && (
          <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-lg border border-zinc-200 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {isCanceling ? "Ends" : "Renews"}{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
            {!isCanceling && (
              <span className="text-xs text-muted-foreground">
                {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""} left
              </span>
            )}
          </div>
        )}

        {/* Tester Notice */}
        {subscription.isTester && (
          <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
            <div className="flex items-start gap-3">
              <FlaskConical className="w-5 h-5 text-violet-600 mt-0.5" />
              <div>
                <p className="font-medium text-violet-800 dark:text-violet-200">
                  Beta Tester Access
                </p>
                <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">
                  You have free access to all Ultra plan features as a beta
                  tester. Thank you for helping us improve!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!subscription.isTester && (
            <Button
              onClick={handleUpgrade}
              className={isFreePlan
                ? "flex-1 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/20"
                : "flex-1"
              }
              variant={isFreePlan ? "default" : "outline"}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              {isFreePlan ? "Upgrade Plan" : "Change Plan"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
