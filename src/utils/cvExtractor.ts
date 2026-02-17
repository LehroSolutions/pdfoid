// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import type {
  CVCertification,
  CVData,
  CVEducation,
  CVExperience,
  CVLanguage,
  CVProject,
  CVSkill,
} from '../types/cv'
import { createEmptyCVData } from '../types/cv'

if ((pdfjsLib as any).GlobalWorkerOptions) {
  ; (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
}

const disablePdfJsWorker = import.meta.env?.VITE_PDFJS_DISABLE_WORKER === '1'

export const MIN_CV_PARSE_CONFIDENCE = 0.45
export const MAX_CV_PARSE_PAGES = 8

export interface CVExtractionResult {
  cvData: CVData
  confidence: number
  sectionsDetected: string[]
  missingSections: string[]
  warnings: string[]
  pagesScanned: number
}

interface LineItem {
  page: number
  text: string
  x: number
  y: number
}

interface ParsedLine {
  page: number
  y: number
  text: string
}

type CVSectionKey =
  | 'header'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'professionalDevelopment'

const SECTION_ORDER: CVSectionKey[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'languages',
  'professionalDevelopment',
]

const HEADING_PATTERNS: Array<{ key: CVSectionKey; patterns: RegExp[] }> = [
  { key: 'summary', patterns: [/professional summary/i, /\bsummary\b/i, /\bprofile\b/i, /\bobjective\b/i, /\babout\b/i, /\babout me\b/i] },
  {
    key: 'experience',
    patterns: [/\bexperience\b/i, /\bwork history\b/i, /\bemployment\b/i, /\bemployment history\b/i, /\bcareer\b/i, /\bwork experience\b/i, /\bwork experience\b/i],
  },
  { key: 'education', patterns: [/\beducation\b/i, /\bacademic\b/i, /\bqualifications?\b/i, /\bacademic background\b/i] },
  { key: 'skills', patterns: [/\bskills?\b/i, /\btechnical skills?\b/i, /\bcompetencies\b/i, /\btop skills\b/i, /\bcore skills\b/i, /\bkey skills\b/i, /\bexpertise\b/i, /\btechnologies\b/i] },
  { key: 'projects', patterns: [/\bprojects?\b/i, /\bportfolio\b/i, /\bkey projects\b/i, /\bselected projects\b/i] },
  { key: 'certifications', patterns: [/\bcertifications?\b/i, /\blicenses?\b/i, /\bcourses?\b/i, /\bcredentials?\b/i, /\bcert\b/i] },
  { key: 'languages', patterns: [/\blanguages?\b/i, /\blanguage skills?\b/i] },
  { key: 'professionalDevelopment', patterns: [/\bprofessional development\b/i, /\btraining\b/i, /\bworkshops?\b/i, /\bcontinuing education\b/i, /\bprofessional growth\b/i] },
]

// Patterns for non-section headings that should be filtered out
const NON_SECTION_HEADINGS = [
  /^contact$/i,
  /^personal\s*info/i,
  /^references$/i,
  /^interests$/i,
  /^hobbies$/i,
]

const MONTH_PATTERN =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DATE_RANGE_RE = new RegExp(
  `${MONTH_PATTERN}\\s+\\d{4}\\s*(?:-|to)\\s*(?:${MONTH_PATTERN}\\s+\\d{4}|present|current)`,
  'i'
)
const YEAR_RANGE_RE = /\b(19|20)\d{2}\s*(?:-|to)\s*((19|20)\d{2}|present|current)\b/i
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}\b/
const BULLET_PREFIX_RE = /^\s*([\-*•]|[0-9]+\.)\s*/
const LANGUAGE_TOKEN_RE =
  /english|spanish|french|german|arabic|portuguese|italian|chinese|mandarin|japanese|hindi|afrikaans|zulu|xhosa|russian|korean/i

const ROLE_KEYWORDS = [
  'engineer',
  'developer',
  'manager',
  'architect',
  'analyst',
  'consultant',
  'specialist',
  'lead',
  'director',
  'administrator',
  'designer',
]

const EDUCATION_KEYWORDS = [
  'university',
  'college',
  'institute',
  'school',
  'bachelor',
  'master',
  'phd',
  'diploma',
  'degree',
]

const SKILL_HINT_KEYWORDS = [
  'javascript',
  'typescript',
  'node',
  'react',
  'python',
  'java',
  'sql',
  'postgresql',
  'aws',
  'azure',
  'docker',
  'kubernetes',
  'figma',
  'photoshop',
]

const toId = (prefix: string, index: number) => `${prefix}-${index + 1}`

const normalizeTextArtifacts = (value: string) =>
  value
    .replace(/\u00a0/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/[•]/g, '*')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/â€“|â€”|â€‘/g, '-')
    .replace(/â€¢/g, '*')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€\x9d/g, '"')

const normalizeSpace = (value: string) => normalizeTextArtifacts(value).replace(/\s+/g, ' ').trim()

// Filter out page numbers and other non-content lines
const isPageNumber = (line: string) => {
  if (!line) return false
  const trimmed = line.trim().toLowerCase()
  // Match "page 1 of 3", "page 2 of 3", etc.
  if (/^page\s+\d+\s+of\s+\d+$/i.test(trimmed)) return true
  // Match standalone page numbers
  if (/^\d+$/.test(trimmed) && trimmed.length <= 2) return true
  return false
}

// Filter out artifact lines that shouldn't be captured
const isArtifactLine = (line: string) => {
  if (!line) return true
  const trimmed = line.trim().toLowerCase()
  if (isPageNumber(trimmed)) return true
  // Filter out non-section headings like "Contact", "References"
  if (isNonSectionHeading(line)) return true
  // Filter out very short fragments that are likely artifacts
  if (trimmed.length < 2) return true
  return false
}

const normalizeTextForHeading = (value: string) =>
  normalizeTextArtifacts(value)
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const cleanBullet = (value: string) => normalizeSpace(value.replace(BULLET_PREFIX_RE, ''))

const isLikelyHeading = (line: string) => {
  const normalized = normalizeTextForHeading(line)
  if (!normalized) return false
  if (normalized.length > 40) return false
  return HEADING_PATTERNS.some(({ patterns }) => patterns.some((pattern) => pattern.test(normalized)))
}

