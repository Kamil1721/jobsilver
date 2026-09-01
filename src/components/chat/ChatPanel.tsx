'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useChat } from '@/hooks/use-chat'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { QuickActions } from './QuickActions'

interface ChatPanelProps {
  onSend: (content: string) => Promise<void>
}

// Page context hints for the AI assistant
const PAGE_CONTEXT_HINTS: Record<string, { title: string; description: string; suggestions: string[] }> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Your job search command center with a kanban board.',
    suggestions: [
      'How do I use the Kanban board?',
      'How do I apply to a job?',
      'What do the columns mean?',
      'How do I filter jobs?',
    ],
  },
  '/profile': {
    title: 'Profile Settings',
    description: 'Manage your personal info, CV, and subscription.',
    suggestions: [
      'How do I upload my CV?',
      'How do I change my subscription?',
      'What formats are supported for CV?',
      'How do I update my information?',
    ],
  },
  '/setup': {
    title: 'Job Preferences Setup',
    description: 'Configure your job search criteria for better matches.',
    suggestions: [
      'What should I set for job preferences?',
      'How do filters affect my matches?',
      'Can I change these settings later?',
      'What is the match threshold?',
    ],
  },
  '/choose-plan': {
    title: 'Choose Plan',
    description: 'Select your subscription plan.',
    suggestions: [
      'What is the difference between Free and Pro?',
      'Is there a free trial?',
      'Can I cancel anytime?',
      'What payment methods are accepted?',
    ],
  },
  '/pricing': {
    title: 'Pricing',
    description: 'Compare subscription plans and features.',
    suggestions: [
      'What features does Pro include?',
      'Is there a free trial?',
      'How does billing work?',
      'Can I switch plans later?',
    ],
  },
  // Note: /jobs pages have their own embedded AI chat, so popup chat is hidden there
}

function getPageContext(pathname: string): typeof PAGE_CONTEXT_HINTS[string] | null {
  // Direct match for known pages (job pages use embedded chat, not popup)
  if (PAGE_CONTEXT_HINTS[pathname]) {
    return PAGE_CONTEXT_HINTS[pathname]
  }
  return null
}

export function ChatPanel({ onSend }: ChatPanelProps) {
  const { isOpen, messages, isStreaming, position, jobContext, pendingQuestion } = useChat()
  const pathname = usePathname()
  // Get page context for hints
  const pageContext = getPageContext(pathname)

  // Position classes for the panel
  const positionClasses: Record<string, string> = {
    'bottom-right': 'bottom-20 right-6',
    'bottom-left': 'bottom-20 left-6',
    'top-right': 'top-20 right-6',
    'top-left': 'top-20 left-6',
  }

  // Handle sending with optional pre-filled content
  const handleSend = async (content: string) => {
    await onSend(content)
  }

  // Generate prompt for pending question
  const pendingPrompt = React.useMemo(() => {
    if (!pendingQuestion) return null
    const base = `Help me answer: "${pendingQuestion.questionLabel}"`
    if (pendingQuestion.currentValue) {
      return `${base}\n\nMy current answer: ${pendingQuestion.currentValue}`
    }
    return base
  }, [pendingQuestion])

  // Hide the floating chat panel on job detail pages (they have their own embedded AI chat)
  if (pathname.startsWith('/jobs/')) {
    return null
  }

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed z-[80] flex flex-col rounded-xl overflow-hidden',
        // Dawn surface — translucent card floating over the app
        'bg-card/95 backdrop-blur-xl border border-border/50',
        'shadow-elevated',
        'w-[400px] h-[600px]',
        // Smooth transition when position changes
        'transition-all duration-300 ease-out',
        // Mobile: full screen
        'max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:max-h-[calc(100vh-2rem)] max-sm:rounded-lg',
        positionClasses[position]
      )}
      role="dialog"
      aria-label="Chat assistant"
    >
      <ChatHeader pageContext={pageContext} />

      {/* Job context indicator */}
      {jobContext && (
        <div className="px-4 py-2 bg-muted border-b border-border text-xs text-muted-foreground flex-shrink-0">
          <span className="font-medium text-foreground">Context:</span> {jobContext.title} at {jobContext.company}
        </div>
      )}

      <MessageList messages={messages} isStreaming={isStreaming} />

      {/* Quick actions when chat is empty or has pending question */}
      {(messages.length === 0 || pendingQuestion) && (
        <QuickActions
          onSelect={handleSend}
          jobContext={jobContext}
          pendingQuestion={pendingPrompt}
          pageContext={pageContext}
        />
      )}

      <MessageInput
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={
          pendingQuestion
            ? 'Ask AI for help with this question...'
            : jobContext
            ? `Ask about ${jobContext.title}...`
            : pageContext
            ? `Ask about ${pageContext.title}...`
            : 'Ask me anything about job applications...'
        }
        initialValue={pendingPrompt || ''}
      />
    </div>
  )
}
