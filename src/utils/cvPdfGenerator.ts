/**
 * CV PDF Generator - Creates professional CV PDFs using pdf-lib
 * 
 * Design Philosophy: "Intentional Minimalism"
 * - Clean, modern layout with strategic whitespace
 * - Two-column design for information density
 * - Professional typography hierarchy
 * - Subtle color accents for visual interest
 */

// @ts-ignore
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { CVData, CVSettings } from '../types/cv'

// Color utilities
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return { r: 0.05, g: 0.15, b: 0.15 } // Default teal-dark
    return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
    }
}

const normalizeText = (text: string): string =>
    text.replace(/\s+/g, ' ').replace(/[–—‑]/g, '-').trim()

const makeColor = (r: number, g: number, b: number): { r: number; g: number; b: number } => ({
    r,
    g,
    b,
})

// Layout constants
const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89 // A4 height in points
const MARGIN = 36
const SIDEBAR_WIDTH = 170
const SIDEBAR_GAP = 24
const SIDEBAR_CONTENT_WIDTH = SIDEBAR_WIDTH - 12
const CONTENT_X = MARGIN + SIDEBAR_WIDTH + SIDEBAR_GAP
const CONTENT_WIDTH = PAGE_WIDTH - CONTENT_X - MARGIN

// Font size mappings
const FONT_SIZES = {
    small: { name: 20, sectionHeader: 10, body: 9, small: 8 },
    medium: { name: 24, sectionHeader: 11, body: 10, small: 9 },
    large: { name: 28, sectionHeader: 13, body: 11, small: 10 },
}

// Spacing mappings
const SPACING = {
    compact: { sectionGap: 12, itemGap: 6, lineGap: 2 },
    normal: { sectionGap: 16, itemGap: 8, lineGap: 4 },
    relaxed: { sectionGap: 20, itemGap: 10, lineGap: 6 },
}

interface LayoutContext {
    page: PDFPage
    y: number
    fontRegular: PDFFont
    fontBold: PDFFont
    fontItalic: PDFFont
    primaryColor: { r: number; g: number; b: number }
    secondaryColor: { r: number; g: number; b: number }
    fontSizes: typeof FONT_SIZES.medium
    spacing: typeof SPACING.normal
}

/**
 * Main function to generate CV PDF
 */
