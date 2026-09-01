'use client'

import { Bot } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>
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
