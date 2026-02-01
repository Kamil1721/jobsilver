import type { JobContextPayload, AskAIHelpPayload } from '@/lib/events/chat-events'

interface ChatResponse {
  type: 'text' | 'tool_call' | 'tool_result'
  content?: string
  name?: string
  result?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Send a chat message and handle streaming response
 */
export async function sendChatMessage(
  message: string,
  jobContext: JobContextPayload | null,
  pendingQuestion: AskAIHelpPayload | null,
  onChunk: (response: ChatResponse) => void
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      jobContext,
      pendingQuestion,
    }),
  })

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No reader available')

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data) as ChatResponse
          onChunk(parsed)
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }
}

/**
 * Generate a cover letter for a job (non-streaming, for download)
 */
export async function generateCoverLetter(
  jobId: string,
  tone: 'professional' | 'friendly' | 'enthusiastic' = 'professional'
): Promise<{ coverLetter: string; jobTitle: string; company: string }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Generate a cover letter for job ID ${jobId} with a ${tone} tone.`,
      jobContext: { jobId, title: '', company: '' },
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate cover letter')
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No reader available')

  const decoder = new TextDecoder()
  let fullContent = ''
  let result = { coverLetter: '', jobTitle: '', company: '' }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data) as ChatResponse
          if (parsed.type === 'text' && parsed.content) {
            fullContent += parsed.content
          }
          if (parsed.type === 'tool_result' && parsed.name === 'generate_cover_letter') {
            const toolResult = JSON.parse(parsed.result || '{}')
            result = toolResult
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  // If we got the cover letter from tool result, use that
  // Otherwise, extract from full content
  if (!result.coverLetter && fullContent) {
    result.coverLetter = fullContent
  }

  return result
}

/**
 * Helper to create a Word document from cover letter text
 * Uses the docx library with minimal configuration for maximum compatibility
 */
export async function createCoverLetterDoc(
  coverLetter: string,
  jobTitle: string,
  company: string
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')

  // Format today's date
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Clean the content - normalize and remove any markdown artifacts
  const cleanContent = String(coverLetter || '')
    .normalize('NFC')
    .replace(/\*\*/g, '') // Remove bold markdown
    .trim()

  // Split into paragraphs and create properly spaced content
  const lines = cleanContent.split(/\n/)
  const contentParagraphs: InstanceType<typeof Paragraph>[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // Check if this is a closing line (Kind Regards, Sincerely, etc.)
    const isClosing = /^(Kind\s+Regards|Sincerely|Best\s+Regards|Warm\s+Regards),?$/i.test(trimmedLine)
    // Check if this is the greeting line
    const isGreeting = /^Dear\s+/i.test(trimmedLine)

    contentParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: trimmedLine })],
        spacing: {
          // Add space after greeting and before closing, normal spacing for body paragraphs
          after: isGreeting || isClosing ? 200 : 120,
          before: isClosing ? 200 : 0,
        },
      })
    )
  }

  const doc = new Document({
    sections: [{
      children: [
        // Date
        new Paragraph({
          children: [new TextRun({ text: dateStr })],
          spacing: { after: 400 },
        }),
        // Re: line
        new Paragraph({
          children: [new TextRun({ text: `Re: ${jobTitle || 'Application'}`, bold: true })],
        }),
        // Company
        new Paragraph({
          children: [new TextRun({ text: company || '' })],
          spacing: { after: 400 },
        }),
        // Cover letter content with proper spacing
        ...contentParagraphs,
      ],
    }],
  })

  return await Packer.toBlob(doc)
}

/**
 * Download cover letter as Word document
 * Uses file-saver library for reliable cross-browser downloads
 */
export async function downloadCoverLetter(
  coverLetter: string,
  jobTitle: string,
  company: string
): Promise<void> {
  // Create the document first
  const blob = await createCoverLetterDoc(coverLetter, jobTitle, company)

  // Sanitize company name for filename
  const safeCompany = (company || 'Company')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'Company'

  const filename = `Cover-Letter-${safeCompany}.docx`

  // Import file-saver - handle various module formats
  const fileSaver = await import('file-saver')

  // file-saver can export saveAs in different ways depending on bundler
  // Try: named export, default export, or default.saveAs
  const saveAsFn =
    (fileSaver as { saveAs?: typeof import('file-saver').saveAs }).saveAs ||
    (fileSaver as { default?: typeof import('file-saver').saveAs }).default ||
    ((fileSaver as { default?: { saveAs?: typeof import('file-saver').saveAs } }).default?.saveAs)

  if (typeof saveAsFn === 'function') {
    saveAsFn(blob, filename)
  } else {
    // Ultimate fallback: manual blob download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // Delay revoke to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