export async function generateCVPDF(cvData: CVData, settings: CVSettings): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()

    // Embed fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Create first page
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Initialize layout context
    const primaryColor = hexToRgb(settings.primaryColor)
    const secondaryColor = hexToRgb(settings.secondaryColor)
    const fontSizes = FONT_SIZES[settings.fontSize]
    const spacing = SPACING[settings.spacing]

    let ctx: LayoutContext = {
        page,
        y: PAGE_HEIGHT - MARGIN,
        fontRegular,
        fontBold,
        fontItalic,
        primaryColor,
        secondaryColor,
        fontSizes,
        spacing,
    }

    drawSidebar(ctx, cvData)
    let contentY = drawMainHeader(ctx, cvData, true)

    const ensureSpace = (minSpace: number) => {
        if (contentY < MARGIN + minSpace) {
            const next = addCVPage(pdfDoc, ctx, cvData, false)
            ctx = next.ctx
            contentY = next.contentY
        }
    }

    // Summary section
    if (cvData.summary) {
        contentY = drawSectionHeader(ctx, 'PROFESSIONAL SUMMARY', CONTENT_X, contentY, false, CONTENT_WIDTH)
        contentY -= spacing.itemGap
        contentY = drawWrappedText(ctx, cvData.summary, CONTENT_X, contentY, CONTENT_WIDTH, {
            size: fontSizes.body,
        })
        contentY -= spacing.sectionGap
    }

    // Experience section
    if (cvData.experience.length > 0) {
        ensureSpace(110)
        contentY = drawSectionHeader(ctx, 'EXPERIENCE', CONTENT_X, contentY, false, CONTENT_WIDTH)
        contentY -= spacing.itemGap

        for (const exp of cvData.experience) {
            ensureSpace(90)

            contentY = drawWrappedText(ctx, exp.position, CONTENT_X, contentY, CONTENT_WIDTH, {
                font: fontBold,
                size: fontSizes.body,
            })
            contentY -= spacing.lineGap

            const companyLine = `${exp.company}${exp.location ? ` | ${exp.location}` : ''}`
            contentY = drawWrappedText(ctx, companyLine, CONTENT_X, contentY, CONTENT_WIDTH, {
                font: fontItalic,
                size: fontSizes.small,
                color: makeColor(0.4, 0.4, 0.4),
            })
            contentY -= spacing.lineGap

            const dateRange = `${exp.startDate} - ${exp.endDate}`
            contentY = drawText(ctx, dateRange, CONTENT_X, contentY, {
                font: fontItalic,
                size: fontSizes.small,
                maxWidth: CONTENT_WIDTH,
                color: makeColor(0.45, 0.45, 0.45),
            })
            contentY -= spacing.lineGap

            const bulletItems = [...exp.description, ...(exp.highlights || [])]
            for (const desc of bulletItems) {
                contentY = drawBulletItem(ctx, desc, CONTENT_X, contentY, CONTENT_WIDTH, {
                    size: fontSizes.small,
                })
                contentY -= spacing.lineGap
            }
            contentY -= spacing.itemGap
        }
    }

    // Education section
    if (cvData.education.length > 0) {
        ensureSpace(90)
        contentY = drawSectionHeader(ctx, 'EDUCATION', CONTENT_X, contentY, false, CONTENT_WIDTH)
        contentY -= spacing.itemGap

        for (const edu of cvData.education) {
            ensureSpace(70)

            const degreeLine = `${edu.degree}${edu.field ? ` - ${edu.field}` : ''}`
            contentY = drawWrappedText(ctx, degreeLine, CONTENT_X, contentY, CONTENT_WIDTH, {
                font: fontBold,
                size: fontSizes.body,
            })
            contentY -= spacing.lineGap

            const institutionParts = [edu.institution, edu.location].filter(Boolean)
            contentY = drawWrappedText(ctx, institutionParts.join(' | '), CONTENT_X, contentY, CONTENT_WIDTH, {
                font: fontItalic,
                size: fontSizes.small,
                color: makeColor(0.4, 0.4, 0.4),
            })
            contentY -= spacing.lineGap

            if (edu.startDate || edu.endDate) {
                const dateRange = edu.startDate ? `${edu.startDate} - ${edu.endDate}` : edu.endDate
                contentY = drawText(ctx, dateRange, CONTENT_X, contentY, {
                    font: fontItalic,
                    size: fontSizes.small,
                    maxWidth: CONTENT_WIDTH,
                    color: makeColor(0.45, 0.45, 0.45),
                })
                contentY -= spacing.lineGap
            }

            if (edu.gpa) {
                contentY = drawText(ctx, `GPA: ${edu.gpa}`, CONTENT_X, contentY, {
                    size: fontSizes.small,
                    maxWidth: CONTENT_WIDTH,
                })
                contentY -= spacing.lineGap
            }

            if (edu.highlights && edu.highlights.length > 0) {
                for (const highlight of edu.highlights) {
                    contentY = drawBulletItem(ctx, highlight, CONTENT_X, contentY, CONTENT_WIDTH, {
                        size: fontSizes.small,
                    })
                    contentY -= spacing.lineGap
                }
            }

            contentY -= spacing.itemGap
        }
    }

    // Projects section
    if (cvData.projects.length > 0) {
        ensureSpace(90)
        contentY = drawSectionHeader(ctx, 'PROJECTS', CONTENT_X, contentY, false, CONTENT_WIDTH)
        contentY -= spacing.itemGap

        for (const project of cvData.projects) {
            ensureSpace(70)

            contentY = drawWrappedText(ctx, project.name, CONTENT_X, contentY, CONTENT_WIDTH, {
                font: fontBold,
                size: fontSizes.body,
                color: primaryColor,
            })
            contentY -= spacing.lineGap

            contentY = drawWrappedText(ctx, project.description, CONTENT_X, contentY, CONTENT_WIDTH, {
                size: fontSizes.small,
            })

            if (project.technologies && project.technologies.length > 0) {
                contentY -= spacing.lineGap
                contentY = drawWrappedText(ctx, `Tech: ${project.technologies.join(', ')}`, CONTENT_X, contentY, CONTENT_WIDTH, {
                    font: fontItalic,
                    size: fontSizes.small,
                    color: makeColor(0.5, 0.5, 0.5),
                })
            }

            if (project.url) {
                contentY -= spacing.lineGap
                contentY = drawWrappedText(ctx, project.url, CONTENT_X, contentY, CONTENT_WIDTH, {
                    size: fontSizes.small,
                    color: makeColor(0.35, 0.35, 0.35),
                })
            }

            contentY -= spacing.itemGap
        }
    }

    // Certifications section
    if (cvData.certifications.length > 0) {
        ensureSpace(80)
        contentY = drawSectionHeader(ctx, 'CERTIFICATIONS', CONTENT_X, contentY, false, CONTENT_WIDTH)
        contentY -= spacing.itemGap

        for (const cert of cvData.certifications) {
            ensureSpace(60)

            const certTitle = cert.issuer ? `${cert.name} - ${cert.issuer}` : cert.name
            contentY = drawWrappedText(ctx, certTitle, CONTENT_X, contentY, CONTENT_WIDTH, {
                font: fontBold,
                size: fontSizes.body,
            })
            contentY -= spacing.lineGap

            if (cert.date) {
                contentY = drawText(ctx, cert.date, CONTENT_X, contentY, {
                    font: fontItalic,
                    size: fontSizes.small,
                    maxWidth: CONTENT_WIDTH,
                    color: makeColor(0.45, 0.45, 0.45),
                })
                contentY -= spacing.lineGap
            }

            if (cert.details && cert.details.length > 0) {
                for (const detail of cert.details) {
                    contentY = drawBulletItem(ctx, detail, CONTENT_X, contentY, CONTENT_WIDTH, {
                        size: fontSizes.small,
                    })
                    contentY -= spacing.lineGap
                }
            }

            contentY -= spacing.itemGap
        }
    }

    // Professional development section
    if (cvData.professionalDevelopment && cvData.professionalDevelopment.length > 0) {
        ensureSpace(80)
        contentY = drawSectionHeader(ctx, 'PROFESSIONAL DEVELOPMENT', CONTENT_X, contentY, false, CONTENT_WIDTH)
        contentY -= spacing.itemGap

        for (const item of cvData.professionalDevelopment) {
            ensureSpace(50)
            contentY = drawBulletItem(ctx, item, CONTENT_X, contentY, CONTENT_WIDTH, {
                size: fontSizes.small,
            })
            contentY -= spacing.lineGap
        }
        contentY -= spacing.itemGap
    }

    return pdfDoc.save()
}

