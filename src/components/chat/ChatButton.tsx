'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChat, toggleChat, setPosition } from '@/hooks/use-chat'
import type { ChatState } from '@/hooks/use-chat'

const WELCOME_STORAGE_KEY = 'jobsilver-chat-welcome-seen'

export function ChatButton() {
  const { isOpen, position } = useChat()
  const pathname = usePathname()
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragPos, setDragPos] = React.useState<{ x: number; y: number } | null>(null)
  const dragStartRef = React.useRef({ x: 0, y: 0, moved: false })
  const [showWelcome, setShowWelcome] = React.useState(false)

  const dismissWelcome = React.useCallback(() => {
    setShowWelcome(false)
    localStorage.setItem(WELCOME_STORAGE_KEY, 'true')
  }, [])

  // Show welcome bubble after delay if user hasn't seen it
  React.useEffect(() => {
    const hasSeen = localStorage.getItem(WELCOME_STORAGE_KEY)
    if (!hasSeen && !isOpen) {
      const timer = setTimeout(() => setShowWelcome(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Dismiss welcome when chat opens
  React.useEffect(() => {
    let cancelled = false
    if (isOpen && showWelcome) {
      queueMicrotask(() => {
        if (!cancelled) dismissWelcome()
      })
    }
    return () => {
      cancelled = true
    }
  }, [isOpen, showWelcome, dismissWelcome])

  // Escape key to dismiss welcome
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showWelcome) {
        dismissWelcome()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showWelcome, dismissWelcome])

  // Keep focused flows clear of floating controls. Job details have their own
  // embedded assistant, while onboarding needs unobstructed form controls.
  if (
    pathname.startsWith('/jobs/') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/choose-plan')
  ) {
    return null
  }

  // Position classes for each corner
  const positionClasses: Record<string, string> = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-20 right-6',
    'top-left': 'top-20 left-6',
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false }

    // Set initial position
    const rect = e.currentTarget.getBoundingClientRect()
    setDragPos({ x: rect.left, y: rect.top })

    const handleMouseMove = (moveE: MouseEvent) => {
      const deltaX = Math.abs(moveE.clientX - dragStartRef.current.x)
      const deltaY = Math.abs(moveE.clientY - dragStartRef.current.y)

      // Only start dragging after moving a bit (to allow clicks)
      if (deltaX > 5 || deltaY > 5) {
        dragStartRef.current.moved = true
        setIsDragging(true)

        // Follow the mouse (center button on cursor)
        const newX = Math.max(0, Math.min(window.innerWidth - 48, moveE.clientX - 24))
        const newY = Math.max(0, Math.min(window.innerHeight - 48, moveE.clientY - 24))
        setDragPos({ x: newX, y: newY })
      }
    }

    const handleMouseUp = (upE: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (dragStartRef.current.moved) {
        // Snap to nearest corner
        const windowCenterX = window.innerWidth / 2
        const windowCenterY = window.innerHeight / 2

        let newPosition: ChatState['position']
        if (upE.clientY < windowCenterY) {
          newPosition = upE.clientX < windowCenterX ? 'top-left' : 'top-right'
        } else {
          newPosition = upE.clientX < windowCenterX ? 'bottom-left' : 'bottom-right'
        }

        setPosition(newPosition)
      }

      setIsDragging(false)
      setDragPos(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dragStartRef.current.moved) {
      e.preventDefault()
      dragStartRef.current.moved = false
      return
    }

    toggleChat()
  }

  // Custom styles when dragging
  const dragStyles: React.CSSProperties = dragPos && isDragging
    ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' }
    : {}

  // Determine bubble position based on button position
  const isButtonOnRight = position.includes('right')

  // Bubble positioning classes
  const bubblePositionClasses = {
    'bottom-right': 'bottom-6 right-20',
    'bottom-left': 'bottom-6 left-20',
    'top-right': 'top-20 right-20',
    'top-left': 'top-20 left-20',
  }

  return (
    <>
      {/* Welcome speech bubble */}
      {showWelcome && !isDragging && (
        <div
          className={cn(
            'fixed z-[74] max-w-xs p-3 pr-8 rounded-lg',
            'bg-card border border-border text-foreground',
            'shadow-elevated',
            'animate-fade-in',
            bubblePositionClasses[position],
            isButtonOnRight ? 'bubble-tail-right' : 'bubble-tail-left'
          )}
        >
          <button
            type="button"
            onClick={dismissWelcome}
            className="absolute top-2 right-2 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss welcome message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="text-sm leading-relaxed">
            Hi! I&apos;m your AI assistant. Ask me anything about job applications, cover letters, or interview prep!
          </p>
        </div>
      )}

      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className={cn(
          'fixed z-[75] flex h-12 w-12 items-center justify-center rounded-full overflow-hidden',
          // Coral launcher — the single inviting action
          'bg-[var(--coral)] text-[var(--coral-ink)]',
          'hover:bg-[var(--coral-hi)]',
          // Coral-tinted shadow and glow
          'shadow-lg shadow-[var(--coral)]/25 hover:shadow-xl hover:shadow-[var(--coral)]/35',
          // Focus ring
          'focus:outline-none focus:ring-2 focus:ring-[var(--coral)] focus:ring-offset-2 focus:ring-offset-background',
          // Position - use fixed position when not dragging
          !isDragging && positionClasses[position],
          // Smooth transition when snapping (not during drag)
          !isDragging && 'transition-all duration-300 ease-out',
          // Dragging state
          isDragging && 'cursor-grabbing scale-110 shadow-2xl shadow-[var(--coral)]/40',
          !isDragging && 'cursor-grab hover:scale-105 active:scale-95'
        )}
        style={dragStyles}
        aria-label={isOpen ? 'Close chat' : 'Open chat assistant'}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>
    </>
  )
}
