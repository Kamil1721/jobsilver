'use client'

import { AssistantIdentity } from '@/components/ai-assistant/assistant-identity'

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <AssistantIdentity size={32} variant="folio" />
      <div className="flex items-center rounded-xl rounded-tl-sm bg-muted/50 border border-border/50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce" />
        </div>
      </div>
    </div>
  )
}
