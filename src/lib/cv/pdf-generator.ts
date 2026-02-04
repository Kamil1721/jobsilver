/**
 * CV PDF Generator using pdf-lib
 * Generates professional CVs in PDF format
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

interface WorkHistory {
  company: string
  position: string
  start_date: string
  end_date: string | null
  location?: string
  highlights: string[]
}

interface Education {
  institution: string
  degree: string
  area: string
  graduation_year: string
  location?: string
  highlights?: string[]
}

export interface CVData {
  first_name: string
  last_name: string
  email: string
  phone?: string
  location?: string
  linkedin_url?: string
  experience_summary?: string
  work_history: WorkHistory[]
  education: Education[]
  skills: string[]
}

interface JobContext {
  title: string
  company: string
  description?: string
}

// Tailored content from AI tailor service
export interface TailoredCVContent {
  summary?: string
  skills?: string[]
  enhancedHighlights?: Map<number, string[]>
}

// Constants for layout
const PAGE_WIDTH = 612 // Letter width
const PAGE_HEIGHT = 792 // Letter height
const MARGIN_LEFT = 50
const MARGIN_RIGHT = 50
const MARGIN_TOP = 50
const MARGIN_BOTTOM = 50
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

// Colors
const PRIMARY_COLOR = rgb(0.1, 0.1, 0.1) // Dark gray for text
const ACCENT_COLOR = rgb(0.2, 0.4, 0.6) // Blue for headers
const LIGHT_GRAY = rgb(0.4, 0.4, 0.4) // Light gray for secondary text

/**
 * Sanitize text for PDF generation
 * Replaces special characters that can cause zlib compression errors
 */
function sanitizeText(text: string): string {
  if (!text) return ''
  return text
    // Smart quotes to regular quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Dashes
    .replace(/[\u2013\u2014\u2015]/g, '-')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Bullet points
    .replace(/[\u2022\u2023\u2043]/g, '-')
    // Other common problematic characters
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/[\u2002\u2003\u2009]/g, ' ') // Various spaces
    // Remove any remaining non-ASCII that might cause issues
    .replace(/[^\x00-\x7F]/g, (char) => {
      // Try to keep accented letters by normalizing
      const normalized = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return normalized || ''
    })
}

class PDFHelper {
  private page: PDFPage
  private yPosition: number
  private fontRegular: PDFFont
  private fontBold: PDFFont
  private doc: PDFDocument

  constructor(
    doc: PDFDocument,
    page: PDFPage,
    fontRegular: PDFFont,
    fontBold: PDFFont
  ) {
    this.doc = doc
    this.page = page
    this.fontRegular = fontRegular
    this.fontBold = fontBold
    this.yPosition = PAGE_HEIGHT - MARGIN_TOP
  }

  private checkPageBreak(neededHeight: number): void {
    if (this.yPosition - neededHeight < MARGIN_BOTTOM) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.yPosition = PAGE_HEIGHT - MARGIN_TOP
    }
  }

  drawText(
    text: string,
    options: {
      size?: number
      font?: PDFFont
      color?: ReturnType<typeof rgb>
      x?: number
      maxWidth?: number
    } = {}
  ): void {
    const {
      size = 10,
      font = this.fontRegular,
      color = PRIMARY_COLOR,
      x = MARGIN_LEFT,
      maxWidth = CONTENT_WIDTH,
    } = options

    // Sanitize text to prevent compression errors
    const safeText = sanitizeText(text)

    // Simple word wrap
    const words = safeText.split(' ')
    let line = ''
    const lines: string[] = []

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, size)

      if (testWidth > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)

    const lineHeight = size * 1.4
    this.checkPageBreak(lineHeight * lines.length)

    for (const l of lines) {
      this.page.drawText(l, {
        x,
        y: this.yPosition,
        size,
        font,
        color,
      })
      this.yPosition -= lineHeight
    }
  }

  drawHeader(name: string, contactInfo: string[]): void {
    // Name
    this.page.drawText(name, {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 24,
      font: this.fontBold,
      color: PRIMARY_COLOR,
    })
    this.yPosition -= 32

    // Contact info on one line
    const contactLine = contactInfo.filter(Boolean).join('  |  ')
    this.page.drawText(contactLine, {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 9,
      font: this.fontRegular,
      color: LIGHT_GRAY,
    })
    this.yPosition -= 20
  }

  drawSectionTitle(title: string): void {
    this.checkPageBreak(25)
    this.yPosition -= 10 // Space before section

    // Draw line
    this.page.drawLine({
      start: { x: MARGIN_LEFT, y: this.yPosition + 12 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: this.yPosition + 12 },
      thickness: 0.5,
      color: ACCENT_COLOR,
    })

    this.page.drawText(title.toUpperCase(), {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 11,
      font: this.fontBold,
      color: ACCENT_COLOR,
    })
    this.yPosition -= 18
  }

  drawExperience(exp: WorkHistory): void {
    this.checkPageBreak(60)

    // Company and Position
    this.page.drawText(exp.position, {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 11,
      font: this.fontBold,
      color: PRIMARY_COLOR,
    })
    this.yPosition -= 14

    // Company, Location, Dates
    const dateStr = formatDateRange(exp.start_date, exp.end_date)
    const companyLine = [exp.company, exp.location, dateStr].filter(Boolean).join(' | ')
    this.page.drawText(companyLine, {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 9,
      font: this.fontRegular,
      color: LIGHT_GRAY,
    })
    this.yPosition -= 14

    // Highlights
    for (const highlight of exp.highlights) {
      if (highlight.trim()) {
        this.checkPageBreak(20)
        this.drawText(`• ${highlight}`, { size: 10, x: MARGIN_LEFT + 10, maxWidth: CONTENT_WIDTH - 10 })
      }
    }
    this.yPosition -= 5
  }

  drawEducation(edu: Education): void {
    this.checkPageBreak(40)

    // Degree and Field
    const degree = `${edu.degree} in ${edu.area}`
    this.page.drawText(degree, {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 11,
      font: this.fontBold,
      color: PRIMARY_COLOR,
    })
    this.yPosition -= 14

    // Institution, Location, Year
    const eduLine = [edu.institution, edu.location, edu.graduation_year].filter(Boolean).join(' | ')
    this.page.drawText(eduLine, {
      x: MARGIN_LEFT,
      y: this.yPosition,
      size: 9,
      font: this.fontRegular,
      color: LIGHT_GRAY,
    })
    this.yPosition -= 14

    // Highlights
    if (edu.highlights) {
      for (const highlight of edu.highlights) {
        if (highlight.trim()) {
          this.checkPageBreak(20)
          this.drawText(`• ${highlight}`, { size: 10, x: MARGIN_LEFT + 10, maxWidth: CONTENT_WIDTH - 10 })
        }
      }
    }
    this.yPosition -= 5
  }

  drawSkills(skills: string[]): void {
    this.checkPageBreak(30)
    const skillsText = skills.join('  •  ')
    this.drawText(skillsText, { size: 10 })
  }

  drawSummary(summary: string): void {
    this.drawText(summary, { size: 10, color: LIGHT_GRAY })
    this.yPosition -= 5
  }
}

