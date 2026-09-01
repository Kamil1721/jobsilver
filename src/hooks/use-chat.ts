"use client"

import * as React from "react"
import type { AskAIHelpPayload, JobContextPayload, ApplicationQuestion } from "@/lib/events/chat-events"

// Message types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolCall?: {
    name: string
    status: 'pending' | 'completed' | 'error'
    result?: string
  }
}

// Chat state
export interface ChatState {
  isOpen: boolean
  messages: ChatMessage[]
  isStreaming: boolean
  jobContext: JobContextPayload | null
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  pendingQuestion: AskAIHelpPayload | null
  applicationQuestions: ApplicationQuestion[] | null
}

// Action types
type ActionType = {
  TOGGLE_OPEN: "TOGGLE_OPEN"
  SET_OPEN: "SET_OPEN"
  ADD_MESSAGE: "ADD_MESSAGE"
  UPDATE_MESSAGE: "UPDATE_MESSAGE"
  REMOVE_MESSAGE: "REMOVE_MESSAGE"
  SET_STREAMING: "SET_STREAMING"
  SET_JOB_CONTEXT: "SET_JOB_CONTEXT"
  SET_POSITION: "SET_POSITION"
  SET_PENDING_QUESTION: "SET_PENDING_QUESTION"
  SET_APPLICATION_QUESTIONS: "SET_APPLICATION_QUESTIONS"
  CLEAR_MESSAGES: "CLEAR_MESSAGES"
}

type Action =
  | { type: ActionType["TOGGLE_OPEN"] }
  | { type: ActionType["SET_OPEN"]; open: boolean }
  | { type: ActionType["ADD_MESSAGE"]; message: ChatMessage }
  | { type: ActionType["UPDATE_MESSAGE"]; id: string; content: string; toolCall?: ChatMessage["toolCall"] }
  | { type: ActionType["REMOVE_MESSAGE"]; id: string }
  | { type: ActionType["SET_STREAMING"]; streaming: boolean }
  | { type: ActionType["SET_JOB_CONTEXT"]; context: JobContextPayload | null }
  | { type: ActionType["SET_POSITION"]; position: ChatState["position"] }
  | { type: ActionType["SET_PENDING_QUESTION"]; question: AskAIHelpPayload | null }
  | { type: ActionType["SET_APPLICATION_QUESTIONS"]; questions: ApplicationQuestion[] | null }
  | { type: ActionType["CLEAR_MESSAGES"] }

// ID generator
let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return `msg-${count}-${Date.now()}`
}

// Maximum messages to keep in state (prevents memory issues)
const MAX_MESSAGES = 50

// Reducer
export const reducer = (state: ChatState, action: Action): ChatState => {
  switch (action.type) {
    case "TOGGLE_OPEN":
      return { ...state, isOpen: !state.isOpen }
    case "SET_OPEN":
      return { ...state, isOpen: action.open }
    case "ADD_MESSAGE": {
      const newMessages = [...state.messages, action.message]
      // Trim old messages if we exceed the limit
      const trimmedMessages = newMessages.length > MAX_MESSAGES
        ? newMessages.slice(-MAX_MESSAGES)
        : newMessages
      return { ...state, messages: trimmedMessages }
    }
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? { ...m, content: action.content, toolCall: action.toolCall ?? m.toolCall }
            : m
        ),
      }
    case "REMOVE_MESSAGE":
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.id),
      }
    case "SET_STREAMING":
      return { ...state, isStreaming: action.streaming }
    case "SET_JOB_CONTEXT":
      return { ...state, jobContext: action.context }
    case "SET_POSITION":
      return { ...state, position: action.position }
    case "SET_PENDING_QUESTION":
      return { ...state, pendingQuestion: action.question }
    case "SET_APPLICATION_QUESTIONS":
      return { ...state, applicationQuestions: action.questions }
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] }
  }
}

// Global state management (following use-toast pattern)
const listeners: Array<(state: ChatState) => void> = []

// Load position from localStorage if available
function getInitialPosition(): ChatState["position"] {
  if (typeof window === 'undefined') return 'bottom-right'
  const stored = localStorage.getItem('chat-position')
  if (stored && ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(stored)) {
    return stored as ChatState["position"]
  }
  return 'bottom-right'
}

let memoryState: ChatState = {
  isOpen: false,
  messages: [],
  isStreaming: false,
  jobContext: null,
  position: 'bottom-right', // Will be updated on client
  pendingQuestion: null,
  applicationQuestions: null,
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)

  // Persist position to localStorage
  if (action.type === "SET_POSITION" && typeof window !== 'undefined') {
    localStorage.setItem('chat-position', memoryState.position)
  }

  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

// Public API functions
export function toggleChat() {
  dispatch({ type: "TOGGLE_OPEN" })
}

export function openChat() {
  dispatch({ type: "SET_OPEN", open: true })
}

export function closeChat() {
  dispatch({ type: "SET_OPEN", open: false })
  dispatch({ type: "SET_PENDING_QUESTION", question: null })
}

export function addMessage(role: ChatMessage['role'], content: string): string {
  const id = genId()
  dispatch({
    type: "ADD_MESSAGE",
    message: { id, role, content, timestamp: new Date() },
  })
  return id
}

export function updateMessage(id: string, content: string, toolCall?: ChatMessage["toolCall"]) {
  dispatch({ type: "UPDATE_MESSAGE", id, content, toolCall })
}

export function setStreaming(streaming: boolean) {
  dispatch({ type: "SET_STREAMING", streaming })
}

export function setJobContext(context: JobContextPayload | null) {
  dispatch({ type: "SET_JOB_CONTEXT", context })
}

export function setPosition(position: ChatState["position"]) {
  dispatch({ type: "SET_POSITION", position })
}

export function setPendingQuestion(question: AskAIHelpPayload | null) {
  dispatch({ type: "SET_PENDING_QUESTION", question })
}

export function clearMessages() {
  dispatch({ type: "CLEAR_MESSAGES" })
}

/**
 * Clear all chat state - call this on user sign out to prevent
 * any possibility of data leaking between users on shared devices
 */
export function clearChatState() {
  memoryState = {
    isOpen: false,
    messages: [],
    isStreaming: false,
    jobContext: null,
    position: 'bottom-right',
    pendingQuestion: null,
    applicationQuestions: null,
  }
  listeners.forEach((listener) => listener(memoryState))
}

export function setApplicationQuestions(questions: ApplicationQuestion[] | null) {
  dispatch({ type: "SET_APPLICATION_QUESTIONS", questions })
}

// React hook
export function useChat() {
  const [state, setState] = React.useState<ChatState>(memoryState)

  React.useEffect(() => {
    // Initialize position from localStorage on client
    const storedPosition = getInitialPosition()
    if (storedPosition !== memoryState.position) {
      dispatch({ type: "SET_POSITION", position: storedPosition })
    }

    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])
  // NOTE: onAskAIHelp listener is handled in ChatProvider to avoid duplicate registration

  return {
    ...state,
    toggleChat,
    openChat,
    closeChat,
    addMessage,
    updateMessage,
    setStreaming,
    setJobContext,
    setPosition,
    setPendingQuestion,
    setApplicationQuestions,
    clearMessages,
  }
}

export { useChat as default }
