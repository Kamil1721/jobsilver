'use client'

import * as React from 'react'
import { useEffect, useRef, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import {
  useChat,
  setJobContext,
  openChat,
  setPendingQuestion,
  setApplicationQuestions,
  addMessage,
  updateMessage,
  setStreaming,
  clearMessages,
} from '@/hooks/use-chat'
import {
  onSetJobContext,
  onAskAIHelp,
  onSetApplicationQuestions,
  dispatchFillAnswer,
  dispatchFillMultipleAnswers,
  dispatchAttachFile,
  type JobContextPayload,
  type AskAIHelpPayload,
  type SetApplicationQuestionsPayload,
} from '@/lib/events/chat-events'
import { ChatButton } from './ChatButton'
import { ChatPanel } from './ChatPanel'

interface ChatProviderProps {
  children: React.ReactNode
}

// Maximum message length to prevent API abuse
const MAX_MESSAGE_LENGTH = 4000
// Maximum messages to keep in history (to prevent memory issues)
const MAX_MESSAGES = 50
// Stream timeout - abort if no data received for 60 seconds
const STREAM_TIMEOUT_MS = 60000

// Valid pathnames for page context (used for validation and structured data)
const VALID_PAGE_PATHNAMES = [
  '/dashboard',
  '/profile',
  '/setup',
  '/choose-plan',
  '/pricing',
] as const

type ValidPathname = typeof VALID_PAGE_PATHNAMES[number] | null

// Get the normalized pathname for page context
function getNormalizedPathname(pathname: string): ValidPathname {
  // Direct match
  if (VALID_PAGE_PATHNAMES.includes(pathname as typeof VALID_PAGE_PATHNAMES[number])) {
    return pathname as ValidPathname
  }
  return null
}

export function ChatProvider({ children }: ChatProviderProps) {
  const chat = useChat()
  const pathname = usePathname()

  // AbortController for cancelling ongoing streams
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get normalized pathname for AI context (validated against known pages)
  const normalizedPathname = useMemo(() => getNormalizedPathname(pathname), [pathname])

  // Clear job context when navigating away from job pages
  useEffect(() => {
    if (!pathname.startsWith('/jobs/')) {
      setJobContext(null)
    }
  }, [pathname])

  // Listen for job context events
  useEffect(() => {
    return onSetJobContext((payload: JobContextPayload) => {
      setJobContext(payload)
    })
  }, [])

  // Listen for "Ask AI" help events
  useEffect(() => {
    return onAskAIHelp((payload: AskAIHelpPayload) => {
      setPendingQuestion(payload)
      openChat()
    })
  }, [])

  // Listen for application questions context
  useEffect(() => {
    return onSetApplicationQuestions((payload: SetApplicationQuestionsPayload) => {
      setApplicationQuestions(payload.questions)
    })
  }, [])

  // Cleanup: abort stream and reset streaming state on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      setStreaming(false)
    }
  }, [])

  // Handle sending messages
  const handleSend = useCallback(async (content: string) => {
    // Validate message length
    if (content.length > MAX_MESSAGE_LENGTH) {
      addMessage('assistant', `Message too long. Please keep messages under ${MAX_MESSAGE_LENGTH} characters.`)
      return
    }

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Add user message
    addMessage('user', content)
    setStreaming(true)

    // Capture current context at send time (avoid stale closure issues)
    const currentJobContext = chat.jobContext
    const currentPendingQuestion = chat.pendingQuestion
    const currentApplicationQuestions = chat.applicationQuestions

    // Build conversation history (last N messages for context)
    const conversationHistory = chat.messages.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          jobContext: currentJobContext,
          pendingQuestion: currentPendingQuestion,
          applicationQuestions: currentApplicationQuestions,
          history: conversationHistory,
          pageContext: normalizedPathname, // Send validated pathname for AI context
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send message')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      const assistantId = addMessage('assistant', '')
      let fullContent = ''

      // Stream timeout - abort if no data for too long
      let streamTimeoutId: NodeJS.Timeout | null = null
      const resetStreamTimeout = () => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId)
        streamTimeoutId = setTimeout(() => {
          abortControllerRef.current?.abort()
        }, STREAM_TIMEOUT_MS)
      }
      resetStreamTimeout()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (streamTimeoutId) clearTimeout(streamTimeoutId)
          break
        }
        resetStreamTimeout()

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'text') {
                fullContent += parsed.content
                updateMessage(assistantId, fullContent)
              } else if (parsed.type === 'tool_call') {
                updateMessage(assistantId, fullContent, {
                  name: parsed.name,
                  status: 'pending',
                })
              } else if (parsed.type === 'tool_result') {
                updateMessage(assistantId, fullContent, {
                  name: parsed.name,
                  status: 'completed',
                  result: parsed.result,
                })

                // Handle fill_answer_field tool with safe parsing
                if (parsed.name === 'fill_answer_field' && parsed.result) {
                  try {
                    const result = JSON.parse(parsed.result)
                    if (result.questionId && result.answer) {
                      dispatchFillAnswer({
                        questionId: result.questionId,
                        answer: result.answer,
                      })
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse fill_answer_field result:', parseError)
                  }
                }

                // Handle fill_multiple_answers tool for bulk filling
                if (parsed.name === 'fill_multiple_answers' && parsed.result) {
                  try {
                    const result = JSON.parse(parsed.result)
                    if (result.answers && Array.isArray(result.answers)) {
                      dispatchFillMultipleAnswers({
                        answers: result.answers,
                      })
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse fill_multiple_answers result:', parseError)
                  }
                }

                // Handle attach_cover_letter tool for file attachment
                if (parsed.name === 'attach_cover_letter' && parsed.result) {
                  try {
                    const result = JSON.parse(parsed.result)
                    if (result.action === 'attach_file' && result.questionId && result.content) {
                      dispatchAttachFile({
                        questionId: result.questionId,
                        fileName: result.fileName,
                        content: result.content,
                        mimeType: result.mimeType || 'text/plain',
                      })
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse attach_cover_letter result:', parseError)
                  }
                }
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Clear pending question after successful response
      setPendingQuestion(null)
    } catch (error) {
      // Don't show error for intentional abort
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('Chat error:', error)
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.')
    } finally {
      setStreaming(false)
      abortControllerRef.current = null
    }
  }, [chat.jobContext, chat.pendingQuestion, chat.applicationQuestions, chat.messages, normalizedPathname])

  return (
    <>
      {children}
      <ChatButton />
      <ChatPanel onSend={handleSend} />
    </>
  )
}
