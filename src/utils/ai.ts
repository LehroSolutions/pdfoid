// Built-in lightweight NLP utilities for summarization and keyword extraction

const defaultStopwords = new Set([
  'the','a','an','and','or','in','on','at','to','of','for','with','by','is','are','was','were','that','this','it','as','from','be','has','have','had','but','not','which'
])

function splitSentences(text: string): string[] {
  // naive sentence split
  return text
    .replace(/\r\n/g, ' ') 
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function tokenizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !defaultStopwords.has(w))
}

function sentenceSimilarity(aWords: string[], bWords: string[]) {
  if (aWords.length === 0 || bWords.length === 0) return 0
  const aSet = new Set(aWords)
  let common = 0
  for (const w of bWords) if (aSet.has(w)) common++
  return common / (Math.log(aWords.length + 1) + Math.log(bWords.length + 1))
}

export interface SmartSection {
  title: string
  snippet: string
  page: number
  score: number
}

export interface SemanticHit {
  question: string
  answer: string
  page: number
  score: number
}

/**
 * Graph-based sentence ranking summary.
 */
export function summarizeText(text: string, opts: { maxSentences?: number } = {}) {
  const maxSentences = opts.maxSentences ?? 5
  const sentences = splitSentences(text)
  if (sentences.length === 0) return ''
  if (sentences.length <= maxSentences) return sentences.join(' ')

  const tokenized = sentences.map((s) => tokenizeWords(s))
  const n = sentences.length
  const sim: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      sim[i][j] = sentenceSimilarity(tokenized[i], tokenized[j])
    }
  }

  const scores = Array(n).fill(1)
  const d = 0.85
  for (let iter = 0; iter < 20; iter++) {
    const next = Array(n).fill(1 - d)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const w = sim[j][i]
        if (w <= 0) continue
        const out = sim[j].reduce((a, b) => a + b, 0)
        if (out > 0) next[i] += (d * w * scores[j]) / out
      }
    }
    for (let i = 0; i < n; i++) scores[i] = next[i]
  }

  const idx = scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .slice(0, maxSentences)
    .map((x) => x.i)
    .sort((a, b) => a - b)

  return idx.map((i) => sentences[i]).join(' ')
}

/**
 * Simple frequency-based keyword extraction.
 */
export function extractKeywords(text: string, opts: { maxKeywords?: number } = {}) {
  const maxKeywords = opts.maxKeywords ?? 10
  const words = tokenizeWords(text)
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([w]) => w)
}

/**
 * Derive lightweight "smart sections" from full text.
 * We infer sections by splitting on headings / strong lines and score via keyword density.
 */
export function buildSmartSections(fullText: string, totalPages: number, opts: { maxSections?: number } = {}): SmartSection[] {
  const maxSections = opts.maxSections ?? 8
  const lines = fullText.split(/\r?\n/)
  if (!lines.length) return []

  const sections: { title: string; content: string[] }[] = []
  let currentTitle = 'Overview'
  let current: string[] = []

  const flush = () => {
    if (current.length) {
      sections.push({ title: currentTitle, content: current.slice() })
      current = []
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      current.push('')
      continue
    }

    const isHeading =
      /^#{1,6}\s+/.test(line) ||
      /^[A-Z0-9][A-Z0-9\s\-:&]{8,}$/.test(line) ||
      /^[-*]\s+[A-Z]/.test(line)

    if (isHeading) {
      flush()
      currentTitle = line.replace(/^#{1,6}\s+/, '').trim()
    } else {
      current.push(line)
    }
  }
  flush()

  if (!sections.length) {
    return [
      {
        title: 'Overview',
        snippet: lines.slice(0, 3).join(' '),
        page: 1,
        score: 1,
      },
    ]
  }

  const allTokens = tokenizeWords(fullText)
  const freq = new Map<string, number>()
  for (const w of allTokens) freq.set(w, (freq.get(w) ?? 0) + 1)
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])
  const topKeys = new Set(sorted.slice(0, 30).map(([w]) => w))

  const scored: SmartSection[] = sections.map((sec, idx) => {
    const text = sec.content.join(' ')
    const toks = tokenizeWords(text)
    let score = 0
    for (const t of toks) if (topKeys.has(t)) score += 1
    const norm = toks.length ? score / toks.length : 0
    return {
      title: sec.title || `Section ${idx + 1}`,
      snippet: text.slice(0, 260),
      page: Math.max(1, Math.min(totalPages || 1, idx + 1)),
      score: norm,
    }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections)
    .sort((a, b) => a.page - b.page || a.title.localeCompare(b.title))
}

/**
 * Very small "ask this document" helper.
 * Uses the same tokenization + sentence similarity to find best answer snippet.
 */
export function semanticSearch(fullText: string, question: string, totalPages: number, opts: { maxAnswers?: number } = {}): SemanticHit[] {
  const maxAnswers = opts.maxAnswers ?? 3
  const q = question.trim()
  if (!q || !fullText.trim()) return []

  const qTokens = tokenizeWords(q)
  if (!qTokens.length) return []

  const sentences = splitSentences(fullText)
  if (!sentences.length) return []

  const hits = sentences
    .map((s, i) => {
      const sTokens = tokenizeWords(s)
      const sim = sentenceSimilarity(qTokens, sTokens)
      if (!Number.isFinite(sim) || sim <= 0) return null
      return {
        question: q,
        answer: s,
        page: Math.max(1, Math.min(totalPages || 1, Math.round(((i + 1) / sentences.length) * (totalPages || 1)))),
        score: sim,
      } as SemanticHit
    })
    .filter((h): h is SemanticHit => !!h)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxAnswers)

  return hits
}

export default { summarizeText, extractKeywords, buildSmartSections, semanticSearch }