function formatDateRange(start: string, end: string | null): string {
  const formatMonth = (dateStr: string) => {
    if (!dateStr) return ''
    const [year, month] = dateStr.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthNum = parseInt(month, 10) - 1
    return `${monthNames[monthNum] || ''} ${year}`
  }

  const startFormatted = formatMonth(start)
  const endFormatted = end ? formatMonth(end) : 'Present'
  return `${startFormatted} - ${endFormatted}`
}

export async function generateCV(data: CVData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  // Load fonts
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const helper = new PDFHelper(doc, page, fontRegular, fontBold)

  // Header
  const fullName = `${data.first_name} ${data.last_name}`.trim()
  const contactInfo: string[] = [
    data.email,
    data.phone || '',
    data.location || '',
    data.linkedin_url ? data.linkedin_url.replace('https://www.linkedin.com/in/', 'linkedin.com/in/').replace('https://linkedin.com/in/', 'linkedin.com/in/') : '',
  ].filter(Boolean) as string[]
  helper.drawHeader(fullName, contactInfo)

  // Professional Summary
  if (data.experience_summary) {
    helper.drawSectionTitle('Professional Summary')
    helper.drawSummary(data.experience_summary)
  }

  // Work Experience
  if (data.work_history && data.work_history.length > 0) {
    helper.drawSectionTitle('Professional Experience')
    for (const exp of data.work_history) {
      if (exp.company && exp.position) {
        helper.drawExperience(exp)
      }
    }
  }

  // Education
  if (data.education && data.education.length > 0) {
    helper.drawSectionTitle('Education')
    for (const edu of data.education) {
      if (edu.institution && edu.degree) {
        helper.drawEducation(edu)
      }
    }
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    helper.drawSectionTitle('Skills')
    helper.drawSkills(data.skills)
  }

  const pdfBytes = await doc.save()
  return pdfBytes
}

/**
 * Generate a CV tailored for a specific job
 * Accepts optional AI-generated tailored content to customize the CV
 */
export async function generateTailoredCV(
  data: CVData,
  job: JobContext,
  tailoredContent?: TailoredCVContent
): Promise<Uint8Array> {
  // Create a copy of data to modify
  const tailoredData = { ...data }

  // Apply tailored content if provided
  if (tailoredContent) {
    // Use AI-generated summary
    if (tailoredContent.summary) {
      tailoredData.experience_summary = tailoredContent.summary
    }

    // Use reordered skills
    if (tailoredContent.skills && tailoredContent.skills.length > 0) {
      tailoredData.skills = tailoredContent.skills
    }

    // Apply enhanced highlights to work history
    if (tailoredContent.enhancedHighlights && tailoredData.work_history) {
      tailoredData.work_history = tailoredData.work_history.map((work, index) => {
        const enhanced = tailoredContent.enhancedHighlights?.get(index)
        if (enhanced && enhanced.length > 0) {
          return { ...work, highlights: enhanced }
        }
        return work
      })
    }
  } else {
    // Fall back to basic tailoring if no AI content provided
    if (!tailoredData.experience_summary && job.title) {
      tailoredData.experience_summary = `Experienced professional seeking ${job.title} position${job.company ? ` at ${job.company}` : ''}.`
    }
  }

  return generateCV(tailoredData)
}
