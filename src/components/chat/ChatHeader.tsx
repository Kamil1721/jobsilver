'use client'

import * as React from 'react'
import { Bot, GripVertical, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        'flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0',
        'bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800'
      )}
    >
      {/* Header left side */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600" />
          <div className="absolute inset-[1px] rounded-[6px] bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800" />
          <Bot className="relative z-10 h-5 w-5 text-zinc-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">JobSilver AI</h3>
          <p className="text-xs text-zinc-400">
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
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
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
                  position === pos && 'bg-white/[0.05] text-white'
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
                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
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
          className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close chat</span>
        </Button>
      </div>
    </div>
  )
}