// Check if line is a non-section heading that should be filtered out (like "Contact", "References")
const isNonSectionHeading = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return false
  return NON_SECTION_HEADINGS.some((pattern) => pattern.test(trimmed))
}

const matchSectionHeading = (line: string): CVSectionKey | null => {
  const normalized = normalizeTextForHeading(line)
  if (!normalized) return null

  for (const def of HEADING_PATTERNS) {
    if (def.patterns.some((pattern) => pattern.test(normalized))) {
      return def.key
    }
  }
  return null
}

const hasDateRange = (line: string) => DATE_RANGE_RE.test(line) || YEAR_RANGE_RE.test(line)

const looksLikeUrl = (line: string) => /(https?:\/\/|www\.)/i.test(line)

const containsKeyword = (line: string, keywords: string[]) =>
  keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(line))

const isPotentialEducationLine = (line: string) => {
  if (!line || BULLET_PREFIX_RE.test(line)) return false
  return containsKeyword(line, EDUCATION_KEYWORDS) || /\b(gpa|honors?|coursework)\b/i.test(line)
}

const isPotentialSkillLine = (line: string) => {
  if (!line) return false
  const cleaned = cleanBullet(line)
  if (!cleaned || cleaned.length < 2) return false

  // Skip if it looks like a sentence (too many words)
  if (cleaned.split(' ').length > 15 && !cleaned.includes(':')) return false

  // Check if line is a section heading - if so, don't treat as skill
  if (isLikelyHeading(cleaned)) return false

  // Skip lines that look like prose/paragraphs (contain common sentence patterns)
  if (/^(i am|i have|the|this|that|with|for|and|working|building|developing|using|certified|mastered|gained)\s/i.test(cleaned)) return false
  if (/\b(knowledge|experience|working|building|developing|focused|learning|environment|concepts|solutions|applications|platforms|projects)\b/i.test(cleaned)) return false

  // Skip lines that are clearly prose sentences (have multiple common words)
  const proseWordCount = (cleaned.match(/\b(i|the|a|an|and|or|to|for|with|in|on|at|by|from|that|this|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|must|can)\b/gi) || []).length
  if (proseWordCount >= 3) return false

  // Lines with skills/technologies/stack/tools keywords
  if (/\bskills?\b|\btechnologies\b|\bstack\b|\btools?\b/i.test(cleaned)) return true

  // Lines with skill keywords and separators
  if (containsKeyword(cleaned, SKILL_HINT_KEYWORDS) && /[,|/]/.test(cleaned)) return true

  // Categorized skills with colon (e.g., "Backend: Node.js, TypeScript")
  if (cleaned.includes(':')) {
    const [category, values = ''] = cleaned.split(':', 2)
    // Category should be short and not a sentence
    if (category.length > 30) return false
    // Skip if category looks like prose
    if (/^(i|the|this|that|my|our|we)\b/i.test(category)) return false
    const items = values.split(/[,|/]/).map((item) => normalizeSpace(item)).filter(Boolean)
    // Must have at least one value after the colon
    return items.length >= 1
  }

  // Individual skill names on separate lines (e.g., "Node.js", "React", "Java")
  // Must be short, not a sentence, and contain a known skill keyword
  const words = cleaned.split(/\s+/)
  if (words.length <= 4 && cleaned.length <= 40) {
    // Check if it looks like a skill name (contains tech keywords or has typical skill patterns)
    if (containsKeyword(cleaned, SKILL_HINT_KEYWORDS)) return true
    // Check for common skill patterns like ".js", "react", "sql", etc.
    if (/\.(js|ts|net|io)|sql|api|aws|azure|git|cli|sdk|css|html|json|yaml|rest|graphql/i.test(cleaned)) return true
  }

  const commaPieces = cleaned.split(/[,|/]/).map((item) => normalizeSpace(item)).filter(Boolean)
  return commaPieces.length >= 3 && containsKeyword(cleaned, SKILL_HINT_KEYWORDS)
}

const isPotentialExperienceEntry = (line: string) => {
  if (!line) return false
  if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
  if (BULLET_PREFIX_RE.test(line)) return false
  if (hasDateRange(line)) return true
  if (/\sat\s/i.test(line) && containsKeyword(line, ROLE_KEYWORDS)) return true
  if (line.includes('|') && (containsKeyword(line, ROLE_KEYWORDS) || /present|current/i.test(line))) return true
  return false
}

