import { describe, expect, it, vi, beforeEach } from 'vitest'

let mockPdfPages: string[][] = []

const toPdfItems = (lines: string[]) =>
  lines.map((line, index) => ({
    str: line,
    transform: [12, 0, 0, 12, 72, 760 - index * 16],
  }))

vi.mock('pdfjs-dist/legacy/build/pdf.js', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      get numPages() {
        return mockPdfPages.length
      },
      getPage: (page: number) =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({
              items: toPdfItems(mockPdfPages[page - 1] || []),
            }),
        }),
      destroy: vi.fn(),
    }),
  })),
  GlobalWorkerOptions: { workerSrc: '' },
}))

import { extractCVDataFromPdf, MIN_CV_PARSE_CONFIDENCE } from '../utils/cvExtractor'

describe('cvExtractor', () => {
  beforeEach(() => {
    mockPdfPages = []
  })

  it('parses representative CV sections from extracted PDF lines', async () => {
    mockPdfPages = [[
      'Alex Johnson',
      'Senior Software Engineer',
      'alex@example.com',
      '+1 555 111 2222',
      'Seattle, WA',
      'SUMMARY',
      'Backend engineer focused on distributed systems and API design.',
      'EXPERIENCE',
      'Senior Engineer | Tech Corp | Seattle, WA Jan 2021 - Present',
      '- Built and maintained microservices for payments.',
      'EDUCATION',
      'University of Washington | BSc Computer Science | Seattle 2015 - 2019',
      'SKILLS',
      'Backend: Node.js, TypeScript, PostgreSQL',
      'Projects',
      'Payments Platform',
      '- Reduced API latency by 35%.',
      'Certifications',
      'AWS Certified Developer | Amazon | 2023',
      'Languages',
      'English (Native), Spanish (Fluent)',
    ]]

    const result = await extractCVDataFromPdf(new Uint8Array([1, 2, 3]), 'alex-cv.pdf')

    expect(result.confidence).toBeGreaterThanOrEqual(MIN_CV_PARSE_CONFIDENCE)
    expect(result.sectionsDetected).toContain('summary')
    expect(result.sectionsDetected).toContain('experience')
    expect(result.sectionsDetected).toContain('education')
    expect(result.sectionsDetected).toContain('skills')
    expect(result.sectionsDetected).toContain('projects')
    expect(result.sectionsDetected).toContain('certifications')
    expect(result.sectionsDetected).toContain('languages')
    expect(result.cvData.personalInfo.fullName).toBe('Alex Johnson')
    expect(result.cvData.personalInfo.email).toBe('alex@example.com')
    expect(result.cvData.experience.length).toBeGreaterThan(0)
    expect(result.cvData.education.length).toBeGreaterThan(0)
    expect(result.cvData.skills.length).toBeGreaterThan(0)
    expect(result.cvData.projects.length).toBeGreaterThan(0)
    expect(result.cvData.certifications.length).toBeGreaterThan(0)
    expect(result.cvData.languages.length).toBeGreaterThan(0)
    expect(result.pagesScanned).toBe(1)
  })

  it('handles noisy/partial headings such as PROFILE and WORK HISTORY', async () => {
    mockPdfPages = [[
      'Jamie Lee',
      'jamie@sample.dev',
      'PROFILE',
      'Product-minded engineer with startup and enterprise experience.',
      'WORK HISTORY',
      'Lead Engineer at Nova Labs Jan 2020 - Present',
      '- Led architecture for multi-tenant SaaS platform.',
      'TECHNICAL SKILLS',
      'React, TypeScript, Node.js',
    ]]

    const result = await extractCVDataFromPdf(new Uint8Array([5, 6, 7]), 'resume-jamie.pdf')

    expect(result.cvData.summary).toContain('Product-minded engineer')
    expect(result.cvData.experience.length).toBeGreaterThan(0)
    expect(result.cvData.skills.length).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('returns low confidence for non-CV content', async () => {
    mockPdfPages = [[
      'Quarterly Revenue Report',
      'Q1 performance has increased by 7.4%.',
      'Net operating margin is up by 2.1 points.',
      'Inventory turnover ratio remained stable.',
    ]]

    const result = await extractCVDataFromPdf(new Uint8Array([8, 9, 10]), 'q1-report.pdf')

    expect(result.confidence).toBeLessThan(MIN_CV_PARSE_CONFIDENCE)
    expect(result.cvData.experience).toHaveLength(0)
    expect(result.cvData.education).toHaveLength(0)
    expect(result.cvData.skills).toHaveLength(0)
  })

  it('infers experience/education/skills even when headings are missing', async () => {
    mockPdfPages = [[
      'Morgan Patel',
      'morgan@resume.dev',
      'Senior Software Engineer at Acme Systems Jan 2020 - Present',
      '- Led migration to event-driven architecture.',
      'University of Texas | Bachelor of Science in Computer Science | Austin 2014 - 2018',
      'TypeScript, Node.js, PostgreSQL, AWS, Docker',
    ]]

    const result = await extractCVDataFromPdf(new Uint8Array([13, 14, 15]), 'morgan_resume.pdf')

    expect(result.cvData.personalInfo.fullName).toBe('Morgan Patel')
    expect(result.cvData.experience.length).toBeGreaterThan(0)
    expect(result.cvData.education.length).toBeGreaterThan(0)
    expect(result.cvData.skills.length).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThanOrEqual(MIN_CV_PARSE_CONFIDENCE)
  })

  it('keeps missing sections empty instead of inheriting old values', async () => {
    mockPdfPages = [[
      'Taylor Smith',
      'taylor@example.org',
      'EXPERIENCE',
      'Software Engineer at Orbit Inc 2021 - Present',
      '- Built internal tooling.',
    ]]

    const result = await extractCVDataFromPdf(new Uint8Array([11, 12]), 'taylor-cv.pdf')

    expect(result.cvData.experience.length).toBeGreaterThan(0)
    expect(result.cvData.education).toHaveLength(0)
    expect(result.cvData.skills).toHaveLength(0)
    expect(result.cvData.projects).toHaveLength(0)
    expect(result.cvData.certifications).toHaveLength(0)
    expect(result.cvData.languages).toHaveLength(0)
    expect(result.missingSections).toContain('education')
    expect(result.missingSections).toContain('skills')
  })

  it('normalizes uppercase names and dash/bullet artifacts from extracted text', async () => {
    mockPdfPages = [[
      'JANE DOE',
      'jane@example.com',
      'WORK EXPERIENCE',
      'Lead Engineer | Alpha Labs Jan 2020 â€“ Present',
      'â€¢ Built distributed APIs for high-volume traffic.',
      'SKILLS',
      'TypeScript, Node.js, PostgreSQL',
    ]]

    const result = await extractCVDataFromPdf(new Uint8Array([21, 22, 23]), 'jane_resume.pdf')

    expect(result.cvData.personalInfo.fullName).toBe('Jane Doe')
    expect(result.cvData.experience.length).toBeGreaterThan(0)
    expect(result.cvData.experience[0].startDate).not.toBe('')
    expect(result.cvData.experience[0].endDate).not.toBe('')
    expect(result.cvData.experience[0].description.join(' ')).toContain('Built distributed APIs')
  })
})
