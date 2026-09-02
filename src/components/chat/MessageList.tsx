'use client'

import * as React from 'react'
import { AssistantIdentity } from '@/components/ai-assistant/assistant-identity'
import { MessageItem } from './MessageItem'
import { TypingIndicator } from './TypingIndicator'
import type { ChatMessage } from '@/hooks/use-chat'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const endRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-4 py-4 min-h-0 custom-scrollbar"
    >
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <AssistantIdentity
              size={64}
              variant="folio"
              className="mx-auto mb-4 drop-shadow-sm"
            />
            <p className="text-sm text-foreground font-medium">
              JobSilver AI Assistant
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[250px] mx-auto">
              I can help with job applications, generate answers, and create cover letters.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <TypingIndicator />
        )}

        <div ref={endRef} />
      </div>
    </div>
  )
}