function addCVPage(
    pdfDoc: PDFDocument,
    ctx: LayoutContext,
    cvData: CVData,
    isFirstPage: boolean
): { ctx: LayoutContext; contentY: number } {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const nextCtx: LayoutContext = { ...ctx, page, y: PAGE_HEIGHT - MARGIN }
    drawSidebar(nextCtx, cvData)
    const contentY = drawMainHeader(nextCtx, cvData, isFirstPage)
    return { ctx: nextCtx, contentY }
}

function drawMainHeader(ctx: LayoutContext, cvData: CVData, isFirstPage: boolean): number {
    const nameSize = isFirstPage ? ctx.fontSizes.name + 2 : ctx.fontSizes.sectionHeader + 4
    const titleSize = isFirstPage ? ctx.fontSizes.body : ctx.fontSizes.small
    let y = PAGE_HEIGHT - MARGIN

    y = drawText(ctx, cvData.personalInfo.fullName, CONTENT_X, y, {
        font: ctx.fontBold,
        size: nameSize,
        maxWidth: CONTENT_WIDTH,
        color: ctx.primaryColor,
    })
    y -= ctx.spacing.lineGap

    if (cvData.personalInfo.title) {
        y = drawWrappedText(ctx, cvData.personalInfo.title, CONTENT_X, y, CONTENT_WIDTH, {
            font: ctx.fontItalic,
            size: titleSize,
            color: makeColor(0.35, 0.35, 0.35),
        })
    }

    y -= ctx.spacing.itemGap
    ctx.page.drawLine({
        start: { x: CONTENT_X, y: y - 2 },
        end: { x: CONTENT_X + CONTENT_WIDTH, y: y - 2 },
        thickness: 1,
        color: rgb(ctx.secondaryColor.r, ctx.secondaryColor.g, ctx.secondaryColor.b),
    })

    return y - ctx.spacing.sectionGap
}

