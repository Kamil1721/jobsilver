/**
 * Custom events for chat-form integration
 * Allows decoupled communication between chat and form components
 */

export const CHAT_EVENTS = {
  /** Trigger form field fill with AI-generated answer */
  FILL_ANSWER: 'chat:fill-answer',
  /** Trigger multiple form fields fill at once */
  FILL_MULTIPLE_ANSWERS: 'chat:fill-multiple-answers',
  /** Set job context for chat assistant */
  SET_JOB_CONTEXT: 'chat:set-job-context',
  /** Set application questions context for chat assistant */
  SET_APPLICATION_QUESTIONS: 'chat:set-application-questions',
  /** Request AI help for a specific question */
  ASK_AI_HELP: 'chat:ask-ai-help',
  /** Notify chat that form field was updated */
  FIELD_UPDATED: 'chat:field-updated',
  /** Attach a generated file (like cover letter) to a file upload field */
  ATTACH_FILE: 'chat:attach-file',
} as const

export type ChatEventType = typeof CHAT_EVENTS[keyof typeof CHAT_EVENTS]

// Event payload types
export interface FillAnswerPayload {
  questionId: string
  answer: string
}

export interface FillMultipleAnswersPayload {
  answers: Array<{ questionId: string; answer: string }>
}

export interface JobContextPayload {
  jobId: string
  title: string
  company: string
  description?: string
}

export interface AskAIHelpPayload {
  questionId: string
  questionLabel: string
  currentValue?: string
  maxLength?: number
}

export interface FieldUpdatedPayload {
  questionId: string
  value: string
}

export interface ApplicationQuestion {
  id: string
  label: string
  type: string
  required: boolean
  currentValue?: string
}

export interface SetApplicationQuestionsPayload {
  questions: ApplicationQuestion[]
}

export interface AttachFilePayload {
  questionId: string
  fileName: string
  content: string
  mimeType: 'text/plain' | 'application/pdf'
}

// Type-safe event dispatchers
export function dispatchFillAnswer(payload: FillAnswerPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.FILL_ANSWER, { detail: payload })
    )
  }
}

export function dispatchFillMultipleAnswers(payload: FillMultipleAnswersPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.FILL_MULTIPLE_ANSWERS, { detail: payload })
    )
  }
}

export function dispatchSetJobContext(payload: JobContextPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.SET_JOB_CONTEXT, { detail: payload })
    )
  }
}

export function dispatchAskAIHelp(payload: AskAIHelpPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.ASK_AI_HELP, { detail: payload })
    )
  }
}

export function dispatchFieldUpdated(payload: FieldUpdatedPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.FIELD_UPDATED, { detail: payload })
    )
  }
}

export function dispatchSetApplicationQuestions(payload: SetApplicationQuestionsPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.SET_APPLICATION_QUESTIONS, { detail: payload })
    )
  }
}

export function dispatchAttachFile(payload: AttachFilePayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_EVENTS.ATTACH_FILE, { detail: payload })
    )
  }
}

// Type-safe event listeners
export function onFillAnswer(
  handler: (payload: FillAnswerPayload) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<FillAnswerPayload>
    handler(customEvent.detail)
  }
  window.addEventListener(CHAT_EVENTS.FILL_ANSWER, listener)
  return () => window.removeEventListener(CHAT_EVENTS.FILL_ANSWER, listener)
}

export function onFillMultipleAnswers(
  handler: (payload: FillMultipleAnswersPayload) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<FillMultipleAnswersPayload>
    handler(customEvent.detail)
  }
  window.addEventListener(CHAT_EVENTS.FILL_MULTIPLE_ANSWERS, listener)
  return () => window.removeEventListener(CHAT_EVENTS.FILL_MULTIPLE_ANSWERS, listener)
}

export function onSetJobContext(
  handler: (payload: JobContextPayload) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<JobContextPayload>
    handler(customEvent.detail)
  }
  window.addEventListener(CHAT_EVENTS.SET_JOB_CONTEXT, listener)
  return () => window.removeEventListener(CHAT_EVENTS.SET_JOB_CONTEXT, listener)
}

export function onAskAIHelp(
  handler: (payload: AskAIHelpPayload) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AskAIHelpPayload>
    handler(customEvent.detail)
  }
  window.addEventListener(CHAT_EVENTS.ASK_AI_HELP, listener)
  return () => window.removeEventListener(CHAT_EVENTS.ASK_AI_HELP, listener)
}

export function onSetApplicationQuestions(
  handler: (payload: SetApplicationQuestionsPayload) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SetApplicationQuestionsPayload>
    handler(customEvent.detail)
  }
  window.addEventListener(CHAT_EVENTS.SET_APPLICATION_QUESTIONS, listener)
  return () => window.removeEventListener(CHAT_EVENTS.SET_APPLICATION_QUESTIONS, listener)
}

export function onAttachFile(
  handler: (payload: AttachFilePayload) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AttachFilePayload>
    handler(customEvent.detail)
  }
  window.addEventListener(CHAT_EVENTS.ATTACH_FILE, listener)
  return () => window.removeEventListener(CHAT_EVENTS.ATTACH_FILE, listener)
}