const inferFallbackSectionLines = (lines: string[]) => {
  const fallback: Record<
    Exclude<CVSectionKey, 'header' | 'summary' | 'professionalDevelopment'>,
    string[]
  > = {
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
  }

  let capturingExperienceBullets = false
  for (const rawLine of lines) {
    const line = normalizeSpace(rawLine)
    if (!line || isLikelyHeading(line)) {
      capturingExperienceBullets = false
      continue
    }

    if (isPotentialExperienceEntry(line)) {
      fallback.experience.push(line)
      capturingExperienceBullets = true
    } else if (capturingExperienceBullets && BULLET_PREFIX_RE.test(line)) {
      fallback.experience.push(line)
    } else {
      capturingExperienceBullets = false
    }

    if (isPotentialEducationLine(line)) fallback.education.push(line)
    if (isPotentialSkillLine(line)) fallback.skills.push(line)
    if (/\bprojects?\b/i.test(line) || /github\.com\//i.test(line)) fallback.projects.push(line)
    if (/\b(cert|certificate|certification|license|credential)\b/i.test(line)) {
      fallback.certifications.push(line)
    }
    if (LANGUAGE_TOKEN_RE.test(line)) fallback.languages.push(line)
  }

  return {
    experience: [...new Set(fallback.experience)],
    education: [...new Set(fallback.education)],
    skills: [...new Set(fallback.skills)],
    projects: [...new Set(fallback.projects)],
    certifications: [...new Set(fallback.certifications)],
    languages: [...new Set(fallback.languages)],
  }
}

const extractLinesFromPdf = async (
  bytes: Uint8Array,
  maxPages: number
): Promise<{ lines: ParsedLine[]; pagesScanned: number }> => {
  const reader = await (pdfjsLib as any).getDocument({
    data: bytes.slice(),
    disableWorker: disablePdfJsWorker,
  }).promise
  const pagesScanned = Math.min(maxPages, reader.numPages || maxPages)
  const items: LineItem[] = []

  for (let page = 1; page <= pagesScanned; page++) {
    const pdfPage = await reader.getPage(page)
    const content = await pdfPage.getTextContent()
    const contentItems = Array.isArray(content.items) ? (content.items as any[]) : []
    for (const item of contentItems) {
      const text = normalizeSpace(typeof item?.str === 'string' ? item.str : '')
      if (!text) continue
      const transform = Array.isArray(item?.transform) ? item.transform : []
      const x = typeof transform[4] === 'number' ? transform[4] : 0
      const y = typeof transform[5] === 'number' ? transform[5] : 0
      items.push({ page, text, x, y })
    }
  }

  try {
    await reader.destroy()
  } catch {
    // Ignore cleanup errors.
  }

  const byPage = new Map<number, LineItem[]>()
  for (const item of items) {
    const current = byPage.get(item.page) || []
    current.push(item)
    byPage.set(item.page, current)
  }

  const parsedLines: ParsedLine[] = []
  const yTolerance = 2.5

  // Known PDF layout constants (from cvPdfGenerator.ts)
  // PAGE_WIDTH = 595.28, MARGIN = 50, sidebarWidth = 160-175
  // Left sidebar: x = 50 to 225 (approx)
  // Right sidebar: x = 420 to 545 (approx)
  // Main content (left sidebar): x = 225 to 545
  // Main content (right sidebar): x = 50 to 420

  const SIDEBAR_LEFT_MAX = 230  // Maximum X for left sidebar content
  const SIDEBAR_RIGHT_MIN = 400 // Minimum X for right sidebar content

  for (const [page, pageItems] of byPage.entries()) {
    // Detect multi-column layout by checking for items in both sidebar and main areas
    const hasLeftSidebar = pageItems.some((item) => item.x < SIDEBAR_LEFT_MAX && item.x > 40)
    const hasRightSidebar = pageItems.some((item) => item.x > SIDEBAR_RIGHT_MIN)
    const hasMainContent = pageItems.some((item) => item.x > SIDEBAR_LEFT_MAX && item.x < SIDEBAR_RIGHT_MIN)

    // Determine layout type
    const isLeftSidebarLayout = hasLeftSidebar && hasMainContent
    const isRightSidebarLayout = hasRightSidebar && hasMainContent

    const processColumn = (columnItems: LineItem[]) => {
      columnItems.sort((a, b) => {
        if (Math.abs(a.y - b.y) > yTolerance) return b.y - a.y
        return a.x - b.x
      })

      const rows: Array<{ y: number; items: LineItem[] }> = []
      for (const item of columnItems) {
        const existing = rows.find((row) => Math.abs(row.y - item.y) <= yTolerance)
        if (existing) {
          existing.items.push(item)
        } else {
          rows.push({ y: item.y, items: [item] })
        }
      }

      rows.sort((a, b) => b.y - a.y)

      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x)
        const text = normalizeSpace(row.items.map((entry) => entry.text).join(' '))
        if (!text) continue
        parsedLines.push({ page, y: row.y, text })
      }
    }

    if (isLeftSidebarLayout) {
      // Split at the boundary between sidebar and main content
      const sidebarItems = pageItems.filter((item) => item.x < SIDEBAR_LEFT_MAX)
      const mainItems = pageItems.filter((item) => item.x >= SIDEBAR_LEFT_MAX)

      // Process sidebar first, then main content
      processColumn(sidebarItems)
      processColumn(mainItems)
    } else if (isRightSidebarLayout) {
      // Split at the boundary between main content and sidebar
      const mainItems = pageItems.filter((item) => item.x < SIDEBAR_RIGHT_MIN)
      const sidebarItems = pageItems.filter((item) => item.x >= SIDEBAR_RIGHT_MIN)

      // Process main content first, then sidebar
      processColumn(mainItems)
      processColumn(sidebarItems)
    } else {
      // Single column layout - process normally
      processColumn(pageItems)
    }
  }

  return { lines: parsedLines, pagesScanned }
}

const splitSections = (lines: ParsedLine[]) => {
  const sectionLines = new Map<CVSectionKey, string[]>()
  sectionLines.set('header', [])
  for (const key of SECTION_ORDER) sectionLines.set(key, [])

  let current: CVSectionKey = 'header'
  const headingHits = new Set<CVSectionKey>()

  for (const line of lines) {
    // Skip page numbers and artifact lines
    if (isArtifactLine(line.text)) continue

    const heading = matchSectionHeading(line.text)
    if (heading) {
      current = heading
      headingHits.add(heading)
      continue
    }
    sectionLines.get(current)!.push(line.text)
  }

  return { sectionLines, headingHits: [...headingHits] }
}