function drawSidebar(ctx: LayoutContext, cvData: CVData): void {
    // Sidebar background
    ctx.page.drawRectangle({
        x: 0,
        y: 0,
        width: SIDEBAR_WIDTH + MARGIN,
        height: PAGE_HEIGHT,
        color: rgb(0.96, 0.97, 0.98),
    })

    // Accent bar
    ctx.page.drawRectangle({
        x: SIDEBAR_WIDTH + MARGIN - 3,
        y: 0,
        width: 3,
        height: PAGE_HEIGHT,
        color: rgb(ctx.primaryColor.r, ctx.primaryColor.g, ctx.primaryColor.b),
    })

    let sidebarY = PAGE_HEIGHT - MARGIN

    sidebarY = drawSectionHeader(ctx, 'CONTACT', MARGIN, sidebarY, true, SIDEBAR_WIDTH)
    sidebarY -= ctx.spacing.itemGap

    sidebarY = drawSidebarItem(ctx, 'Email', cvData.personalInfo.email, sidebarY)
    sidebarY = drawSidebarItem(ctx, 'Phone', cvData.personalInfo.phone, sidebarY)
    sidebarY = drawSidebarItem(ctx, 'Location', cvData.personalInfo.location, sidebarY)
    sidebarY = drawSidebarItem(ctx, 'LinkedIn', cvData.personalInfo.linkedin, sidebarY)
    sidebarY = drawSidebarItem(ctx, 'Portfolio', cvData.personalInfo.portfolio, sidebarY)
    sidebarY = drawSidebarItem(ctx, 'GitHub', cvData.personalInfo.github, sidebarY)

    if (cvData.skills.length > 0) {
        sidebarY -= ctx.spacing.sectionGap
        sidebarY = drawSectionHeader(ctx, 'SKILLS', MARGIN, sidebarY, true, SIDEBAR_WIDTH)
        sidebarY -= ctx.spacing.itemGap

        const skillsByCategory = cvData.skills.reduce((acc, skill) => {
            const category = skill.category || 'General'
            if (!acc[category]) acc[category] = []
            acc[category].push(skill)
            return acc
        }, {} as Record<string, typeof cvData.skills>)

        const categoryOrder = [
            'Backend Development',
            'Database Management',
            'Cloud Technologies',
            'Tools & DevOps',
            'Programming Languages',
            'Frontend & Mobile',
            'Frontend Development',
            'Design',
            'General',
        ]
        const categoryRank = new Map(categoryOrder.map((name, index) => [name, index]))
        const categories = Object.keys(skillsByCategory).sort((a, b) => {
            const rankA = categoryRank.has(a) ? categoryRank.get(a)! : 999
            const rankB = categoryRank.has(b) ? categoryRank.get(b)! : 999
            return rankA - rankB || a.localeCompare(b)
        })

        for (const category of categories) {
            const skills = skillsByCategory[category]
            const skillList = skills.map((skill) => skill.name).join(', ')

            sidebarY = drawText(ctx, category, MARGIN, sidebarY, {
                font: ctx.fontBold,
                size: ctx.fontSizes.small,
                maxWidth: SIDEBAR_CONTENT_WIDTH,
                color: makeColor(0.3, 0.3, 0.3),
            })
            sidebarY -= ctx.spacing.lineGap

            sidebarY = drawWrappedText(ctx, skillList, MARGIN, sidebarY, SIDEBAR_CONTENT_WIDTH, {
                size: ctx.fontSizes.small,
            })
            sidebarY -= ctx.spacing.itemGap
        }
    }

    if (cvData.languages.length > 0) {
        sidebarY -= ctx.spacing.sectionGap
        sidebarY = drawSectionHeader(ctx, 'LANGUAGES', MARGIN, sidebarY, true, SIDEBAR_WIDTH)
        sidebarY -= ctx.spacing.itemGap

        for (const lang of cvData.languages) {
            const proficiency = lang.proficiency.charAt(0).toUpperCase() + lang.proficiency.slice(1)
            sidebarY = drawText(ctx, `${lang.name} (${proficiency})`, MARGIN, sidebarY, {
                size: ctx.fontSizes.small,
                maxWidth: SIDEBAR_CONTENT_WIDTH,
            })
            sidebarY -= ctx.spacing.itemGap
        }
    }
}

function drawSidebarItem(ctx: LayoutContext, label: string, value: string | undefined, y: number): number {
    if (!value) return y

    const labelY = drawText(ctx, label.toUpperCase(), MARGIN, y, {
        font: ctx.fontBold,
        size: ctx.fontSizes.small,
        maxWidth: SIDEBAR_CONTENT_WIDTH,
        color: makeColor(0.35, 0.35, 0.35),
    })
    const valueY = drawWrappedText(ctx, value, MARGIN, labelY, SIDEBAR_CONTENT_WIDTH, {
        size: ctx.fontSizes.small,
    })
    return valueY - ctx.spacing.itemGap
}

