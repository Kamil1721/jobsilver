'use client'

import * as React from 'react'
import { GripVertical, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssistantIdentity } from '@/components/ai-assistant/assistant-identity'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useChat, closeChat, setPosition, clearMessages } from '@/hooks/use-chat'
import type { ChatState } from '@/hooks/use-chat'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  pageContext?: { title: string; description: string } | null
}

export function ChatHeader({ pageContext }: ChatHeaderProps) {
  const { position, messages } = useChat()

  const positionLabels: Record<ChatState['position'], string> = {
    'bottom-right': 'Bottom Right',
    'bottom-left': 'Bottom Left',
    'top-right': 'Top Right',
    'top-left': 'Top Left',
  }

  const handleClearChat = () => {
    clearMessages()
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0',
        'bg-muted'
      )}
    >
      {/* Header left side */}
      <div className="flex items-center gap-3">
        <AssistantIdentity
          size={36}
          variant="folio"
          className="drop-shadow-sm"
        />
        <div>
          <h3 className="text-sm font-semibold text-foreground">JobSilver AI</h3>
          <p className="text-xs text-muted-foreground">
            {pageContext ? `Helping with ${pageContext.title}` : 'Your AI assistant'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Position/Settings dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <GripVertical className="h-4 w-4" />
              <span className="sr-only">Chat settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border/50">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Position</DropdownMenuLabel>
            {Object.entries(positionLabels).map(([pos, label]) => (
              <DropdownMenuItem
                key={pos}
                onClick={() => setPosition(pos as ChatState['position'])}
                className={cn(
                  'transition-colors',
                  position === pos && 'bg-accent text-foreground'
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
            {messages.length > 0 && (
              <>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                  onClick={handleClearChat}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear chat
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={closeChat}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close chat</span>
        </Button>
      </div>
    </div>
  )
}
