/**
 * Shared utility for formatting job descriptions
 * - Detects and preserves HTML input
 * - Decodes HTML entities
 * - Converts bullet point patterns to proper lists (for plain text)
 * - Preserves paragraph breaks
 * - Cleans up excessive whitespace
 */

/**
 * Decode common HTML entities to their character equivalents
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'")
}

/**
 * Check if a string contains HTML tags
 */
function isHtmlContent(content: string): boolean {
  // Check for common HTML tags that indicate formatted content
  const htmlTagPattern = /<(p|div|ul|ol|li|br|h[1-6]|strong|b|em|i|span|a)\b[^>]*>/i
  return htmlTagPattern.test(content)
}

/**
 * Allowlist of safe HTML tags for job descriptions
 * Only these tags will be preserved; all others are stripped
 */
const SAFE_TAGS = new Set([
  'p', 'div', 'span', 'br',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's',
  'a',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr',
])

/**
 * Allowlist of safe attributes per tag
 * Only these attributes are preserved on their respective tags
 */
const SAFE_ATTRIBUTES: Record<string, Set<string>> = {
  'a': new Set(['href', 'title']),
  'td': new Set(['colspan', 'rowspan']),
  'th': new Set(['colspan', 'rowspan', 'scope']),
}

/**
 * Check if a URL is safe (http/https only, no javascript: or data:)
 */
function isSafeUrl(url: string): boolean {
  if (!url) return false
  const trimmed = url.trim().toLowerCase()
  // Only allow http and https protocols
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true
  }
  // Allow relative URLs that don't start with dangerous protocols
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true
  }
  // Block javascript:, data:, vbscript:, and other dangerous protocols
  if (trimmed.includes(':')) {
    return false
  }
  // Allow anchor links
  if (trimmed.startsWith('#')) {
    return true
  }
  return false
}

/**
 * Common section header patterns in job descriptions
 * These will be converted to <h3> tags for proper formatting
 */
