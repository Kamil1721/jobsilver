"use client"

import { useSubscription } from "@/contexts/SubscriptionContext"
import {
  type Feature,
  canAccessFeature,
  getRequiredPlan,
  FEATURE_INFO,
} from "@/lib/features/config"
import type { AllSubscriptionPlans } from "@/lib/supabase/types"

interface FeatureAccessResult {
  /** Whether the user has access to this feature */
  hasAccess: boolean
  /** The minimum plan required for this feature */
  requiredPlan: AllSubscriptionPlans
  /** Whether subscription data is still loading */
  isLoading: boolean
  /** Feature display name */
  featureName: string
  /** Feature description */
  featureDescription: string
  /** Show upgrade modal for this feature */
  showUpgradeModal: () => void
}

/**
 * Hook to check if the current user has access to a specific feature
 * based on their subscription plan (testers get ultra-level access)
 */
export function useFeatureAccess(feature: Feature): FeatureAccessResult {
  const { plan, isTester, isLoading } = useSubscription()

  // Testers get ultra-level access to all features
  const hasAccess = canAccessFeature(plan, feature, isTester)
  const requiredPlan = getRequiredPlan(feature)
  const featureInfo = FEATURE_INFO[feature]

  const showUpgradeModal = () => {
    window.dispatchEvent(
      new CustomEvent('show-upgrade-modal', {
        detail: {
          feature,
          requiredPlan,
          featureName: featureInfo.name,
          featureDescription: featureInfo.description,
        },
      })
    )
  }

  return {
    hasAccess,
    requiredPlan,
    isLoading,
    featureName: featureInfo.name,
    featureDescription: featureInfo.description,
    showUpgradeModal,
  }
}
