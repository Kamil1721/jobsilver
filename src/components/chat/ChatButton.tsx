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
    if (isOpen && showWelcome) {
      dismissWelcome()
    }
  }, [isOpen, showWelcome])

  // Escape key to dismiss welcome
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showWelcome) {
        dismissWelcome()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showWelcome])

  const dismissWelcome = () => {
    setShowWelcome(false)
    localStorage.setItem(WELCOME_STORAGE_KEY, 'true')
  }

  // Hide the floating chat button on job detail pages (they have their own embedded AI chat)
  if (pathname.startsWith('/jobs/')) {
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
      } else {
        // It was a click, not a drag
        toggleChat()
      }

      setIsDragging(false)
      setDragPos(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Custom styles when dragging
  const dragStyles: React.CSSProperties = dragPos && isDragging
    ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' }
    : {}

  // Determine bubble position based on button position
  const isButtonOnRight = position.includes('right')
  const isButtonOnTop = position.includes('top')

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
            'bg-zinc-100 border border-zinc-300 text-zinc-900',
            'shadow-xl shadow-black/30',
            'animate-fade-in',
            bubblePositionClasses[position],
            isButtonOnRight ? 'bubble-tail-right' : 'bubble-tail-left'
          )}
        >
          <button
            onClick={dismissWelcome}
            className="absolute top-2 right-2 p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors"
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
        onMouseDown={handleMouseDown}
        className={cn(
          'fixed z-[75] flex h-12 w-12 items-center justify-center rounded-full overflow-hidden',
          // Metallic silver gradient
          'bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600 text-zinc-900',
          'hover:from-zinc-300 hover:via-zinc-400 hover:to-zinc-500',
          // Shadow and glow effect
          'shadow-lg shadow-zinc-500/25 hover:shadow-xl hover:shadow-zinc-400/40',
          // Focus ring
          'focus:outline-none focus:ring-2 focus:ring-zinc-400/50 focus:ring-offset-2 focus:ring-offset-background',
          // Position - use fixed position when not dragging
          !isDragging && positionClasses[position],
          // Smooth transition when snapping (not during drag)
          !isDragging && 'transition-all duration-300 ease-out',
          // Dragging state
          isDragging && 'cursor-grabbing scale-110 shadow-2xl shadow-zinc-400/50',
          !isDragging && 'cursor-grab hover:scale-105'
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