const HEADER_PATTERNS = [
  // Exact matches (case insensitive)
  /^about\s+(the\s+)?(opportunity|role|position|job|company|us|team)$/i,
  /^what\s+you[''']ll\s+(do|learn|get|need|bring)$/i,
  /^what\s+you[''']re\s+(looking\s+for)$/i,
  /^what\s+we[''']re\s+looking\s+for$/i,
  /^who\s+(you\s+are|we[''']re\s+looking\s+for)$/i,
  /^(your|the)\s+(responsibilities|qualifications|requirements|role|day|benefits)$/i,
  /^(key|core|main|primary)?\s*(responsibilities|qualifications|requirements|skills|duties):?$/i,
  /^(required|preferred|minimum|nice[- ]to[- ]have)\s*(qualifications|skills|experience)?:?$/i,
  /^requirements:?$/i,
  /^(we[''']re\s+)?(looking\s+for|offer|provide):?$/i,
  /^(job|role|position)\s+(description|overview|summary|responsibilities|requirements):?$/i,
  /^compensation\s*(&|and)?\s*(benefits|commitments)?$/i,
  /^(benefits|perks)(\s+(&|and)\s+(benefits|perks|compensation))?$/i,
  /^(how\s+to\s+apply|application\s+process|next\s+steps):?$/i,
  /^(why\s+join\s+us|why\s+work\s+(here|with\s+us)|our\s+(mission|values|culture))$/i,
  /^(about\s+)?this\s+(role|position|opportunity)$/i,
  /^(ideal\s+)?candidate(\s+profile)?$/i,
  /^(technical\s+)?(skills|stack|requirements):?$/i,
  /^(what\s+)?we\s+(offer|value|believe)$/i,
  /^preferred\s+skills:?$/i,
]

/**
 * Check if a line looks like a section header
 * Headers are typically short, title-cased, and don't end with punctuation
 */
function isLikelyHeader(line: string): boolean {
  const trimmed = line.trim()

  // Skip empty lines or very short/long lines
  if (trimmed.length < 3 || trimmed.length > 80) return false

  // Skip lines that end with typical sentence punctuation
  if (/[.!?,;]$/.test(trimmed)) return false

  // Check against known header patterns
  for (const pattern of HEADER_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  // Check for title case patterns (e.g., "What You'll Do", "About Us")
  // Must have 2-6 words, mostly capitalized
  const words = trimmed.split(/\s+/)
  if (words.length >= 2 && words.length <= 8) {
    // Count capitalized words (first letter uppercase)
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w))
    const capitalizedRatio = capitalizedWords.length / words.length

    // If most words are capitalized and it's short, likely a header
    if (capitalizedRatio >= 0.6 && trimmed.length <= 60) {
      // Additional check: headers often contain certain keywords
      const headerKeywords = /responsibilities|requirements|qualifications|skills|benefits|about|what|who|why|how|our|your|the|role|job|position|team|company|apply|offer|looking/i
      if (headerKeywords.test(trimmed)) return true
    }
  }

  // Check for colon at end (e.g., "Requirements:" or "About Us:")
  if (/:$/.test(trimmed) && trimmed.length <= 50) return true

  return false
}

/**
 * Convert detected headers to proper HTML heading tags
 */
function convertHeadersToHeadings(html: string): string {
  // Process the HTML to find and convert headers
  // Headers typically appear:
  // 1. After <br> tags followed by text and another <br>
  // 2. At the start of <p> tags
  // 3. As standalone text lines

  // Pattern 1: Text between <br> tags that looks like a header
  let result = html.replace(/<br\s*\/?>\s*([^<]{3,80})\s*<br\s*\/?>/gi, (match, text) => {
    const trimmed = text.trim()
    if (isLikelyHeader(trimmed)) {
      return `</p><h3>${trimmed}</h3><p>`
    }
    return match
  })

  // Pattern 2: Text at start of <p> tag followed by <br>
  result = result.replace(/<p>\s*([^<]{3,80})\s*<br\s*\/?>/gi, (match, text) => {
    const trimmed = text.trim()
    if (isLikelyHeader(trimmed)) {
      return `<h3>${trimmed}</h3><p>`
    }
    return match
  })

  // Clean up empty paragraphs that might result from header conversion
  result = result.replace(/<p>\s*<\/p>/g, '')
  result = result.replace(/<\/p>\s*<p>/g, '</p><p>')

  return result
}

/**
 * Clean and sanitize HTML content using allowlist approach
 * - Uses strict allowlist of safe tags (prevents XSS)
 * - Removes all attributes except safe ones
 * - Validates URLs in href attributes
 * - Cleans up excessive whitespace
 * - Converts detected headers to proper heading tags
 *
 * This is a defense-in-depth sanitization that protects against:
 * - Script injection via <script>, event handlers (onclick, etc.)
 * - SVG/Math-based XSS attacks
 * - javascript: and data: URL attacks
 * - Nested tag bypass attempts
 */
function cleanHtmlDescription(html: string): string {
  if (!html) return ''

  let cleaned = html

  // Step 1: Remove all comments (can hide malicious content)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

  // Step 2: Remove dangerous tags and their content entirely
  // These tags can execute code or load external resources
  const dangerousTags = ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed',
                         'applet', 'frame', 'frameset', 'base', 'link', 'meta', 'template',
                         'form', 'input', 'textarea', 'select', 'button']
  for (const tag of dangerousTags) {
    // Remove opening and closing tags with content
    const tagPattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    cleaned = cleaned.replace(tagPattern, '')
    // Remove self-closing versions
    cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }

  // Step 3: Remove ALL event handlers (on*, formaction, etc.)
  // Match any attribute starting with "on" or known dangerous attributes
  const eventHandlerPattern = /\s+(?:on\w+|formaction|action|srcdoc|data-[\w-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/gi
  cleaned = cleaned.replace(eventHandlerPattern, '')

  // Step 4: Process remaining tags through allowlist
  cleaned = cleaned.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tagName, attributes) => {
    const tag = tagName.toLowerCase()

    // If tag is not in allowlist, remove it but keep content
    if (!SAFE_TAGS.has(tag)) {
      return ''
    }

    // For closing tags, just return the clean closing tag
    if (match.startsWith('</')) {
      return `</${tag}>`
    }

    // For opening tags, filter attributes
    const allowedAttrs = SAFE_ATTRIBUTES[tag]
    if (!allowedAttrs || allowedAttrs.size === 0) {
      // No attributes allowed for this tag
      return match.endsWith('/>') ? `<${tag} />` : `<${tag}>`
    }

    // Parse and filter attributes
    const safeAttrs: string[] = []
    const attrPattern = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/gi
    let attrMatch
    while ((attrMatch = attrPattern.exec(attributes)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''

      if (allowedAttrs.has(attrName)) {
        // For href attribute, validate the URL
        if (attrName === 'href') {
          if (isSafeUrl(attrValue)) {
            safeAttrs.push(`${attrName}="${attrValue.replace(/"/g, '&quot;')}"`)
          }
          // If URL is not safe, skip this attribute
        } else {
          // Other allowed attributes
          safeAttrs.push(`${attrName}="${attrValue.replace(/"/g, '&quot;')}"`)
        }
      }
    }

    const attrString = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : ''
    return match.endsWith('/>') ? `<${tag}${attrString} />` : `<${tag}${attrString}>`
  })

  // Step 5: Clean up whitespace and formatting
  // Remove excessive whitespace between tags
  cleaned = cleaned.replace(/>\s+</g, '><')

  // Clean up excessive line breaks
  cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')

  // Remove empty block elements
  cleaned = cleaned.replace(/<(p|div|span|li)>\s*<\/\1>/gi, '')

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ')

  // Trim leading/trailing whitespace within block elements
  cleaned = cleaned.replace(/<(p|div|li|h[1-6])>\s+/gi, '<$1>')
  cleaned = cleaned.replace(/\s+<\/(p|div|li|h[1-6])>/gi, '</$1>')

  // Convert detected headers to proper heading tags
  cleaned = convertHeadersToHeadings(cleaned)

  // Final cleanup of empty elements created during header conversion
  cleaned = cleaned.replace(/<p>\s*<\/p>/g, '')

  return cleaned.trim()
}

/**
 * Format a job description for better readability
 * - Detects if input is already HTML and preserves formatting
 * - For plain text: converts bullet patterns to lists, preserves paragraph breaks
 * - Cleans up excessive whitespace
 */
export function formatDescription(rawDescription: string): string {
  if (!rawDescription) return ''

  // Check if the input is already HTML
  if (isHtmlContent(rawDescription)) {
    // Input is HTML - clean and return it
    return cleanHtmlDescription(rawDescription)
  }

  // Input is plain text - convert to HTML
  let text = decodeHtmlEntities(rawDescription)

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Convert common bullet patterns to HTML list items
  // Patterns: •, -, *, ·, ●, ○, ▪, ▸, →, >
  const bulletPatterns = /^[\s]*[•\-\*·●○▪▸→>]\s*/gm
  const hasBullets = bulletPatterns.test(text)

  if (hasBullets) {
    // Split into lines and process
    const lines = text.split('\n')
    let inList = false
    const processedLines: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()
      const isBullet = /^[•\-\*·●○▪▸→>]\s*/.test(trimmedLine)

      if (isBullet) {
        if (!inList) {
          processedLines.push('<ul>')
          inList = true
        }
        const content = trimmedLine.replace(/^[•\-\*·●○▪▸→>]\s*/, '')
        processedLines.push(`<li>${content}</li>`)
      } else {
        if (inList && trimmedLine === '') {
          processedLines.push('</ul>')
          inList = false
        } else if (inList && trimmedLine !== '') {
          // Non-bullet line while in list - close list first
          processedLines.push('</ul>')
          inList = false
          processedLines.push(trimmedLine)
        } else {
          processedLines.push(trimmedLine)
        }
      }
    }

    if (inList) {
      processedLines.push('</ul>')
    }

    text = processedLines.join('\n')
  }

  // Convert numbered lists (1. 2. 3. or 1) 2) 3))
  text = text.replace(/^(\d+)[.)]\s+(.+)$/gm, '<li>$2</li>')

  // Wrap consecutive <li> items in <ol> if they look like numbered lists
  text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    if (!match.includes('<ul>')) {
      return `<ol>${match}</ol>`
    }
    return match
  })

  // Convert double newlines to paragraph breaks
  text = text.replace(/\n\n+/g, '</p><p>')

  // Convert single newlines to <br> (but not inside lists)
  text = text.replace(/\n(?![<])/g, '<br>')

  // Wrap in paragraph tags if not already structured
  if (!text.startsWith('<')) {
    text = `<p>${text}</p>`
  }

  // Clean up empty paragraphs and excessive breaks
  text = text.replace(/<p>\s*<\/p>/g, '')
  text = text.replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>')
  text = text.replace(/<p>\s*<br\s*\/?>\s*/g, '<p>')
  text = text.replace(/\s*<br\s*\/?>\s*<\/p>/g, '</p>')

  return text.trim()
}

/**
 * Strip HTML tags from content while preserving basic text
 * Use this when you need plain text only
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
