'use client'

import * as React from 'react'
import { User, Wrench, Check, Loader2, Copy, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AssistantIdentity } from '@/components/ai-assistant/assistant-identity'
import type { ChatMessage } from '@/hooks/use-chat'
import { useChat } from '@/hooks/use-chat'
import { downloadCoverLetter } from '@/lib/ai/chat-service'
import { dispatchFillAnswer } from '@/lib/events/chat-events'

/**
 * Simple markdown formatter for chat messages.
 * Supports: **bold**, bullet points (- item), line breaks
 */
function formatMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  lines.forEach((line, lineIndex) => {
    // Check if it's a bullet point
    const bulletMatch = line.match(/^(\s*)-\s+(.*)$/)

    if (bulletMatch) {
      const [, indent, content] = bulletMatch
      const indentLevel = Math.floor((indent?.length || 0) / 2)
      result.push(
        <div key={lineIndex} className="flex items-start gap-2" style={{ marginLeft: `${indentLevel * 12}px` }}>
          <span className="text-muted-foreground mt-0.5">•</span>
          <span>{formatInlineMarkdown(content)}</span>
        </div>
      )
    } else if (line.trim() === '') {
      // Empty line - add spacing
      result.push(<div key={lineIndex} className="h-2" />)
    } else {
      // Regular line with inline formatting
      result.push(
        <div key={lineIndex}>{formatInlineMarkdown(line)}</div>
      )
    }
  })

  return result
}

/**
 * Format inline markdown: **bold**
 */
function formatInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    // Add bold text
    parts.push(
      <strong key={match.index} className="font-semibold">
        {match[1]}
      </strong>
    )
    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Extract clean cover letter content from AI response
 * Removes intro/outro text, markdown, and other artifacts
 */
function extractCoverLetter(content: string): string {
  // Remove markdown bold markers
  let cleaned = content.replace(/\*\*/g, '')

  // Find where the actual letter starts (Dear Hiring Manager)
  const dearMatch = cleaned.match(/Dear\s+(Hiring\s+Manager|Sir|Madam|Team)/i)
  if (dearMatch && dearMatch.index !== undefined) {
    cleaned = cleaned.slice(dearMatch.index)
  }

  // Find where the letter ends (after the name following Kind Regards/Sincerely)
  // Pattern: "Kind Regards," or "Sincerely," followed by a name, then stop
  const closingMatch = cleaned.match(/(Kind\s+Regards|Sincerely|Best\s+Regards|Warm\s+Regards),?\s*\n+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i)
  if (closingMatch && closingMatch.index !== undefined) {
    // Include the closing and name, then cut off anything after
    const endIndex = closingMatch.index + closingMatch[0].length
    cleaned = cleaned.slice(0, endIndex)
  }

  // Remove any remaining AI commentary patterns
  cleaned = cleaned
    .replace(/---+/g, '') // Remove dividers
    .replace(/😊|🎉|👋|✨/g, '') // Remove emojis
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim()

  return cleaned
}

interface MessageItemProps {
  message: ChatMessage
}

export function MessageItem({ message }: MessageItemProps) {
  const [copied, setCopied] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [autofilled, setAutofilled] = React.useState(false)
  const { pendingQuestion, jobContext } = useChat()

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Check if this message contains a cover letter (look for tool call or specific patterns)
  const hasCoverLetter = React.useMemo(() => {
    if (!isAssistant || !message.content) return false
    // Check if it's from generate_cover_letter tool or contains cover letter content
    const isCoverLetterTool = message.toolCall?.name === 'generate_cover_letter'
    const content = message.content.toLowerCase()
    const hasSignature = content.includes('dear') &&
                         (content.includes('kind regards') || content.includes('sincerely'))
    const mentionsCoverLetter = content.includes('cover letter') &&
                                 message.content.length > 500 // Substantial content
    return isCoverLetterTool || hasSignature || mentionsCoverLetter
  }, [isAssistant, message.content, message.toolCall])

  // Check if this message is a response to a pending question (can be autofilled)
  const canAutofill = React.useMemo(() => {
    if (!isAssistant || !message.content || !pendingQuestion) return false
    // If there's a pending question and this is an AI response with substantial content
    return message.content.length > 20 && !hasCoverLetter
  }, [isAssistant, message.content, pendingQuestion, hasCoverLetter])

  const handleAutofill = () => {
    if (!pendingQuestion || !message.content) return

    // Dispatch the fill answer event
    dispatchFillAnswer({
      questionId: pendingQuestion.questionId,
      answer: message.content,
    })

    setAutofilled(true)
    setTimeout(() => setAutofilled(false), 3000)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    const jobTitle = jobContext?.title || 'Position'
    const company = jobContext?.company || 'Company'
    const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '-')

    // Extract clean cover letter content (removes AI intro/outro and markdown)
    const cleanedContent = extractCoverLetter(message.content)

    try {
      await downloadCoverLetter(
        cleanedContent,
        jobTitle,
        company
      )
    } catch (error) {
      console.error('Failed to download as Word doc, falling back to text:', error)
      // Fallback to plain text download - this always works
      const blob = new Blob([cleanedContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Cover-Letter-${safeCompany}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Delay revoke to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--coral-soft)] text-[var(--coral-lo)]">
          <User className="h-4 w-4" />
        </div>
      ) : (
        <AssistantIdentity size={32} variant="folio" />
      )}

      {/* Message bubble */}
      <div
        className={cn(
          'flex flex-col max-w-[280px]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-[var(--coral)] text-[var(--coral-ink)] rounded-tr-sm'
              : 'bg-muted/50 text-foreground border border-border/50 rounded-tl-sm'
          )}
        >
          {/* Tool call indicator */}
          {message.toolCall && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs mb-2 pb-2 border-b',
                isUser ? 'border-[var(--coral-ink)]/25' : 'border-border/50'
              )}
            >
              {message.toolCall.status === 'pending' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : message.toolCall.status === 'completed' ? (
                <Check className="h-3 w-3 text-[hsl(var(--status-offer))]" />
              ) : (
                <Wrench className="h-3 w-3" />
              )}
              <span className="opacity-80">
                {message.toolCall.name.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Message content */}
          <div className="break-words space-y-0.5">
            {message.content ? (
              formatMarkdown(message.content)
            ) : (
              <span className="opacity-50 italic">Thinking...</span>
            )}
          </div>
        </div>

        {/* Action buttons for assistant messages */}
        {isAssistant && message.content && (
          <div className="flex items-center gap-1 mt-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 text-[hsl(var(--status-offer))]" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span className="sr-only">Copy message</span>
            </Button>

            {canAutofill && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs gap-1.5 transition-colors duration-200",
                  autofilled
                    ? "text-[hsl(var(--status-offer))] bg-[hsl(var(--status-offer)/0.1)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                onClick={handleAutofill}
                disabled={autofilled}
              >
                {autofilled ? (
                  <>
                    <Check className="h-3 w-3" />
                    Filled
                  </>
                ) : (
                  "Use Answer"
                )}
              </Button>
            )}

            {hasCoverLetter && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200"
                onClick={handleDownload}
                disabled={isDownloading}
                title="Download as Word document"
              >
                {isDownloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                <span className="sr-only">Download cover letter as .docx</span>
              </Button>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/60 mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}
