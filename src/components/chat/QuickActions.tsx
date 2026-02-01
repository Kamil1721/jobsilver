'use client'

import * as React from 'react'
import { FileText, Lightbulb, Sparkles, ClipboardList, HelpCircle, Settings, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { JobContextPayload } from '@/lib/events/chat-events'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  onSelect: (prompt: string) => void
  jobContext: JobContextPayload | null
  pendingQuestion: string | null
  pageContext?: { title: string; description: string; suggestions: string[] } | null
}

interface QuickAction {
  icon: React.ElementType
  label: string
  prompt: string
}

export function QuickActions({ onSelect, jobContext, pendingQuestion, pageContext }: QuickActionsProps) {
  // If there's a pending question, show the prompt prominently
  if (pendingQuestion) {
    return (
      <div className="px-4 pb-3 flex-shrink-0">
        <p className="text-xs text-muted-foreground mb-2">Suggested prompt:</p>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-start text-left h-auto py-2.5 px-3 whitespace-normal",
            "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12]",
            "transition-colors duration-200"
          )}
          onClick={() => onSelect(pendingQuestion)}
        >
          <Sparkles className="h-4 w-4 mr-2 shrink-0 text-zinc-400" />
          <span className="text-xs text-foreground line-clamp-2">{pendingQuestion}</span>
        </Button>
      </div>
    )
  }

  // Context-aware quick actions based on page or job context
  let actions: QuickAction[]

  if (jobContext) {
    // Job detail page actions
    actions = [
      {
        icon: Lightbulb,
        label: 'Why am I a good fit?',
        prompt: `Analyze why I would be a good fit for the ${jobContext.title} position at ${jobContext.company} based on my CV and experience.`,
      },
      {
        icon: FileText,
        label: 'Generate cover letter',
        prompt: `Write a personalized cover letter for the ${jobContext.title} position at ${jobContext.company}. Make it professional but warm, highlighting my most relevant experience.`,
      },
      {
        icon: ClipboardList,
        label: 'CV suggestions',
        prompt: `What should I emphasize or adjust in my CV for the ${jobContext.title} role at ${jobContext.company}?`,
      },
    ]
  } else if (pageContext) {
    // Page-specific actions based on context (popup chat on Dashboard, Profile, Setup, etc.)
    const pageIcons: Record<string, React.ElementType> = {
      'Dashboard': Search,
      'Profile Settings': Settings,
      'Job Preferences Setup': Settings,
    }
    const PageIcon = pageIcons[pageContext.title] || HelpCircle

    actions = pageContext.suggestions.map((suggestion, index) => ({
      icon: index === 0 ? PageIcon : (index === 1 ? Lightbulb : HelpCircle),
      label: suggestion.length > 30 ? suggestion.substring(0, 27) + '...' : suggestion,
      prompt: suggestion,
    }))
  } else {
    // Default actions for popup chat - website help focused (NOT job-specific help)
    actions = [
      {
        icon: HelpCircle,
        label: 'How do I use this?',
        prompt: "How do I use JobSilver? What features are available?",
      },
      {
        icon: Search,
        label: 'Find jobs',
        prompt: "How do I search and find jobs on JobSilver?",
      },
      {
        icon: Settings,
        label: 'Change settings',
        prompt: "How do I change my job preferences and settings?",
      },
    ]
  }

  return (
    <div className="px-4 pb-3 space-y-2 flex-shrink-0">
      <p className="text-xs text-muted-foreground">
        {pageContext ? `Help with ${pageContext.title}` : 'Quick actions'}
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className={cn(
              "h-auto py-1.5 px-2.5 text-xs",
              "border-border/50 bg-transparent",
              "hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white",
              "transition-colors duration-200"
            )}
            onClick={() => onSelect(action.prompt)}
          >
            <action.icon className="h-3 w-3 mr-1.5 text-zinc-400" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
