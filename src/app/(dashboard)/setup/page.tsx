"use client"

import * as React from "react"
import { SetupWizard } from "@/components/setup/setup-wizard"

export default function SetupPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-zinc-50/30 dark:to-zinc-950/20">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-zinc-200/20 dark:bg-zinc-800/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-zinc-300/20 dark:bg-zinc-700/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-zinc-200/15 dark:bg-zinc-800/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <SetupWizard />
      </div>
    </div>
  )
}
