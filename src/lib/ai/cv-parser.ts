import OpenAI from 'openai'
import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult,
} from '@adobe/pdfservices-node-sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
// pdf-parse v2+ uses named export
import { PDFParse } from 'pdf-parse'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ParsedCV {
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  summary: string
  contact: {
    name: string
    email: string
    phone: string
    location: string
  }
}

export async function parseCV(cvText: string): Promise<ParsedCV> {
  const prompt = `Parse this CV/resume and extract structured information. Be thorough in extracting ALL skills mentioned, including soft skills (communication, leadership, teamwork) and industry-specific skills (customer service, project management, etc.), not just technical skills.

CV TEXT:
${cvText}

Respond in JSON format:
{
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start - End (e.g., Jan 2020 - Present)",
      "description": "Brief description of responsibilities"
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University/School Name",
      "year": "Graduation Year"
    }
  ],
  "summary": "A 2-3 sentence professional summary based on the CV",
  "contact": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "Phone number",
    "location": "City, Country"
  }
}

Extract as much information as available. For missing fields, use empty strings or empty arrays.
Include both technical skills (programming, software, tools) AND soft skills (communication, leadership, problem-solving).`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    return JSON.parse(content) as ParsedCV
  } catch (error) {
    console.error('Error parsing CV:', error)
    return {
      skills: [],
      experience: [],
      education: [],
      summary: '',
      contact: {
        name: '',
        email: '',
        phone: '',
        location: '',
      },
    }
  }
}

/**
 * Extract text from PDF using Adobe PDF Services API
 * Provides high-accuracy text extraction from PDF documents
 */
export async function extractTextFromPDFAdobe(pdfBuffer: Buffer): Promise<string> {
  const clientId = process.env.ADOBE_CLIENT_ID
  const clientSecret = process.env.ADOBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.log('Adobe credentials not configured, falling back to basic extraction')
    return extractTextFromPDFBasic(pdfBuffer)
  }

  try {
    // Create credentials
    const credentials = new ServicePrincipalCredentials({
      clientId,
      clientSecret,
    })

    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials })

    // Create temp file for the PDF
    const tempDir = os.tmpdir()
    const tempPdfPath = path.join(tempDir, `cv-${Date.now()}.pdf`)
    fs.writeFileSync(tempPdfPath, pdfBuffer)

    // Read the PDF file as a stream
    const inputStream = fs.createReadStream(tempPdfPath)

    // Upload the PDF
    const inputAsset = await pdfServices.upload({
      readStream: inputStream,
      mimeType: MimeType.PDF,
    })

    // Create extract PDF params
    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT],
    })

    // Create and submit the job
    const job = new ExtractPDFJob({ inputAsset, params })
    const pollingURL = await pdfServices.submit({ job })
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult,
    })

    // Get the result asset
    const resultAsset = pdfServicesResponse.result?.resource
    if (!resultAsset) {
      throw new Error('No result from Adobe PDF Services')
    }

    // Download the result (it's a zip file containing the extracted content)
    const outputZipPath = path.join(tempDir, `cv-result-${Date.now()}.zip`)

    // Get the stream content from the result asset
    const streamAsset = await pdfServices.getContent({ asset: resultAsset })
    const readStream = streamAsset.readStream

    // Write to file
    const outputStream = fs.createWriteStream(outputZipPath)
    await new Promise<void>((resolve, reject) => {
      readStream.pipe(outputStream)
      outputStream.on('finish', resolve)
      outputStream.on('error', reject)
      readStream.on('error', reject)
    })

    // Extract text from the zip file
    const zip = new AdmZip(outputZipPath)
    const jsonEntry = zip.getEntry('structuredData.json')

    if (!jsonEntry) {
      throw new Error('No structured data in Adobe response')
    }

    const jsonContent = zip.readAsText(jsonEntry)
    const structuredData = JSON.parse(jsonContent)

    // Extract text from elements
    let extractedText = ''
    if (structuredData.elements) {
      for (const element of structuredData.elements) {
        if (element.Text) {
          extractedText += element.Text + '\n'
        }
      }
    }

    // Cleanup temp files
    try {
      fs.unlinkSync(tempPdfPath)
      fs.unlinkSync(outputZipPath)
    } catch {
      // Ignore cleanup errors
    }

    console.log('Adobe PDF extraction successful, extracted', extractedText.length, 'characters')
    return extractedText.trim()
  } catch (error) {
    console.error('Adobe PDF extraction error:', error)
    console.log('Falling back to basic extraction')
    return await extractTextFromPDFBasic(pdfBuffer)
  }
}

/**
 * Basic text extraction from PDF using pdf-parse (fallback method)
 */
export async function extractTextFromPDFBasic(pdfBuffer: Buffer): Promise<string> {
  try {
    // pdf-parse v2 uses class-based API
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })
    const result = await parser.getText()
    const text = result.text || ''
    parser.destroy()
    console.log('pdf-parse extraction successful, extracted', text.length, 'characters')
    return text.trim()
  } catch (error) {
    console.error('pdf-parse extraction failed:', error)
    // Ultimate fallback - try raw text extraction
    const rawText = pdfBuffer.toString('utf-8')
      .replace(/[^\x20-\x7E\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return rawText.length > 100 ? rawText : ''
  }
}

/**
 * Main function to extract text from PDF
 * Uses Adobe PDF Services if configured, otherwise falls back to basic extraction
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // Try Adobe first if credentials are available
  const hasAdobeCredentials = process.env.ADOBE_CLIENT_ID && process.env.ADOBE_CLIENT_SECRET

  if (hasAdobeCredentials) {
    return extractTextFromPDFAdobe(pdfBuffer)
  }

  // Fallback to basic extraction
  return await extractTextFromPDFBasic(pdfBuffer)
}

/**
 * Extract text from DOCX files
 */
export async function extractTextFromDOCX(docxBuffer: Buffer): Promise<string> {
  try {
    const zip = new AdmZip(docxBuffer)
    const documentXml = zip.getEntry('word/document.xml')

    if (!documentXml) {
      return ''
    }

    const xmlContent = zip.readAsText(documentXml)

    // Extract text from XML (simple regex approach)
    const textContent = xmlContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return textContent
  } catch (error) {
    console.error('Error extracting text from DOCX:', error)
    return ''
  }
}

/**
 * Extract text from any supported file type
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const extension = path.extname(filename).toLowerCase()

  switch (extension) {
    case '.pdf':
      return extractTextFromPDF(buffer)
    case '.docx':
      return extractTextFromDOCX(buffer)
    case '.doc':
      // .doc files are harder to parse, try basic extraction
      return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ').trim()
    case '.txt':
      return buffer.toString('utf-8')
    default:
      console.warn(`Unsupported file type: ${extension}`)
      return ''
  }
}
