"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Loader2,
  Image as ImageIcon,
  Copy,
  Check,
  Sparkles,
  User,
  Bot,
  X,
  Download,
  Lock,
  Crown,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { Job, Profile } from "@/lib/supabase/types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  imageUrl?: string // For displaying uploaded images (backward compat)
  imageUrls?: string[] // For displaying multiple uploaded images
}

interface JobAIChatProps {
  job: Job
  profile: Profile | null
}

// Stream timeout - abort if no data received for 60 seconds
const STREAM_TIMEOUT_MS = 60000

export function JobAIChat({ job, profile }: JobAIChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [imageFiles, setImageFiles] = React.useState<File[]>([])
  const [imagePreviews, setImagePreviews] = React.useState<string[]>([])
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const { toast } = useToast()

  // Cleanup: abort any ongoing request on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Load chat history from database
  React.useEffect(() => {
    const loadChatHistory = async () => {
      console.log(`[JobAIChat] Loading chat history for job: ${job.id}`)
      try {
        const response = await fetch(`/api/jobs/${job.id}/chat`)
        console.log(`[JobAIChat] Response status: ${response.status}`)

        if (response.ok) {
          const data = await response.json()
          console.log(`[JobAIChat] Loaded ${data.messages?.length || 0} messages`)

          if (data.messages && data.messages.length > 0) {
            // Convert database messages to component format
            const loadedMessages: Message[] = data.messages.map((msg: { id: string; role: 'user' | 'assistant'; content: string; image_url?: string; created_at: string }) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.created_at),
              imageUrl: msg.image_url || undefined,
            }))
            setMessages(loadedMessages)
          } else {
            // No history - show welcome message
            setMessages([{
              id: "welcome",
              role: "assistant",
              content: `Hi! I'm here to help you apply for the **${job.title}** position at **${job.company || "this company"}**.\n\nI can help you with:\n- Generate a cover letter tailored to this role\n- Answer application questions - paste them here or upload a screenshot\n- Highlight your strengths for this specific position\n\nJust ask me anything or paste the application questions you need help with!`,
              timestamp: new Date(),
            }])
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error(`[JobAIChat] Failed to load: ${response.status}`, errorData)
          // Show welcome message on error
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: `Hi! I'm here to help you apply for the **${job.title}** position at **${job.company || "this company"}**.\n\nI can help you with:\n- Generate a cover letter tailored to this role\n- Answer application questions - paste them here or upload a screenshot\n- Highlight your strengths for this specific position\n\nJust ask me anything or paste the application questions you need help with!`,
            timestamp: new Date(),
          }])
        }
      } catch (error) {
        console.error('[JobAIChat] Failed to load chat history:', error)
        // Show welcome message on error
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: `Hi! I'm here to help you apply for the **${job.title}** position at **${job.company || "this company"}**.\n\nI can help you with:\n- Generate a cover letter tailored to this role\n- Answer application questions - paste them here or upload a screenshot\n- Highlight your strengths for this specific position\n\nJust ask me anything or paste the application questions you need help with!`,
          timestamp: new Date(),
        }])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadChatHistory()
  }, [job.id, job.title, job.company])

  // Save message to database - returns true if saved successfully
  const saveMessage = async (role: 'user' | 'assistant', content: string, imageUrl?: string): Promise<boolean> => {
    console.log(`[JobAIChat] Saving ${role} message for job: ${job.id}`)
    try {
      const response = await fetch(`/api/jobs/${job.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content, imageUrl }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`[JobAIChat] Failed to save message: ${response.status}`, errorData)
        return false
      } else {
        console.log(`[JobAIChat] Message saved successfully`)
        return true
      }
    } catch (error) {
      console.error('[JobAIChat] Failed to save message:', error)
      return false
    }
  }

  // Auto-scroll to bottom when messages change (only within chat container)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Find the ScrollArea viewport and scroll it directly
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
      // Keep input focused
      if (!isLoading && inputRef.current) {
        inputRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isLoading])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Invalid file",
          description: "Please upload an image file (PNG, JPG, etc.)",
        })
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please upload an image smaller than 10MB",
        })
        return
      }
      // Add to existing images (max 5)
      if (imageFiles.length >= 5) {
        toast({
          variant: "destructive",
          title: "Too many images",
          description: "Maximum 5 images allowed per message",
        })
        return
      }
      setImageFiles(prev => [...prev, file])
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    }
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const clearAllImages = () => {
    setImageFiles([])
    setImagePreviews([])
  }

  // Handle pasting images from clipboard
  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            toast({
              variant: "destructive",
              title: "File too large",
              description: "Please paste an image smaller than 10MB",
            })
            return
          }
          // Check max images limit
          setImageFiles(prev => {
            if (prev.length >= 5) {
              toast({
                variant: "destructive",
                title: "Too many images",
                description: "Maximum 5 images allowed per message",
              })
              return prev
            }
            return [...prev, file]
          })
          const reader = new FileReader()
          reader.onload = (event) => {
            setImagePreviews(prev => {
              if (prev.length >= 5) return prev
              return [...prev, event.target?.result as string]
            })
          }
          reader.readAsDataURL(file)
        }
        break
      }
    }
  }, [toast])

  // Add paste event listener
  React.useEffect(() => {
    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [handlePaste])

  const handleSend = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim()
    if ((!messageToSend && imageFiles.length === 0) || isLoading) return

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Capture image data before clearing
    const currentImageFiles = [...imageFiles]
    const currentImagePreviews = [...imagePreviews]

    // Create user message with images if present (store first image for display, all sent to API)
    // For image-only messages, use a descriptive placeholder so it can be saved
    const imageOnlyText = "Answer the questions in this screenshot using my profile data."
    const messageContent = messageToSend || (currentImagePreviews.length > 0 ? imageOnlyText : "")
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      imageUrl: currentImagePreviews[0] || undefined,
      imageUrls: currentImagePreviews.length > 0 ? currentImagePreviews : undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    clearAllImages()
    setIsLoading(true)

    // Save user message to database (save first image URL for history)
    // Don't await - let it save in background. Failures are logged but don't interrupt user.
    saveMessage("user", userMessage.content, userMessage.imageUrl).then((saved) => {
      if (!saved) {
        console.warn('[JobAIChat] User message may not be saved to history')
      }
    })

    // Create a placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ])

    try {
      // Build the request body
      const requestBody: Record<string, unknown> = {
        message: messageContent,
        jobContext: {
          jobId: job.id,
          title: job.title,
          company: job.company || "Unknown Company",
          description: job.description,
        },
        history: messages
          .filter((m) => m.id !== "welcome")
          .slice(-10)
          .map((m) => ({
            role: m.role,
            content: m.content,
          })),
      }

      // If there are images, convert to base64 and include them
      if (currentImageFiles.length > 0 && currentImagePreviews.length > 0) {
        requestBody.images = currentImageFiles.map((file, index) => ({
          data: currentImagePreviews[index].split(",")[1], // Remove data:image/...;base64, prefix
          mimeType: file.type,
        }))
        // Also include single image for backward compatibility
        requestBody.image = {
          data: currentImagePreviews[0].split(",")[1],
          mimeType: currentImageFiles[0].type,
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || errorData.error || "Failed to get response")
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()
      let fullContent = ""

      // Stream timeout - abort if no data for too long
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null
      const resetStreamTimeout = () => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId)
        streamTimeoutId = setTimeout(() => {
          abortControllerRef.current?.abort()
        }, STREAM_TIMEOUT_MS)
      }
      resetStreamTimeout()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            if (streamTimeoutId) clearTimeout(streamTimeoutId)
            break
          }
          resetStreamTimeout()

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                const parsed = JSON.parse(data)

                if (parsed.type === "text") {
                  fullContent += parsed.content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m
                    )
                  )
                }
                // Tool calls are handled silently - the result will come through as text
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } finally {
        if (streamTimeoutId) clearTimeout(streamTimeoutId)
      }

      // If no content was received, show a fallback message
      if (!fullContent.trim()) {
        const fallbackContent = "I apologize, I couldn't generate a response. Please try again."
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: fallbackContent }
              : m
          )
        )
        saveMessage("assistant", fallbackContent).then((saved) => {
          if (!saved) {
            console.warn('[JobAIChat] Assistant message may not be saved to history')
          }
        })
      } else {
        // Save the assistant's response to database
        saveMessage("assistant", fullContent).then((saved) => {
          if (!saved) {
            console.warn('[JobAIChat] Assistant message may not be saved to history')
          }
        })
      }
    } catch (error) {
      // Don't show error for intentional abort (navigation away or new request)
      if (error instanceof Error && error.name === "AbortError") {
        return
      }
      console.error("Chat error:", error)
      // Update the placeholder message with error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  error instanceof Error
                    ? `Error: ${error.message}`
                    : "Failed to get response. Please try again.",
              }
            : m
        )
      )
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response. Please try again.",
      })
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 2000)
      toast({ title: "Copied to clipboard" })
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" })
    }
  }

  // Detect if message content is a cover letter
  const isCoverLetter = (content: string): boolean => {
    const trimmed = content.trim()
    return (
      trimmed.startsWith("Dear Hiring Manager") ||
      trimmed.startsWith("Dear Recruitment") ||
      (trimmed.includes("Dear ") && trimmed.includes("Kind Regards"))
    )
  }

  // Download cover letter as DOCX
  const downloadCoverLetter = async (content: string) => {
    try {
      const response = await fetch("/api/cover-letter/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter: content,
          jobTitle: job.title,
          company: job.company,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate document")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Cover_Letter_${job.title?.replace(/[^a-zA-Z0-9]/g, "_")}_${job.company?.replace(/[^a-zA-Z0-9]/g, "_") || "Company"}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({ title: "Cover letter downloaded!" })
    } catch {
      toast({ variant: "destructive", title: "Failed to download cover letter" })
    }
  }

  const quickActions = [
    { label: "Write cover letter", prompt: "Please write a cover letter for this position based on my CV and experience." },
    { label: "Why I'm a good fit", prompt: "Based on my profile and this job, explain why I would be a good fit for this role." },
    { label: "Salary negotiation tips", prompt: "What salary range should I expect for this role, and do you have any negotiation tips?" },
  ]

  // Check if user is on free plan (no AI access)
  const subscriptionPlan = profile?.subscription_plan || 'free'
  const isFreeUser = subscriptionPlan === 'free'

  // If free user, show upgrade overlay instead of functional chat
  if (isFreeUser) {
    return (
      <div className="flex flex-col h-[500px] border rounded-lg bg-card overflow-hidden relative">
        {/* Header - same as normal */}
        <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-violet-500/10">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold">AI Application Assistant</h3>
              <p className="text-[10px] text-muted-foreground">
                Helping with {job.title} at {job.company || "this company"}
              </p>
            </div>
          </div>
        </div>

        {/* Blurred/Grayed content area */}
        <div className="flex-1 relative">
          {/* Blurred mock content */}
          <div className="absolute inset-0 p-3 blur-[2px] opacity-40 pointer-events-none select-none">
            <div className="space-y-3">
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-[11px] bg-muted">
                  <p>Hi! I can help you with cover letters, application questions, and interview prep for this role...</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-[11px] bg-primary text-primary-foreground">
                  <p>Write me a cover letter for this position</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
              </div>
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-[11px] bg-muted">
                  <p>Dear Hiring Manager, I am writing to express my strong interest in...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
            <div className="text-center p-6 max-w-xs">
              <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-sm font-semibold mb-2">AI Assistant is a Pro Feature</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Get personalized cover letters, application answers, and interview prep tailored to each job.
              </p>
              <Link href="/choose-plan">
                <Button className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white text-xs h-8 px-4">
                  <Crown className="w-3.5 h-3.5 mr-1.5" />
                  Upgrade to Pro
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Disabled input area */}
        <div className="p-3 border-t bg-muted/30 flex-shrink-0">
          <div className="flex gap-2 opacity-50 pointer-events-none">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              disabled
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <div className="flex-1 h-9 rounded-md border bg-muted/50 px-3 flex items-center">
              <span className="text-[11px] text-muted-foreground">Upgrade to use AI assistant...</span>
            </div>
            <Button
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              disabled
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[500px] border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-violet-500/10">
            <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold">AI Application Assistant</h3>
            <p className="text-[10px] text-muted-foreground">
              Helping with {job.title} at {job.company || "this company"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Loading chat history...</span>
            </div>
          ) : messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-[11px]",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {/* Show images if present */}
                {(message.imageUrls || message.imageUrl) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(message.imageUrls || [message.imageUrl]).filter(Boolean).map((url, imgIndex) => (
                      <img
                        key={imgIndex}
                        src={url!}
                        alt={`Uploaded ${imgIndex + 1}`}
                        className="max-w-full max-h-32 rounded-md border border-primary-foreground/20"
                      />
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold">
                  {message.content ? (
                    message.content.split("\n").map((line, i) => {
                      // Simple markdown-like rendering
                      const boldRegex = /\*\*(.*?)\*\*/g
                      const parts = line.split(boldRegex)
                      return (
                        <p key={i} className="my-0.5">
                          {parts.map((part, j) =>
                            j % 2 === 1 ? (
                              <strong key={j}>{part}</strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </p>
                      )
                    })
                  ) : message.role === "assistant" && isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                {message.role === "assistant" && message.id !== "welcome" && message.content && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(message.content, message.id)}
                    >
                      {copiedId === message.id ? (
                        <><Check className="w-3 h-3 mr-1" />Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" />Copy</>
                      )}
                    </Button>
                    {isCoverLetter(message.content) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => downloadCoverLetter(message.content)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download DOCX
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick Actions - Auto-send on click */}
      {messages.length <= 1 && !isLoading && !isLoadingHistory && (
        <div className="px-3 py-2 border-t bg-muted/20 flex-shrink-0">
          <p className="text-[10px] text-muted-foreground mb-1.5">Quick actions:</p>
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleSend(action.prompt)}
                disabled={isLoading}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Image Previews */}
      {imagePreviews.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20 flex-shrink-0">
          <div className="flex gap-2 flex-wrap">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative inline-block">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="max-h-16 rounded-md border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
                  onClick={() => removeImage(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            {imagePreviews.length}/5 images attached
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-background flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Upload screenshot of application questions"
            disabled={isLoading}
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste application questions or ask for help..."
            className="min-h-[36px] max-h-[100px] text-[11px] resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            onClick={() => handleSend()}
            disabled={(!input.trim() && imageFiles.length === 0) || isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Tip: Upload a screenshot or paste application questions for personalized answers based on your CV
        </p>
      </div>
    </div>
  )
}
