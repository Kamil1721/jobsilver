'use client'

import * as React from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  initialValue?: string
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  initialValue = '',
}: MessageInputProps) {
  const [value, setValue] = React.useState(initialValue)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Update value when initialValue changes (for pending questions)
  React.useEffect(() => {
    if (initialValue) {
      setValue((currentValue) => {
        if (initialValue !== currentValue) {
          return initialValue
        }
        return currentValue
      })
    }
  }, [initialValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [value])

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 p-4 border-t border-border/50 flex-shrink-0 bg-card/50">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'min-h-[44px] max-h-[120px] resize-none text-sm',
          'bg-background/50 border-border/50',
          'hover:border-zinc-500/40 transition-colors duration-200',
          'focus-visible:ring-1 focus-visible:ring-zinc-400/50 focus-visible:border-zinc-400/50',
          'placeholder:text-muted-foreground/60'
        )}
        rows={1}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        className={cn(
          'h-11 w-11 shrink-0 transition-all duration-200 relative overflow-hidden',
          'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700 text-white',
          'hover:from-zinc-600 hover:via-zinc-500 hover:to-zinc-600',
          'disabled:from-zinc-400 disabled:via-zinc-300 disabled:to-zinc-400 disabled:text-zinc-100',
          'shadow-sm hover:shadow-md hover:shadow-zinc-500/25'
        )}
      >
        <Send className="h-4 w-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  )
}
