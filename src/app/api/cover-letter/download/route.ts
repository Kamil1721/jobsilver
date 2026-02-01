import { NextRequest, NextResponse } from 'next/server'
import { Document, Packer, Paragraph, TextRun } from 'docx'

export async function POST(request: NextRequest) {
  try {
    const { coverLetter, jobTitle, company } = await request.json()

    if (!coverLetter) {
      return NextResponse.json({ error: 'Cover letter content is required' }, { status: 400 })
    }

    // Parse the cover letter into paragraphs
    const paragraphs = coverLetter.split('\n').filter((line: string) => line.trim())

    // Create document paragraphs
    const docParagraphs = paragraphs.map((text: string, index: number) => {
      // Check if it's a greeting or sign-off
      const isGreeting = text.startsWith('Dear ')
      const isSignOff = text.startsWith('Kind Regards') || text.startsWith('Best Regards') || text.startsWith('Sincerely')
      const isName = index === paragraphs.length - 1 && !isSignOff && !text.includes(' ')

      return new Paragraph({
        children: [
          new TextRun({
            text: text,
            font: 'Calibri',
            size: 24, // 12pt
            bold: isName,
          }),
        ],
        spacing: {
          after: isGreeting || isSignOff ? 200 : 280, // Less space after greeting/signoff
        },
      })
    })

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docParagraphs,
        },
      ],
    })

    // Generate the DOCX buffer
    const buffer = await Packer.toBuffer(doc)

    // Create filename
    const safeCompany = (company || 'Company').replace(/[^a-zA-Z0-9]/g, '_')
    const safeTitle = (jobTitle || 'Position').replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `Cover_Letter_${safeTitle}_${safeCompany}.docx`

    // Return as downloadable file
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating cover letter document:', error)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}
