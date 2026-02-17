import { describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import { generateCVPDF } from '../utils/cvPdfGenerator'
import { createEmptyCVData, defaultCVSettings, type CVData, type CVTemplate } from '../types/cv'

const templateIds: CVTemplate[] = ['modern', 'classic', 'minimal', 'creative']

const fixtureCVData = (): CVData => ({
  ...createEmptyCVData(),
  personalInfo: {
    fullName: 'Template Test User',
    title: 'Senior Software Engineer',
    email: 'template@test.dev',
    phone: '+1 555 101 2020',
    location: 'Austin, TX',
    linkedin: 'linkedin.com/in/template-test',
    portfolio: 'https://template.dev',
    github: 'github.com/template-test',
  },
  summary: 'Engineer focused on scalable backend systems and high-performance developer tooling.',
  experience: [
    {
      id: 'exp-1',
      company: 'Example Systems',
      position: 'Senior Engineer',
      location: 'Austin, TX',
      startDate: '2021',
      endDate: 'Present',
      description: ['Designed and shipped resilient event-driven services.'],
      highlights: ['Reduced release incidents by 42% with stronger observability standards.'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'State University',
      degree: 'BSc',
      field: 'Computer Science',
      endDate: '2018',
    },
  ],
  skills: [
    { name: 'TypeScript', level: 'advanced', category: 'Backend' },
    { name: 'Node.js', level: 'advanced', category: 'Backend' },
    { name: 'PostgreSQL', level: 'advanced', category: 'Data' },
  ],
  certifications: [
    { id: 'cert-1', name: 'AWS Certified Developer', issuer: 'Amazon', date: '2024' },
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'Platform Toolkit',
      description: 'Internal developer platform used across multiple product teams.',
      technologies: ['TypeScript', 'Kafka', 'PostgreSQL'],
    },
  ],
  languages: [
    { name: 'English', proficiency: 'native' },
    { name: 'Spanish', proficiency: 'fluent' },
  ],
})

const toDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('cvPdfGenerator templates', () => {
  it('renders all four templates and produces distinct outputs', async () => {
    const cvData = fixtureCVData()
    const digests = new Set<string>()

    for (const template of templateIds) {
      const bytes = await generateCVPDF(cvData, {
        ...defaultCVSettings,
        template,
      })
      expect(bytes.length).toBeGreaterThan(1200)
      digests.add(toDigest(bytes))
    }

    expect(digests.size).toBe(templateIds.length)
  })
})