function drawBulletItem(
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: { font?: PDFFont; size?: number; color?: { r: number; g: number; b: number } }
): number {
    const font = options.font || ctx.fontRegular
    const size = options.size || ctx.fontSizes.body
    const color = options.color || { r: 0.2, g: 0.2, b: 0.2 }

    ctx.page.drawText('•', {
        x,
        y: y - size,
        font,
        size,
        color: rgb(color.r, color.g, color.b),
    })

    return drawWrappedText(ctx, text, x + 8, y, maxWidth - 8, {
        font,
        size,
        color,
    })
}

/**
 * Draw a section header with underline
 */
function drawSectionHeader(
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    isSidebar: boolean,
    maxWidth?: number
): number {
    const color = isSidebar ? ctx.primaryColor : ctx.secondaryColor
    const label = normalizeText(text).toUpperCase()

    ctx.page.drawText(label, {
        x,
        y: y - ctx.fontSizes.sectionHeader,
        font: ctx.fontBold,
        size: ctx.fontSizes.sectionHeader,
        color: rgb(color.r, color.g, color.b),
    })

    // Draw underline
    const textWidth = ctx.fontBold.widthOfTextAtSize(label, ctx.fontSizes.sectionHeader)
    const lineWidth = isSidebar ? textWidth : maxWidth || textWidth
    ctx.page.drawLine({
        start: { x, y: y - ctx.fontSizes.sectionHeader - 3 },
        end: { x: x + lineWidth, y: y - ctx.fontSizes.sectionHeader - 3 },
        thickness: 1.2,
        color: rgb(color.r, color.g, color.b),
    })

    return y - ctx.fontSizes.sectionHeader - 8
}

/**
 * Draw text with optional wrapping
 */
function drawText(
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    options: {
        font?: PDFFont
        size?: number
        maxWidth?: number
        color?: { r: number; g: number; b: number }
    }
): number {
    if (!text) return y
    const normalized = normalizeText(text)
    if (!normalized) return y

    const font = options.font || ctx.fontRegular
    const size = options.size || ctx.fontSizes.body
    const color = options.color || { r: 0.2, g: 0.2, b: 0.2 }

    // Truncate if too long
    let displayText = normalized
    if (options.maxWidth) {
        while (font.widthOfTextAtSize(displayText, size) > options.maxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1)
        }
        if (displayText !== normalized && displayText.length > 3) {
            displayText = displayText.slice(0, -3) + '...'
        }
    }

    ctx.page.drawText(displayText, {
        x,
        y: y - size,
        font,
        size,
        color: rgb(color.r, color.g, color.b),
    })

    return y - size - ctx.spacing.lineGap
}

/**
 * Draw wrapped text that spans multiple lines
 */
function drawWrappedText(
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: {
        font?: PDFFont
        size?: number
        color?: { r: number; g: number; b: number }
        lineGap?: number
    }
): number {
    const normalized = normalizeText(text)
    if (!normalized) return y

    const font = options.font || ctx.fontRegular
    const size = options.size || ctx.fontSizes.body
    const color = options.color || { r: 0.2, g: 0.2, b: 0.2 }
    const lineGap = options.lineGap ?? ctx.spacing.lineGap

    const words = normalized.split(' ')
    const lines: string[] = []
    let currentLine = ''

    const pushWordChunks = (word: string) => {
        let segment = ''
        for (const char of word) {
            const next = segment + char
            if (font.widthOfTextAtSize(next, size) <= maxWidth) {
                segment = next
            } else {
                if (segment) lines.push(segment)
                segment = char
            }
        }
        if (segment) currentLine = segment
    }

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = font.widthOfTextAtSize(testLine, size)

        if (width <= maxWidth) {
            currentLine = testLine
            continue
        }

        if (currentLine) {
            lines.push(currentLine)
            currentLine = ''
        }

        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
            currentLine = word
        } else {
            pushWordChunks(word)
        }
    }
    if (currentLine) lines.push(currentLine)

    let currentY = y
    for (const line of lines) {
        ctx.page.drawText(line, {
            x,
            y: currentY - size,
            font,
            size,
            color: rgb(color.r, color.g, color.b),
        })
        currentY -= size + lineGap
    }

    return currentY
}

/**
 * Generate and download CV PDF
 */
export async function downloadCV(cvData: CVData, settings: CVSettings, filename: string = 'cv.pdf'): Promise<void> {
    const pdfBytes = await generateCVPDF(cvData, settings)
    // Convert Uint8Array to ArrayBuffer for Blob compatibility
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
