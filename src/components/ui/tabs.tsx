"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-xl p-1.5",
      // Light mode
      "bg-muted",
      // Dark mode - metallic style
      "dark:bg-white/[0.03] dark:border dark:border-white/[0.06]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      // Light mode
      "text-muted-foreground hover:text-foreground",
      "data-[state=active]:text-[var(--coral-lo)] data-[state=active]:bg-card data-[state=active]:shadow-sm",
      // Dark mode
      "dark:text-zinc-500 dark:hover:text-zinc-300",
      "dark:data-[state=active]:text-white dark:data-[state=active]:bg-white/[0.08]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

// Animated Tabs with motion indicator (pill style)
interface AnimatedTabsProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

function AnimatedTabs({ tabs, activeTab, onTabChange, className }: AnimatedTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center p-1.5 rounded-xl",
        "bg-muted dark:bg-white/[0.03] dark:border dark:border-white/[0.06]",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
            activeTab === tab.id
              ? "text-[var(--coral-lo)] dark:text-white"
              : "text-muted-foreground hover:text-foreground dark:hover:text-zinc-300"
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="animated-tab-indicator"
              className="absolute inset-0 bg-card dark:bg-white/[0.08] rounded-lg shadow-sm dark:shadow-none dark:border dark:border-white/[0.08]"
              transition={{
                type: "spring",
                bounce: 0.15,
                duration: 0.5,
              }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, AnimatedTabs }