const extractPersonalInfo = (headerLines: string[], allLines: string[]) => {
  const info = createEmptyCVData().personalInfo
  // Search entire document for contact info, not just first 12 lines
  const uniqueLines = [...new Set(allLines.map((line) => normalizeSpace(line)).filter(Boolean))]

  // Find email anywhere in document
  const emailLine = uniqueLines.find((line) => EMAIL_RE.test(line))
  if (emailLine) {
    const match = emailLine.match(EMAIL_RE)
    if (match) info.email = match[0]
  }

  // Find phone anywhere in document
  const phoneLine = uniqueLines.find((line) => PHONE_RE.test(line))
  if (phoneLine) {
    const match = phoneLine.match(PHONE_RE)
    if (match) info.phone = normalizeSpace(match[0])
  }

  // Find social links anywhere in document
  // Handle LinkedIn URLs that may be split across lines
  for (let i = 0; i < uniqueLines.length; i++) {
    const line = uniqueLines[i]
    const nextLine = uniqueLines[i + 1] || ''

    // Skip if already found LinkedIn
    if (info.linkedin) continue

    // LinkedIn - handle various formats including split URLs
    if (/linkedin\.com\//i.test(line)) {
      // Extract the URL part - stop at any parenthesis, label, or section heading
      let urlPart = line
      // Remove labels like "(LinkedIn)" or "(Portfolio)"
      urlPart = urlPart.replace(/\s*\([^)]+\)\s*$/g, '')
      // Stop at common section headings that might be merged
      urlPart = urlPart.replace(/(SKILLS|EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATIONS|LANGUAGES|SUMMARY|CONTACT).*$/i, '')
      // Extract just the URL
      const match = urlPart.match(/(?:www\.)?(linkedin\.com\/in\/[a-zA-Z0-9\-_]*)/i)
      if (match) {
        info.linkedin = match[1]
      } else {
        const fallbackMatch = urlPart.match(/(?:www\.)?(linkedin\.com\/[^\s]*)/i)
        if (fallbackMatch) {
          info.linkedin = fallbackMatch[1]
        } else {
          info.linkedin = urlPart.replace(/^www\./i, '').trim()
        }
      }

      // Check if URL might continue on next line (e.g., "linkedin.com/in/username" + "-suffix")
      // Only if current URL ends with a partial path (no complete slug)
      if (info.linkedin && /linkedin\.com\/in\/[a-zA-Z0-9\-]*$/i.test(info.linkedin)) {
        const nextTrimmed = nextLine.trim()
        // Next line must start with continuation character and be short
        if (/^-[a-zA-Z0-9\-]+$/.test(nextTrimmed) && nextTrimmed.length < 25) {
          info.linkedin = info.linkedin + nextTrimmed
        }
      }
    }

    if (/github\.com\//i.test(line)) {
      const match = line.match(/(?:www\.)?(github\.com\/[^\s]*)/i)
      if (match) {
        info.github = match[1]
      } else {
        info.github = line.replace(/^www\./i, '')
      }
    }
    if (looksLikeUrl(line) && !/linkedin\.com\/|github\.com\//i.test(line)) {
      info.portfolio = line.replace(/^www\./i, '')
    }
  }

  // Find name - look for title case name early in document (first 20 lines)
  const earlyLines = uniqueLines.slice(0, 20)
  const candidateName = earlyLines.find((line) => {
    if (line.length < 4 || line.length > 80) return false
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) return false
    if (looksLikeUrl(line) || isLikelyHeading(line)) return false
    const words = line.split(/\s+/)
    if (words.length < 2 || words.length > 6) return false
    const titleCase = words.every((word) => /^[A-Z][a-zA-Z'.-]+$/.test(word))
    const upperCase = words.every((word) => /^[A-Z'.-]+$/.test(word))
    return titleCase || upperCase
  })
  if (candidateName) {
    info.fullName = /^[A-Z\s'.-]+$/.test(candidateName)
      ? candidateName.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
      : candidateName
  }

  // Find title - look for job titles anywhere in document
  const candidateTitle = uniqueLines.find((line) => {
    if (!line || line === info.fullName) return false
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
    if (isLikelyHeading(line)) return false
    return /engineer|developer|designer|manager|architect|analyst|consultant|specialist|founder|lead|director|administrator|co-founder|backend|frontend|full.stack/i.test(line)
  })
  if (candidateTitle) info.title = candidateTitle

  // Find location - look for location patterns
  const candidateLocation = uniqueLines.find((line) => {
    if (!line || line === info.fullName || line === info.title) return false
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
    if (/\d/.test(line)) return false
    // Skip "Contact" and other section headings
    if (isLikelyHeading(line)) return false
    // Skip short words that might be artifacts
    if (line.length < 5) return false
    // Look for city, state, country patterns with commas
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+(\s+[A-Z][a-z]+)*/.test(line)) return true
    // Look for known location keywords
    if (/\b(city|state|country|province|region|johannesburg|cape town|durban|pretoria|south africa|gauteng)\b/i.test(line)) return true
    return false
  })
  if (candidateLocation) info.location = candidateLocation

  return info
}

const parseSkills = (lines: string[]): CVSkill[] => {
  const skills: CVSkill[] = []
  const seen = new Set<string>()
  const inferLevel = (value: string): CVSkill['level'] => {
    if (/\bexpert\b/i.test(value)) return 'expert'
    if (/\badvanced\b|\bsenior\b/i.test(value)) return 'advanced'
    if (/\bbasic\b|\bbeginner\b/i.test(value)) return 'beginner'
    return 'intermediate'
  }

  for (const line of lines) {
    const cleaned = cleanBullet(line)
    if (!cleaned) continue
    if (isArtifactLine(cleaned)) continue
    if (!isPotentialSkillLine(cleaned)) continue

    // Categorized skills with colon (e.g., "Backend: Node.js, TypeScript")
    if (cleaned.includes(':')) {
      const [rawCategory, rawValues] = cleaned.split(':', 2)
      const category = normalizeSpace(rawCategory)
      const values = rawValues.split(/[,|/]/).map((item) => normalizeSpace(item)).filter(Boolean)
      for (const name of values) {
        const key = `${category}:${name}`.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        skills.push({ name: name.replace(/\((.*?)\)/g, '').trim(), level: inferLevel(name), category })
      }
      continue
    }

    // Check if line has separators
    const values = cleaned.split(/[,|/]/).map((item) => normalizeSpace(item)).filter(Boolean)

    // If multiple values separated by commas/pipes, treat as separate skills
    if (values.length >= 2) {
      for (const value of values) {
        const canonical = value.replace(/\((.*?)\)/g, '').trim()
        const key = canonical.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        skills.push({ name: canonical, level: inferLevel(value) })
      }
    } else {
      // Single skill on its own line (e.g., "Node.js", "React")
      const canonical = cleaned.replace(/\((.*?)\)/g, '').trim()
      const key = canonical.toLowerCase()
      if (!seen.has(key) && canonical.length >= 2) {
        seen.add(key)
        skills.push({ name: canonical, level: inferLevel(cleaned) })
      }
    }
  }

  return skills
}

const collectDescriptionLines = (lines: string[]) =>
  lines
    .map((line) => cleanBullet(line))
    .filter((line) => line.length > 1)

const parseDateRange = (line: string): { startDate: string; endDate: string } | null => {
  const normalized = normalizeTextArtifacts(line)

  const monthMatch = normalized.match(
    new RegExp(
      `(${MONTH_PATTERN}\\s+\\d{4})\\s*(?:-|to)\\s*(${MONTH_PATTERN}\\s+\\d{4}|present|current)`,
      'i'
    )
  )
  if (monthMatch) {
    return { startDate: monthMatch[1], endDate: monthMatch[2] }
  }

  const looseMonthMatch = normalized.match(
    new RegExp(`(${MONTH_PATTERN}\\s+\\d{4})\\D+(${MONTH_PATTERN}\\s+\\d{4}|present|current)`, 'i')
  )
  if (looseMonthMatch) {
    return { startDate: looseMonthMatch[1], endDate: looseMonthMatch[2] }
  }

  const yearMatch = normalized.match(/\b((?:19|20)\d{2})\s*(?:-|to)\s*((?:19|20)\d{2}|present|current)\b/i)
  if (yearMatch) {
    return { startDate: yearMatch[1], endDate: yearMatch[2] }
  }

  const looseYearMatch = normalized.match(/\b((?:19|20)\d{2})\D+((?:19|20)\d{2}|present|current)\b/i)
  if (looseYearMatch) {
    return { startDate: looseYearMatch[1], endDate: looseYearMatch[2] }
  }

  return null
}

const parseExperienceHeader = (
  line: string
): { position: string; company: string; location?: string; startDate: string; endDate: string } => {
  const stripped = normalizeSpace(line.replace(/\s*[|*]\s*/g, ' | '))
  const dateRange = parseDateRange(stripped)
  const withoutDates = normalizeSpace(
    stripped
      .replace(DATE_RANGE_RE, '')
      .replace(YEAR_RANGE_RE, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
  )

  let position = ''
  let company = ''
  let location: string | undefined

  if (/\sat\s/i.test(withoutDates)) {
    const [left, right] = withoutDates.split(/\sat\s/i, 2)
    position = normalizeSpace(left)
    const rightParts = right.split('|').map((part) => normalizeSpace(part)).filter(Boolean)
    company = rightParts[0] || ''
    location = rightParts[1]
  } else {
    const parts = withoutDates.split('|').map((part) => normalizeSpace(part)).filter(Boolean)
    if (parts.length >= 2) {
      position = parts[0]
      company = parts[1]
      location = parts[2]
    } else {
      const dashParts = withoutDates.split(/\s-\s/).map((part) => normalizeSpace(part)).filter(Boolean)
      position = dashParts[0] || withoutDates
      company = dashParts[1] || ''
      location = dashParts[2]
    }
  }

  return {
    position: position || withoutDates,
    company: company || 'Unknown Company',
    location,
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
  }
}

const parseExperience = (lines: string[]): CVExperience[] => {
  const experiences: CVExperience[] = []
  let current: CVExperience | null = null

  const pushCurrent = () => {
    if (!current) return
    if (!current.position && !current.company) return
    current.description = current.description.filter(Boolean)
    experiences.push(current)
    current = null
  }

  // Helper to check if line looks like a company name (proper noun, short)
  const looksLikeCompanyName = (line: string) => {
    if (!line || line.length > 60) return false
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
    if (BULLET_PREFIX_RE.test(line)) return false
    if (hasDateRange(line)) return false
    if (isArtifactLine(line)) return false
    // Company names are usually title case or all caps, short, no role keywords
    const words = line.split(/\s+/)
    if (words.length > 5) return false
    // Check it's not a role/position
    if (containsKeyword(line, ROLE_KEYWORDS)) return false
    // Check it looks like a proper noun (capitalized words)
    const isTitleCase = words.every(w => /^[A-Z][a-zA-Z&.\-]+$/.test(w) || /^(and|&|of|the)$/i.test(w))
    return isTitleCase || words.length <= 2
  }

  // Helper to check if line looks like a position/title
  const looksLikePosition = (line: string) => {
    if (!line || line.length > 80) return false
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
    if (BULLET_PREFIX_RE.test(line)) return false
    if (hasDateRange(line)) return false
    if (isArtifactLine(line)) return false
    return containsKeyword(line, ROLE_KEYWORDS) || /\b(founder|owner|partner|principal|executive|co-founder)\b/i.test(line)
  }

  // Helper to check if line is just a date range
  const isJustDateRange = (line: string) => {
    if (!line) return false
    if (isArtifactLine(line)) return false
    const cleaned = normalizeSpace(line.replace(/\(.*?\)/g, '').trim())
    return hasDateRange(cleaned) && cleaned.length < 40
  }

  // Helper to check if line looks like a location
  const looksLikeLocation = (line: string) => {
    if (!line || line.length > 60) return false
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
    if (BULLET_PREFIX_RE.test(line)) return false
    if (hasDateRange(line)) return false
    if (isArtifactLine(line)) return false
    // Locations often have commas and city/state/country patterns
    return /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+(\s+[A-Z][a-z]+)*/.test(line) ||
      /\b(city|state|country|province|region)\b/i.test(line) ||
      /\b(johannesburg|cape town|durban|pretoria|south africa|gauteng)\b/i.test(line)
  }

  for (const line of lines) {
    const cleaned = normalizeSpace(line)
    if (!cleaned) continue
    if (isArtifactLine(cleaned)) continue

    const bulletLike = BULLET_PREFIX_RE.test(cleaned)
    const entrySignal = !bulletLike && isPotentialExperienceEntry(cleaned)

    // Check for multi-line experience format
    const isCompanyLine = looksLikeCompanyName(cleaned)
    const isPositionLine = looksLikePosition(cleaned)
    const isDateLine = isJustDateRange(cleaned)
    const isLocationLine = looksLikeLocation(cleaned)

    if (entrySignal) {
      pushCurrent()
      const parsed = parseExperienceHeader(cleaned)
      current = {
        id: toId('exp', experiences.length),
        company: parsed.company,
        position: parsed.position,
        location: parsed.location,
        startDate: parsed.startDate,
        endDate: parsed.endDate || 'Present',
        description: [],
      }
      continue
    }

    // Handle multi-line format: Company on one line, position on next, date on next
    // Only start a new entry if we don't have a pending one waiting for position
    if (isCompanyLine && !current) {
      // Start a new experience with just company name
      current = {
        id: toId('exp', experiences.length),
        company: cleaned,
        position: '',
        startDate: '',
        endDate: 'Present',
        description: [],
      }
      continue
    }

    if (current) {
      // Fill in missing fields for multi-line format
      // Position is most important - if we have company but no position, this fills it
      if (isPositionLine && !current.position) {
        current.position = cleaned
        continue
      }
      // If we have a company-only entry and the next line is a date, skip to description
      if (isDateLine && !current.startDate) {
        const dateRange = parseDateRange(cleaned)
        if (dateRange) {
          current.startDate = dateRange.startDate
          current.endDate = dateRange.endDate || 'Present'
        }
        continue
      }
      if (isLocationLine && !current.location) {
        current.location = cleaned
        continue
      }

      // If current has company but no position yet, and this line isn't a position/date/location,
      // it might be a description line. But only add if we have at least a position.
      if (current.position && !bulletLike) {
        const bulletText = cleanBullet(cleaned)
        if (bulletText) current.description.push(bulletText)
        continue
      }

      // If current has company but no position, and this line isn't a position,
      // check if it's a bullet point (description)
      if (!current.position && bulletLike) {
        // This might be a description, but we need a position first
        // For now, skip this - the position should come before bullets
        continue
      }
    }

    // If no current entry and this isn't a company/position line, skip
    if (!current) {
      // Try to create an entry from what looks like a position
      if (isPositionLine) {
        current = {
          id: toId('exp', experiences.length),
          company: '',
          position: cleaned,
          startDate: '',
          endDate: 'Present',
          description: [],
        }
      }
      continue
    }

    const bulletText = cleanBullet(cleaned)
    if (bulletText && current.position) current.description.push(bulletText)
  }

  pushCurrent()

  return experiences.map((exp, idx) => ({
    ...exp,
    id: toId('exp', idx),
    description: exp.description.length ? exp.description : ['Details available in source CV'],
  }))
}

const parseEducation = (lines: string[]): CVEducation[] => {
  const education: CVEducation[] = []
  let current: CVEducation | null = null

  const pushCurrent = () => {
    if (!current) return
    if (!current.institution && !current.degree) return
    education.push(current)
    current = null
  }

  for (const line of lines) {
    const cleaned = normalizeSpace(line)
    if (!cleaned) continue
    if (isArtifactLine(cleaned)) continue

    const isEntry =
      /\buniversity\b|\bcollege\b|\binstitute\b|\bschool\b/i.test(cleaned) ||
      /\bbachelor\b|\bmaster\b|\bphd\b|\bdiploma\b|\bcertificate\b/i.test(cleaned)

    if (isEntry && !BULLET_PREFIX_RE.test(cleaned)) {
      pushCurrent()
      const parts = cleaned.split('|').map((part) => normalizeSpace(part)).filter(Boolean)
      const dateRange = parseDateRange(cleaned)
      current = {
        id: toId('edu', education.length),
        institution: parts[0] || '',
        degree: parts[1] || '',
        field: '',
        location: parts[2],
        startDate: dateRange?.startDate || '',
        endDate: dateRange?.endDate || '',
        highlights: [],
      }
      continue
    }

    if (!current) continue
    const bullet = cleanBullet(cleaned)
    if (!bullet) continue

    if (!current.field && /\bcomputer|engineering|science|business|arts|law|medicine|finance|design\b/i.test(bullet)) {
      current.field = bullet
    } else if (/gpa/i.test(bullet)) {
      const gpaMatch = bullet.match(/gpa[:\s]*([0-9.]+)/i)
      if (gpaMatch) current.gpa = gpaMatch[1]
    } else {
      current.highlights = [...(current.highlights || []), bullet]
    }
  }

  pushCurrent()
  return education.map((entry, idx) => ({ ...entry, id: toId('edu', idx) }))
}

const parseProjects = (lines: string[]): CVProject[] => {
  const projects: CVProject[] = []
  let current: CVProject | null = null

  const pushCurrent = () => {
    if (!current) return
    if (!current.name) return
    if (!current.description) current.description = 'Project details available in source CV.'
    projects.push(current)
    current = null
  }

  // Known project names to look for
  const knownProjectNames = ['pdfoid', 'gidevo', 'mcpsooids', 'mcpsoids']

  for (const line of lines) {
    const cleaned = normalizeSpace(line)
    if (!cleaned) continue
    if (isArtifactLine(cleaned)) continue

    const bullet = cleanBullet(cleaned)
    const bulletLike = BULLET_PREFIX_RE.test(cleaned)

    // Check if this looks like a project title
    // Project titles are usually short, not bullets, and may contain known project names
    const isKnownProject = knownProjectNames.some((name) => cleaned.toLowerCase().includes(name))
    const looksLikeProjectTitle = !bulletLike && cleaned.length < 90 &&
      (isKnownProject || /^[A-Z][a-zA-Z0-9\s\-]+$/.test(cleaned)) &&
      !cleaned.includes(':') &&
      !isLikelyHeading(cleaned)

    if (looksLikeProjectTitle) {
      pushCurrent()
      current = {
        id: toId('proj', projects.length),
        name: bullet,
        description: '',
        technologies: [],
      }
      continue
    }

    if (!current) continue

    if (/github\.com\//i.test(bullet)) {
      current.github = bullet
    } else if (looksLikeUrl(bullet)) {
      current.url = bullet
    } else if (/tech(nologies)?[:\s]/i.test(bullet)) {
      const values = bullet
        .replace(/tech(nologies)?[:\s]*/i, '')
        .split(/[,|/]/)
        .map((item) => normalizeSpace(item))
        .filter(Boolean)
      current.technologies = [...(current.technologies || []), ...values]
    } else if (!current.description) {
      current.description = bullet
    } else {
      current.description = `${current.description} ${bullet}`.trim()
    }
  }

  pushCurrent()
  return projects.map((project, idx) => ({ ...project, id: toId('proj', idx) }))
}

const parseCertifications = (lines: string[]): CVCertification[] => {
  const certifications: CVCertification[] = []
  let current: CVCertification | null = null

  const pushCurrent = () => {
    if (!current) return
    if (!current.name) return
    certifications.push(current)
    current = null
  }

  for (const line of lines) {
    const cleaned = normalizeSpace(line)
    if (!cleaned) continue
    if (isArtifactLine(cleaned)) continue

    const bulletLike = BULLET_PREFIX_RE.test(cleaned)
    const bullet = cleanBullet(cleaned)

    // Check if this looks like a certification header line
    const isCertHeader = !bulletLike && (
      /\b(certified|certification|certificate|license|credential|associate)\b/i.test(cleaned) ||
      (cleaned.length > 15 && /\b(sap|aws|azure|google|oracle|microsoft|cisco|comptia|pmp)\b/i.test(cleaned))
    )

    if (isCertHeader) {
      pushCurrent()
      const parts = cleaned.split('|').map((part) => normalizeSpace(part)).filter(Boolean)
      const dateRange = parseDateRange(cleaned)
      current = {
        id: toId('cert', certifications.length),
        name: parts[0] || cleaned,
        issuer: parts[1] || '',
        date: dateRange?.endDate || dateRange?.startDate || '',
        details: [],
      }
      continue
    }

    // If we have a current certification, add bullet points as details
    if (current && bulletLike && bullet) {
      current.details = [...(current.details || []), bullet]
      continue
    }

    // If no current cert but line has cert keywords, create one
    if (!current && /\b(cert|certificate|certification|license)\b/i.test(cleaned)) {
      const parts = cleaned.split('|').map((part) => normalizeSpace(part)).filter(Boolean)
      const dateRange = parseDateRange(cleaned)
      current = {
        id: toId('cert', certifications.length),
        name: parts[0] || cleaned,
        issuer: parts[1] || '',
        date: dateRange?.endDate || dateRange?.startDate || '',
        details: [],
      }
    }
  }

  pushCurrent()
  return certifications.map((item, idx) => ({ ...item, id: toId('cert', idx) }))
}

const parseLanguages = (lines: string[]): CVLanguage[] => {
  const result: CVLanguage[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const cleaned = cleanBullet(line)
    if (!cleaned) continue
    if (isArtifactLine(cleaned)) continue

    const values = cleaned.split(/[,|/]/).map((item) => normalizeSpace(item)).filter(Boolean)
    for (const value of values) {
      const lower = value.toLowerCase()
      if (!LANGUAGE_TOKEN_RE.test(lower)) {
        continue
      }
      let proficiency: CVLanguage['proficiency'] = 'conversational'
      if (/native/i.test(lower)) proficiency = 'native'
      else if (/fluent|advanced/i.test(lower)) proficiency = 'fluent'
      else if (/basic/i.test(lower)) proficiency = 'basic'

      const name = value.replace(/\((.*?)\)/g, '').replace(/\b(native|fluent|advanced|basic|conversational)\b/gi, '').trim()
      const key = name.toLowerCase()
      if (!name || seen.has(key)) continue
      seen.add(key)
      result.push({ name, proficiency })
    }
  }

  return result
}

const parseSummary = (lines: string[]) => {
  // Filter out artifact lines and collect meaningful content
  const filtered = lines
    .map((line) => cleanBullet(line))
    .filter((line) => {
      if (!line || line.length < 10) return false
      if (isArtifactLine(line)) return false
      if (isLikelyHeading(line)) return false
      if (isNonSectionHeading(line)) return false
      // Skip lines that are just contact info
      if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
      // Skip lines that look like page numbers
      if (isPageNumber(line)) return false
      return true
    })

  // Join and truncate to reasonable length
  const summary = filtered.join(' ').replace(/\s+/g, ' ').slice(0, 1200).trim()
  return summary
}

const parseProfessionalDevelopment = (lines: string[]) => collectDescriptionLines(lines)

const sanitizeCVData = (cvData: CVData): CVData => {
  const dedupe = (items: string[]) => [...new Set(items.map((item) => normalizeSpace(item)).filter(Boolean))]

  const personalInfo = {
    ...cvData.personalInfo,
    fullName: normalizeSpace(cvData.personalInfo.fullName),
    title: normalizeSpace(cvData.personalInfo.title),
    email: normalizeSpace(cvData.personalInfo.email),
    phone: normalizeSpace(cvData.personalInfo.phone || ''),
    location: normalizeSpace(cvData.personalInfo.location || ''),
    linkedin: normalizeSpace(cvData.personalInfo.linkedin || ''),
    portfolio: normalizeSpace(cvData.personalInfo.portfolio || ''),
    github: normalizeSpace(cvData.personalInfo.github || ''),
  }

  const experience = cvData.experience
    .map((item, idx) => {
      const company = item.company === 'Unknown Company' ? '' : normalizeSpace(item.company)
      const position = normalizeSpace(item.position)
      const description = dedupe(item.description || []).slice(0, 8)
      if (!position && !company) return null
      const exp: CVExperience = {
        id: toId('exp', idx),
        company,
        position,
        startDate: normalizeSpace(item.startDate),
        endDate: normalizeSpace(item.endDate) || (item.startDate ? 'Present' : ''),
        description: description.length ? description : ['Details available in source CV'],
      }
      const location = normalizeSpace(item.location || '')
      if (location) exp.location = location
      if (item.highlights) exp.highlights = item.highlights
      return exp
    })
    .filter((item): item is CVExperience => Boolean(item))

  const education = cvData.education
    .map((item, idx) => {
      const institution = normalizeSpace(item.institution)
      const degree = normalizeSpace(item.degree)
      if (!institution && !degree) return null
      const edu: CVEducation = {
        id: toId('edu', idx),
        institution,
        degree,
        field: normalizeSpace(item.field),
        endDate: normalizeSpace(item.endDate),
        highlights: dedupe(item.highlights || []).slice(0, 6),
      }
      const location = normalizeSpace(item.location || '')
      if (location) edu.location = location
      const startDate = normalizeSpace(item.startDate || '')
      if (startDate) edu.startDate = startDate
      const gpa = normalizeSpace(item.gpa || '')
      if (gpa) edu.gpa = gpa
      return edu
    })
    .filter((item): item is CVEducation => Boolean(item))

  const skillKey = new Set<string>()
  const skills = cvData.skills
    .map((item) => ({
      ...item,
      name: normalizeSpace(item.name),
      category: normalizeSpace(item.category || ''),
    }))
    .filter((item) => item.name.length > 1)
    .filter((item) => {
      const key = `${item.category}:${item.name}`.toLowerCase()
      if (skillKey.has(key)) return false
      skillKey.add(key)
      return true
    })

  const certifications = cvData.certifications
    .map((item, idx) => ({
      ...item,
      id: toId('cert', idx),
      name: normalizeSpace(item.name),
      issuer: normalizeSpace(item.issuer),
      date: normalizeSpace(item.date),
      credentialId: normalizeSpace(item.credentialId || ''),
      url: normalizeSpace(item.url || ''),
      details: dedupe(item.details || []),
    }))
    .filter((item) => item.name.length > 1)

  const projects = cvData.projects
    .map((item, idx) => ({
      ...item,
      id: toId('proj', idx),
      name: normalizeSpace(item.name),
      description: normalizeSpace(item.description),
      technologies: dedupe(item.technologies || []),
      url: normalizeSpace(item.url || ''),
      github: normalizeSpace(item.github || ''),
    }))
    .filter((item) => item.name.length > 1)

  const languageKey = new Set<string>()
  const languages = cvData.languages
    .map((item) => ({
      ...item,
      name: normalizeSpace(item.name),
    }))
    .filter((item) => item.name.length > 1)
    .filter((item) => {
      const key = item.name.toLowerCase()
      if (languageKey.has(key)) return false
      languageKey.add(key)
      return true
    })

  return {
    ...cvData,
    personalInfo,
    summary: normalizeSpace(cvData.summary),
    experience,
    education,
    skills,
    certifications,
    projects,
    languages,
    professionalDevelopment: dedupe(cvData.professionalDevelopment || []),
  }
}

const toConfidenceScore = (args: {
  cvData: CVData
  sectionsDetected: string[]
  headingHits: string[]
  fileName: string
}) => {
  const { cvData, sectionsDetected, headingHits, fileName } = args
  let score = 0

  if (cvData.personalInfo.fullName) score += 0.14
  if (cvData.personalInfo.email) score += 0.14
  if (cvData.summary) score += 0.1
  if (cvData.experience.length > 0) score += 0.15
  if (cvData.education.length > 0) score += 0.12
  if (cvData.skills.length > 0) score += 0.12
  if (sectionsDetected.length > 0) score += Math.min(0.15, sectionsDetected.length * 0.03)
  if (headingHits.length > 0) score += Math.min(0.14, headingHits.length * 0.03)
  if (/\bcv\b|resume|curriculum[- ]vitae/i.test(fileName)) score += 0.08

  return Math.max(0, Math.min(1, Number(score.toFixed(3))))
}

export async function extractCVDataFromPdf(
  bytes: Uint8Array,
  fileName: string
): Promise<CVExtractionResult> {
  const { lines, pagesScanned } = await extractLinesFromPdf(bytes, MAX_CV_PARSE_PAGES)
  let cvData = createEmptyCVData()
  const warnings: string[] = []
  const allLines = lines.map((line) => line.text)
  const { sectionLines, headingHits } = splitSections(lines)
  const fallbackSectionLines = inferFallbackSectionLines(allLines)

  const experienceLines =
    (sectionLines.get('experience') || []).length > 0
      ? sectionLines.get('experience') || []
      : fallbackSectionLines.experience
  const educationLines =
    (sectionLines.get('education') || []).length > 0
      ? sectionLines.get('education') || []
      : fallbackSectionLines.education
  const skillsLines =
    (sectionLines.get('skills') || []).length > 0
      ? sectionLines.get('skills') || []
      : fallbackSectionLines.skills
  const projectLines =
    (sectionLines.get('projects') || []).length > 0
      ? sectionLines.get('projects') || []
      : fallbackSectionLines.projects
  const certificationLines =
    (sectionLines.get('certifications') || []).length > 0
      ? sectionLines.get('certifications') || []
      : fallbackSectionLines.certifications
  const languageLines =
    (sectionLines.get('languages') || []).length > 0
      ? sectionLines.get('languages') || []
      : fallbackSectionLines.languages

  cvData.personalInfo = extractPersonalInfo(sectionLines.get('header') || [], allLines)
  cvData.summary = parseSummary(sectionLines.get('summary') || [])
  if (!cvData.summary) {
    const fallbackSummary = [...(sectionLines.get('header') || []), ...allLines].find((line) => {
      if (!line || line.length < 40) return false
      if (EMAIL_RE.test(line) || PHONE_RE.test(line) || looksLikeUrl(line)) return false
      if (isLikelyHeading(line) || hasDateRange(line)) return false
      return true
    })
    if (fallbackSummary) cvData.summary = fallbackSummary
  }
  cvData.experience = parseExperience(experienceLines)
  cvData.education = parseEducation(educationLines)
  cvData.skills = parseSkills(skillsLines)
  cvData.projects = parseProjects(projectLines)
  cvData.certifications = parseCertifications(certificationLines)
  cvData.languages = parseLanguages(languageLines)
  cvData.professionalDevelopment = parseProfessionalDevelopment(
    sectionLines.get('professionalDevelopment') || []
  )
  cvData = sanitizeCVData(cvData)

  const sectionsDetected = SECTION_ORDER.filter((key) => {
    if (key === 'summary') return Boolean(cvData.summary)
    if (key === 'experience') return cvData.experience.length > 0
    if (key === 'education') return cvData.education.length > 0
    if (key === 'skills') return cvData.skills.length > 0
    if (key === 'projects') return cvData.projects.length > 0
    if (key === 'certifications') return cvData.certifications.length > 0
    if (key === 'languages') return cvData.languages.length > 0
    if (key === 'professionalDevelopment') return (cvData.professionalDevelopment || []).length > 0
    return false
  })

  const missingSections = SECTION_ORDER.filter((key) => !sectionsDetected.includes(key))

  if (!cvData.personalInfo.fullName) warnings.push('Could not confidently extract full name.')
  if (!cvData.personalInfo.email) warnings.push('Could not find email in the document.')
  if (!cvData.experience.length) warnings.push('No work experience section was parsed.')
  if (!cvData.education.length) warnings.push('No education section was parsed.')
  if (!cvData.skills.length) warnings.push('No skills section was parsed.')
  if (!cvData.summary) warnings.push('No summary/profile section was parsed.')

  const confidence = toConfidenceScore({
    cvData,
    sectionsDetected,
    headingHits,
    fileName,
  })

  return {
    cvData,
    confidence,
    sectionsDetected,
    missingSections,
    warnings,
    pagesScanned,
  }
}


