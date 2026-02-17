/**
 * CV PDF Generator - Professional CV Layout Engine
 * Creates polished, professional CVs with distinct visual identities per template
 */

// @ts-ignore
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { CVData, CVSettings, CVTemplate } from '../types/cv'

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const HEADER_MARGIN = 45

// Color utilities
type Color = { r: number; g: number; b: number }

const makeColor = (r: number, g: number, b: number): Color => ({ r, g, b })

const hexToRgb = (hex: string): Color => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return makeColor(0.06, 0.09, 0.09) // Default dark teal
    return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
    }
}

const blend = (a: Color, b: Color, ratio: number): Color =>
    makeColor(
        a.r * (1 - ratio) + b.r * ratio,
        a.g * (1 - ratio) + b.g * ratio,
        a.b * (1 - ratio) + b.b * ratio
    )

// Text normalization
const normalizeText = (text: string): string =>
    text
        .replace(/\s+/g, ' ')
        .replace(/[–—−]/g, '-')
        .replace(/â€™|â€™/g, "'")
        .replace(/â€œ|â€/g, '"')
        .trim()

// ============================================================================
// TEMPLATE CONFIGURATIONS
// ============================================================================

interface FontConfig {
    name: number
    title: number
    sectionHeader: number
    body: number
    small: number
    tiny: number
}

interface SpacingConfig {
    sectionGap: number
    itemGap: number
    lineGap: number
    indent: number
}

interface TemplateStyle {
    // Layout
    sidebarWidth: number
    sidebarEnabled: boolean
    sidebarPosition: 'left' | 'right'
    contentColumns: 1 | 2

    // Typography
    fontFamily: 'sans' | 'serif'
    headerAlignment: 'left' | 'center'
    nameTransform: 'normal' | 'uppercase' | 'title'
    nameWeight: 'bold' | 'normal'
    letterSpacing: number

    // Visual Elements
    showHeaderDivider: boolean
    headerDividerStyle: 'line' | 'bar' | 'none'
    showSectionDividers: boolean
    showBulletPoints: boolean
    bulletStyle: 'disc' | 'arrow' | 'none'
    boxSections: string[]

    // Colors
    pageBackground: Color
    sidebarBackground: Color
    accentColor: Color
    textPrimary: Color
    textSecondary: Color
    textMuted: Color

    // Spacing
    baseFontSize: FontConfig
    spacing: SpacingConfig
}

const getTemplateStyle = (
    template: CVTemplate,
    primaryColor: Color,
    secondaryColor: Color
): TemplateStyle => {
    const white = makeColor(1, 1, 1)
    const nearBlack = makeColor(0.08, 0.08, 0.1)
    const darkGray = makeColor(0.25, 0.25, 0.28)
    const lightGray = makeColor(0.6, 0.6, 0.65)

    switch (template) {
        case 'classic':
            return {
                sidebarWidth: 0,
                sidebarEnabled: false,
                sidebarPosition: 'left',
                contentColumns: 1,
                fontFamily: 'serif',
                headerAlignment: 'center',
                nameTransform: 'title',
                nameWeight: 'bold',
                letterSpacing: 0.5,
                showHeaderDivider: true,
                headerDividerStyle: 'bar',
                showSectionDividers: true,
                showBulletPoints: true,
                bulletStyle: 'disc',
                boxSections: [],
                pageBackground: makeColor(0.99, 0.98, 0.96),
                sidebarBackground: white,
                accentColor: secondaryColor,
                textPrimary: nearBlack,
                textSecondary: darkGray,
                textMuted: lightGray,
                baseFontSize: { name: 26, title: 14, sectionHeader: 13, body: 10, small: 9, tiny: 8 },
                spacing: { sectionGap: 22, itemGap: 14, lineGap: 4, indent: 15 },
            }

        case 'minimal':
            return {
                sidebarWidth: 0,
                sidebarEnabled: false,
                sidebarPosition: 'left',
                contentColumns: 1,
                fontFamily: 'sans',
                headerAlignment: 'left',
                nameTransform: 'normal',
                nameWeight: 'bold',
                letterSpacing: 0,
                showHeaderDivider: false,
                headerDividerStyle: 'none',
                showSectionDividers: false,
                showBulletPoints: true,
                bulletStyle: 'disc',
                boxSections: [],
                pageBackground: white,
                sidebarBackground: white,
                accentColor: primaryColor,
                textPrimary: makeColor(0.1, 0.1, 0.12),
                textSecondary: makeColor(0.35, 0.35, 0.4),
                textMuted: makeColor(0.55, 0.55, 0.6),
                baseFontSize: { name: 28, title: 13, sectionHeader: 11, body: 10, small: 9, tiny: 8 },
                spacing: { sectionGap: 24, itemGap: 12, lineGap: 5, indent: 18 },
            }

        case 'creative':
            return {
                sidebarWidth: 175,
                sidebarEnabled: true,
                sidebarPosition: 'right',
                contentColumns: 1,
                fontFamily: 'sans',
                headerAlignment: 'left',
                nameTransform: 'uppercase',
                nameWeight: 'bold',
                letterSpacing: 2,
                showHeaderDivider: true,
                headerDividerStyle: 'line',
                showSectionDividers: false,
                showBulletPoints: true,
                bulletStyle: 'arrow',
                boxSections: ['summary'],
                pageBackground: blend(secondaryColor, white, 0.92),
                sidebarBackground: blend(primaryColor, makeColor(0.1, 0.1, 0.15), 0.12),
                accentColor: primaryColor,
                textPrimary: makeColor(0.12, 0.12, 0.15),
                textSecondary: makeColor(0.3, 0.3, 0.35),
                textMuted: makeColor(0.5, 0.5, 0.55),
                baseFontSize: { name: 24, title: 12, sectionHeader: 11, body: 10, small: 9, tiny: 8 },
                spacing: { sectionGap: 20, itemGap: 10, lineGap: 3, indent: 12 },
            }

        case 'modern':
        default:
            return {
                sidebarWidth: 160,
                sidebarEnabled: true,
                sidebarPosition: 'left',
                contentColumns: 2,
                fontFamily: 'sans',
                headerAlignment: 'left',
                nameTransform: 'normal',
                nameWeight: 'bold',
                letterSpacing: 0.3,
                showHeaderDivider: true,
                headerDividerStyle: 'line',
                showSectionDividers: false,
                showBulletPoints: true,
                bulletStyle: 'disc',
                boxSections: [],
                pageBackground: white,
                sidebarBackground: makeColor(0.97, 0.97, 0.98),
                accentColor: primaryColor,
                textPrimary: nearBlack,
                textSecondary: darkGray,
                textMuted: lightGray,
                baseFontSize: { name: 26, title: 12, sectionHeader: 10, body: 9, small: 8, tiny: 7 },
                spacing: { sectionGap: 18, itemGap: 8, lineGap: 3, indent: 14 },
            }
    }
}

// ============================================================================
// LAYOUT CONTEXT
// ============================================================================

interface LayoutContext {
    pdfDoc: PDFDocument
    page: PDFPage
    y: number
    fontRegular: PDFFont
    fontBold: PDFFont
    fontItalic: PDFFont
    style: TemplateStyle
    contentX: number
    contentWidth: number
    sidebarX: number
    sidebarWidth: number
    primaryColor: Color
    secondaryColor: Color
}

const buildContext = (
    pdfDoc: PDFDocument,
    page: PDFPage,
    y: number,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    fontItalic: PDFFont,
    primaryColor: Color,
    secondaryColor: Color,
    style: TemplateStyle
): LayoutContext => {
    let contentX = MARGIN
    let contentWidth = PAGE_WIDTH - MARGIN * 2
    let sidebarX = 0
    let sidebarWidth = 0

    if (style.sidebarEnabled) {
        if (style.sidebarPosition === 'left') {
            sidebarX = 0
            sidebarWidth = style.sidebarWidth
            contentX = MARGIN + sidebarWidth
            contentWidth = PAGE_WIDTH - MARGIN - contentX
        } else {
            sidebarX = PAGE_WIDTH - style.sidebarWidth
            sidebarWidth = style.sidebarWidth
            contentWidth = sidebarX - MARGIN
        }
    }

    return {
        pdfDoc,
        page,
        y,
        fontRegular,
        fontBold,
        fontItalic,
        style,
        contentX,
        contentWidth,
        sidebarX,
        sidebarWidth,
        primaryColor,
        secondaryColor,
    }
}

// ============================================================================
// DRAWING UTILITIES
// ============================================================================

// Helper to check if text is valid (not empty or placeholder)
const isValidText = (text: string | undefined): boolean => {
    if (!text) return false
    const trimmed = text.trim().toLowerCase()
    // Filter out placeholders and garbage
    if (trimmed === '') return false
    if (trimmed.includes('project details available')) return false
    if (trimmed.includes('details available in source')) return false
    if (trimmed.length < 2) return false
    return true
}

// Helper to check if an experience entry has valid content
const hasValidExperience = (exp: CVData['experience'][0]): boolean => {
    return isValidText(exp.position) || isValidText(exp.company)
}

// Helper to check if an education entry has valid content
const hasValidEducation = (edu: CVData['education'][0]): boolean => {
    return isValidText(edu.degree) || isValidText(edu.institution)
}

// Helper to check if a project entry has valid content
const hasValidProject = (proj: CVData['projects'][0]): boolean => {
    return isValidText(proj.name) || isValidText(proj.description)
}

// Helper to check if a skill has valid content
const hasValidSkill = (skill: CVData['skills'][0]): boolean => {
    return isValidText(skill.name)
}

const drawText = (
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    options: {
        font?: PDFFont
        size?: number
        color?: Color
        maxWidth?: number
    } = {}
): number => {
    if (!text) return y

    const normalized = normalizeText(text)
    if (!normalized) return y

    const font = options.font || ctx.fontRegular
    const size = options.size || ctx.style.baseFontSize.body
    const color = options.color || ctx.style.textPrimary

    let displayText = normalized
    if (options.maxWidth) {
        while (font.widthOfTextAtSize(displayText, size) > options.maxWidth && displayText.length > 3) {
            displayText = displayText.slice(0, -1)
        }
        if (displayText.length < normalized.length - 3) {
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

    return y - size - ctx.style.spacing.lineGap
}

const drawWrappedText = (
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: {
        font?: PDFFont
        size?: number
        color?: Color
    } = {}
): number => {
    const normalized = normalizeText(text)
    if (!normalized) return y

    const font = options.font || ctx.fontRegular
    const size = options.size || ctx.style.baseFontSize.body
    const color = options.color || ctx.style.textPrimary

    const words = normalized.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
            current = candidate
        } else {
            if (current) lines.push(current)
            current = word
        }
    }
    if (current) lines.push(current)

    let cursorY = y
    for (const line of lines) {
        ctx.page.drawText(line, {
            x,
            y: cursorY - size,
            font,
            size,
            color: rgb(color.r, color.g, color.b),
        })
        cursorY -= size + ctx.style.spacing.lineGap
    }

    return cursorY
}

const drawBulletPoint = (
    ctx: LayoutContext,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: {
        size?: number
        color?: Color
    } = {}
): number => {
    if (!ctx.style.showBulletPoints) {
        return drawWrappedText(ctx, text, x, y, maxWidth, options)
    }

    const size = options.size || ctx.style.baseFontSize.small
    const color = options.color || ctx.style.textPrimary
    const indent = ctx.style.spacing.indent

    // Draw bullet
    let bullet = '•'
    if (ctx.style.bulletStyle === 'arrow') bullet = '▸'

    ctx.page.drawText(bullet, {
        x,
        y: y - size,
        font: ctx.fontRegular,
        size,
        color: rgb(color.r, color.g, color.b),
    })

    return drawWrappedText(ctx, text, x + indent, y, maxWidth - indent, {
        size,
        color,
    })
}

const drawDivider = (
    ctx: LayoutContext,
    x: number,
    y: number,
    width: number,
    options: {
        thickness?: number
        color?: Color
        yOffset?: number
    } = {}
): number => {
    const thickness = options.thickness || 0.5
    const color = options.color || ctx.style.textMuted
    const yOffset = options.yOffset || 0

    ctx.page.drawLine({
        start: { x, y: y + yOffset },
        end: { x: x + width, y: y + yOffset },
        thickness,
        color: rgb(color.r, color.g, color.b),
    })

    return y - 8
}

const ensureSpace = (
    ctx: LayoutContext,
    pdfDoc: PDFDocument,
    requiredSpace: number,
    cvData: CVData,
    style: TemplateStyle,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    fontItalic: PDFFont,
    primaryColor: Color,
    secondaryColor: Color
): number => {
    if (ctx.y >= MARGIN + requiredSpace) return ctx.y

    const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Draw page background
    newPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(style.pageBackground.r, style.pageBackground.g, style.pageBackground.b),
    })

    return buildContext(
        pdfDoc,
        newPage,
        PAGE_HEIGHT - MARGIN,
        fontRegular,
        fontBold,
        fontItalic,
        primaryColor,
        secondaryColor,
        style
    ).y
}

// ============================================================================
// SECTION RENDERING
// ============================================================================

const drawSectionHeader = (
    ctx: LayoutContext,
    title: string,
    x: number,
    y: number,
    maxWidth: number,
    isSidebar: boolean = false
): number => {
    const { style } = ctx
    const fontSize = isSidebar ? style.baseFontSize.small : style.baseFontSize.sectionHeader
    const color = isSidebar ? style.accentColor : style.textPrimary

    // Transform case
    let displayTitle = title
    if (style.nameTransform === 'uppercase') {
        displayTitle = title.toUpperCase()
    } else if (style.nameTransform === 'title') {
        displayTitle = title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    }

    // Draw header text
    ctx.page.drawText(displayTitle, {
        x,
        y: y - fontSize,
        font: ctx.fontBold,
        size: fontSize,
        color: rgb(color.r, color.g, color.b),
    })

    let cursorY = y - fontSize

    // Draw divider based on style
    if (style.showHeaderDivider && !isSidebar) {
        if (style.headerDividerStyle === 'line') {
            const divY = cursorY - 6
            ctx.page.drawLine({
                start: { x, y: divY },
                end: { x: x + maxWidth, y: divY },
                thickness: 0.8,
                color: rgb(color.r, color.g, color.b),
            })
        } else if (style.headerDividerStyle === 'bar') {
            const divY = cursorY - 8
            ctx.page.drawRectangle({
                x,
                y: divY - 2,
                width: 40,
                height: 3,
                color: rgb(color.r, color.g, color.b),
            })
            ctx.page.drawLine({
                start: { x: x + 45, y: divY },
                end: { x: x + maxWidth, y: divY },
                thickness: 0.5,
                color: rgb(style.textMuted.r, style.textMuted.g, style.textMuted.b),
            })
        }
    }

    return cursorY - (style.showHeaderDivider ? 14 : 10)
}

const drawExperienceEntry = (
    ctx: LayoutContext,
    experience: CVData['experience'][0],
    x: number,
    y: number,
    maxWidth: number,
    isSidebar: boolean = false
): number => {
    const { style, fontBold, fontItalic } = ctx
    const size = style.baseFontSize
    const spacing = style.spacing

    let cursorY = y

    // Position title - bold
    cursorY = drawText(ctx, experience.position, x, cursorY, {
        font: fontBold,
        size: size.body,
    })

    // Company and location on same line
    const companyLine = experience.company + (experience.location ? ` | ${experience.location}` : '')
    cursorY = drawText(ctx, companyLine, x, cursorY, {
        font: fontItalic,
        size: size.small,
        color: style.textSecondary,
    })

    // Date range
    const dateRange = experience.startDate && experience.endDate
        ? `${experience.startDate} – ${experience.endDate}`
        : experience.startDate || experience.endDate || ''

    if (dateRange) {
        cursorY = drawText(ctx, dateRange, x, cursorY, {
            font: fontItalic,
            size: size.small,
            color: style.textMuted,
        })
    }

    // Bullet points
    const allPoints = [...(experience.description || []), ...(experience.highlights || [])]
    for (const point of allPoints) {
        cursorY = drawBulletPoint(ctx, point, x, cursorY, maxWidth, {
            size: size.small,
        })
    }

    return cursorY - spacing.itemGap
}

const drawEducationEntry = (
    ctx: LayoutContext,
    education: CVData['education'][0],
    x: number,
    y: number,
    maxWidth: number,
    isSidebar: boolean = false
): number => {
    const { style, fontBold, fontItalic } = ctx
    const size = style.baseFontSize
    const spacing = style.spacing

    let cursorY = y

    // Degree
    const degreeLine = education.degree + (education.field ? ` in ${education.field}` : '')
    cursorY = drawText(ctx, degreeLine, x, cursorY, {
        font: fontBold,
        size: size.body,
    })

    // Institution and location
    const instLine = education.institution + (education.location ? ` | ${education.location}` : '')
    cursorY = drawText(ctx, instLine, x, cursorY, {
        font: fontItalic,
        size: size.small,
        color: style.textSecondary,
    })

    // Date
    const dateLine = education.startDate && education.endDate
        ? `${education.startDate} – ${education.endDate}`
        : education.startDate || education.endDate || ''

    if (dateLine) {
        cursorY = drawText(ctx, dateLine, x, cursorY, {
            font: fontItalic,
            size: size.small,
            color: style.textMuted,
        })
    }

    // GPA
    if (education.gpa) {
        cursorY = drawText(ctx, `GPA: ${education.gpa}`, x, cursorY, {
            size: size.small,
            color: style.textSecondary,
        })
    }

    // Highlights
    for (const highlight of education.highlights || []) {
        cursorY = drawBulletPoint(ctx, highlight, x, cursorY, maxWidth, {
            size: size.small,
        })
    }

    return cursorY - spacing.itemGap
}

const drawProjectEntry = (
    ctx: LayoutContext,
    project: CVData['projects'][0],
    x: number,
    y: number,
    maxWidth: number,
    isSidebar: boolean = false
): number => {
    const { style, fontBold } = ctx
    const size = style.baseFontSize
    const spacing = style.spacing

    let cursorY = y

    // Project name
    cursorY = drawText(ctx, project.name, x, cursorY, {
        font: fontBold,
        size: size.body,
        color: style.accentColor,
    })

    // Description
    cursorY = drawWrappedText(ctx, project.description, x, cursorY, maxWidth, {
        size: size.small,
    })

    // Technologies
    if (project.technologies?.length) {
        cursorY = drawText(ctx, `Technologies: ${project.technologies.join(', ')}`, x, cursorY, {
            font: ctx.fontItalic,
            size: size.tiny,
            color: style.textSecondary,
        })
    }

    // URL
    if (project.url) {
        cursorY = drawText(ctx, project.url, x, cursorY, {
            size: size.tiny,
            color: style.textMuted,
        })
    }

    return cursorY - spacing.itemGap
}

const drawSkills = (
    ctx: LayoutContext,
    skills: CVData['skills'],
    x: number,
    y: number,
    maxWidth: number,
    isSidebar: boolean = false
): number => {
    const { style, fontBold } = ctx
    const size = style.baseFontSize

    let cursorY = y

    // Group by category
    const grouped = skills.reduce((acc, skill) => {
        const key = skill.category || 'Skills'
        if (!acc[key]) acc[key] = []
        acc[key].push(skill.name)
        return acc
    }, {} as Record<string, string[]>)

    for (const [category, names] of Object.entries(grouped)) {
        // Category header
        cursorY = drawText(ctx, category, x, cursorY, {
            font: fontBold,
            size: isSidebar ? size.tiny : size.small,
            color: style.textSecondary,
        })

        // Skills
        const skillsLine = names.join(' • ')
        cursorY = drawWrappedText(ctx, skillsLine, x, cursorY, maxWidth, {
            size: isSidebar ? size.tiny : size.small,
            color: style.textPrimary,
        })

        cursorY -= ctx.style.spacing.itemGap / 2
    }

    return cursorY
}

// ============================================================================
// MAIN HEADER RENDERING
// ============================================================================

const drawMainHeader = (
    ctx: LayoutContext,
    cvData: CVData,
    isFirstPage: boolean
): number => {
    const { style, fontBold, fontItalic, contentX, contentWidth } = ctx
    const size = style.baseFontSize
    const spacing = style.spacing

    let cursorY = PAGE_HEIGHT - HEADER_MARGIN

    // Name
    let displayName = cvData.personalInfo.fullName
    if (style.nameTransform === 'uppercase') {
        displayName = displayName.toUpperCase()
    } else if (style.nameTransform === 'title') {
        displayName = displayName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    }

    const nameSize = isFirstPage ? size.name : size.title + 2
    let nameX = contentX

    if (style.headerAlignment === 'center') {
        const nameWidth = fontBold.widthOfTextAtSize(displayName, nameSize)
        nameX = contentX + (contentWidth - nameWidth) / 2
    }

    ctx.page.drawText(displayName, {
        x: nameX,
        y: cursorY - nameSize,
        font: fontBold,
        size: nameSize,
        color: rgb(style.textPrimary.r, style.textPrimary.g, style.textPrimary.b),
    })
    cursorY -= nameSize + spacing.lineGap

    // Title
    if (cvData.personalInfo.title) {
        let titleX = contentX
        if (style.headerAlignment === 'center') {
            const titleWidth = fontItalic.widthOfTextAtSize(cvData.personalInfo.title, size.title)
            titleX = contentX + (contentWidth - titleWidth) / 2
        }

        ctx.page.drawText(cvData.personalInfo.title, {
            x: titleX,
            y: cursorY - size.title,
            font: fontItalic,
            size: size.title,
            color: rgb(style.textSecondary.r, style.textSecondary.g, style.textSecondary.b),
        })
        cursorY -= size.title + spacing.lineGap * 2
    }

    // Header divider
    if (style.showHeaderDivider) {
        let dividerX = contentX
        let dividerWidth = contentWidth

        if (style.headerDividerStyle === 'bar') {
            ctx.page.drawRectangle({
                x: contentX,
                y: cursorY - 12,
                width: 50,
                height: 2.5,
                color: rgb(style.accentColor.r, style.accentColor.g, style.accentColor.b),
            })
            dividerX = contentX + 55
            dividerWidth -= 55
        }

        ctx.page.drawLine({
            start: { x: dividerX, y: cursorY - 8 },
            end: { x: dividerX + dividerWidth, y: cursorY - 8 },
            thickness: 0.6,
            color: rgb(style.textMuted.r, style.textMuted.g, style.textMuted.b),
        })

        cursorY -= spacing.sectionGap
    } else {
        cursorY -= spacing.itemGap
    }

    return cursorY
}

// ============================================================================
// SIDEBAR RENDERING
// ============================================================================

const drawSidebar = (
    ctx: LayoutContext,
    cvData: CVData
): void => {
    const { style, sidebarX, sidebarWidth, fontBold, fontItalic } = ctx
    if (!style.sidebarEnabled) return

    const size = style.baseFontSize
    const spacing = style.spacing

    // Draw sidebar background
    ctx.page.drawRectangle({
        x: sidebarX,
        y: 0,
        width: sidebarWidth,
        height: PAGE_HEIGHT,
        color: rgb(style.sidebarBackground.r, style.sidebarBackground.g, style.sidebarBackground.b),
    })

    // Sidebar content starts lower for better balance
    let cursorY = PAGE_HEIGHT - 60

    // Contact section
    cursorY = drawSectionHeader(ctx, 'CONTACT', sidebarX + 15, cursorY, sidebarWidth - 30, true)
    cursorY -= spacing.itemGap / 2

    const contactFields = [
        { label: 'Email', value: cvData.personalInfo.email },
        { label: 'Phone', value: cvData.personalInfo.phone },
        { label: 'Location', value: cvData.personalInfo.location },
        { label: 'LinkedIn', value: cvData.personalInfo.linkedin },
        { label: 'Portfolio', value: cvData.personalInfo.portfolio },
        { label: 'GitHub', value: cvData.personalInfo.github },
    ]

    for (const field of contactFields) {
        if (field.value) {
            cursorY = drawText(ctx, field.label.toUpperCase(), sidebarX + 15, cursorY, {
                font: fontBold,
                size: size.tiny,
                color: style.textMuted,
            })
            cursorY = drawWrappedText(ctx, field.value, sidebarX + 15, cursorY, sidebarWidth - 30, {
                size: size.tiny,
            })
            cursorY -= spacing.itemGap / 2
        }
    }

    // Skills (in sidebar)
    const validSkills = cvData.skills.filter(hasValidSkill)
    if (validSkills.length > 0) {
        cursorY -= spacing.sectionGap
        cursorY = drawSectionHeader(ctx, 'SKILLS', sidebarX + 15, cursorY, sidebarWidth - 30, true)
        cursorY -= spacing.itemGap / 2
        cursorY = drawSkills(ctx, validSkills, sidebarX + 15, cursorY, sidebarWidth - 30, true)
    }

    // Languages
    if (cvData.languages.length > 0) {
        cursorY -= spacing.sectionGap
        cursorY = drawSectionHeader(ctx, 'LANGUAGES', sidebarX + 15, cursorY, sidebarWidth - 30, true)
        cursorY -= spacing.itemGap / 2

        for (const lang of cvData.languages) {
            const proficiency = lang.proficiency.charAt(0).toUpperCase() + lang.proficiency.slice(1)
            cursorY = drawText(ctx, `${lang.name} (${proficiency})`, sidebarX + 15, cursorY, {
                size: size.tiny,
            })
            cursorY -= spacing.itemGap / 2
        }
    }
}

// ============================================================================
// HEADER INFO (For top of each page when sidebar enabled)
// ============================================================================

const drawHeaderInfo = (
    ctx: LayoutContext,
    cvData: CVData
): number => {
    const { style, fontBold, fontItalic } = ctx
    if (!style.sidebarEnabled) return ctx.y

    const size = style.baseFontSize
    const spacing = style.spacing

    // Draw a subtle background bar at top
    ctx.page.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 35,
        width: PAGE_WIDTH,
        height: 35,
        color: rgb(style.sidebarBackground.r, style.sidebarBackground.g, style.sidebarBackground.b),
    })

    let cursorY = PAGE_HEIGHT - 18

    // Contact info in a row
    const contactItems: string[] = []
    if (cvData.personalInfo.email) contactItems.push(cvData.personalInfo.email)
    if (cvData.personalInfo.phone) contactItems.push(cvData.personalInfo.phone)
    if (cvData.personalInfo.location) contactItems.push(cvData.personalInfo.location)
    if (cvData.personalInfo.linkedin) contactItems.push(cvData.personalInfo.linkedin)

    if (contactItems.length > 0) {
        const contactLine = contactItems.join(' | ')
        cursorY = drawText(ctx, contactLine, MARGIN, cursorY, {
            size: size.tiny,
            color: style.textMuted,
        })
    }

    // Skills as a row
    const validSkills = cvData.skills.filter(hasValidSkill)
    if (validSkills.length > 0) {
        // Group skills
        const skillCategories = validSkills.reduce((acc, skill) => {
            const cat = skill.category || 'Skills'
            if (!acc[cat]) acc[cat] = []
            acc[cat].push(skill.name)
            return acc
        }, {} as Record<string, string[]>)

        const skillLines: string[] = []
        for (const [cat, names] of Object.entries(skillCategories)) {
            skillLines.push(`${cat}: ${names.slice(0, 5).join(', ')}${names.length > 5 ? '...' : ''}`)
        }

        for (const line of skillLines.slice(0, 2)) {
            cursorY = drawText(ctx, line, MARGIN, cursorY, {
                size: size.tiny,
                color: style.textSecondary,
            })
        }
    }

    // Languages
    if (cvData.languages.length > 0) {
        const langLine = cvData.languages
            .map(l => `${l.name} (${l.proficiency.charAt(0).toUpperCase() + l.proficiency.slice(1)})`)
            .join(', ')
        cursorY = drawText(ctx, langLine, MARGIN, cursorY, {
            size: size.tiny,
            color: style.textMuted,
        })
    }

    // Draw separator line
    ctx.page.drawLine({
        start: { x: MARGIN, y: cursorY - 5 },
        end: { x: PAGE_WIDTH - MARGIN, y: cursorY - 5 },
        thickness: 0.5,
        color: rgb(style.textMuted.r, style.textMuted.g, style.textMuted.b),
    })

    return cursorY - 10
}

export async function generateCVPDF(cvData: CVData, settings: CVSettings): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()

    // Convert colors
    const primaryColor = hexToRgb(settings.primaryColor)
    const secondaryColor = hexToRgb(settings.secondaryColor)

    // Get template style
    const style = getTemplateStyle(settings.template, primaryColor, secondaryColor)

    // Load fonts
    const fontRegular = style.fontFamily === 'serif'
        ? await pdfDoc.embedFont(StandardFonts.TimesRoman)
        : await pdfDoc.embedFont(StandardFonts.Helvetica)

    const fontBold = style.fontFamily === 'serif'
        ? await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
        : await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const fontItalic = style.fontFamily === 'serif'
        ? await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
        : await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Create first page
    const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Draw page background
    firstPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(style.pageBackground.r, style.pageBackground.g, style.pageBackground.b),
    })

    // Build layout context
    let ctx = buildContext(
        pdfDoc,
        firstPage,
        PAGE_HEIGHT - MARGIN,
        fontRegular,
        fontBold,
        fontItalic,
        primaryColor,
        secondaryColor,
        style
    )

    // Draw sidebar (only on first page - subsequent pages handle it in ensureNewPage)
    drawSidebar(ctx, cvData)

    // Draw main header
    let contentY = drawMainHeader(ctx, cvData, true)

    // Helper for page management
    const ensureNewPage = (minSpace: number) => {
        if (contentY >= MARGIN + minSpace) return

        const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        newPage.drawRectangle({
            x: 0,
            y: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            color: rgb(style.pageBackground.r, style.pageBackground.g, style.pageBackground.b),
        })

        ctx = buildContext(
            pdfDoc,
            newPage,
            PAGE_HEIGHT - MARGIN,
            fontRegular,
            fontBold,
            fontItalic,
            primaryColor,
            secondaryColor,
            style
        )

        // Redraw sidebar on new page if sidebar enabled
        if (style.sidebarEnabled) {
            drawSidebar(ctx, cvData)
        }

        // Only draw name header on subsequent pages
        contentY = drawMainHeader(ctx, cvData, false)
    }

    const mainX = ctx.contentX
    const mainWidth = ctx.contentWidth

    // Summary section
    if (cvData.summary) {
        ensureNewPage(80)
        contentY = drawSectionHeader(ctx, 'PROFESSIONAL SUMMARY', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        // Check if we need to box the summary
        if (style.boxSections.includes('summary')) {
            const summaryHeight = 70
            ctx.page.drawRectangle({
                x: mainX - 8,
                y: contentY - summaryHeight - 10,
                width: mainWidth + 16,
                height: summaryHeight + 20,
                color: rgb(blend(style.accentColor, makeColor(1, 1, 1), 0.92).r, blend(style.accentColor, makeColor(1, 1, 1), 0.92).g, blend(style.accentColor, makeColor(1, 1, 1), 0.92).b),
            })
        }

        contentY = drawWrappedText(ctx, cvData.summary, mainX, contentY, mainWidth, {
            size: style.baseFontSize.body,
        })
        contentY -= ctx.style.spacing.sectionGap
    }

    // Experience section
    const validExperiences = cvData.experience.filter(hasValidExperience)
    if (validExperiences.length > 0) {
        ensureNewPage(100)
        contentY = drawSectionHeader(ctx, 'PROFESSIONAL EXPERIENCE', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        for (const exp of validExperiences) {
            ensureNewPage(90)
            contentY = drawExperienceEntry(ctx, exp, mainX, contentY, mainWidth)
        }
    }

    // Education section
    const validEducation = cvData.education.filter(hasValidEducation)
    if (validEducation.length > 0) {
        ensureNewPage(80)
        contentY = drawSectionHeader(ctx, 'EDUCATION', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        for (const edu of validEducation) {
            ensureNewPage(70)
            contentY = drawEducationEntry(ctx, edu, mainX, contentY, mainWidth)
        }
    }

    // Projects section
    const validProjects = cvData.projects.filter(hasValidProject)
    if (validProjects.length > 0) {
        ensureNewPage(80)
        contentY = drawSectionHeader(ctx, 'PROJECTS', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        for (const project of validProjects) {
            ensureNewPage(60)
            contentY = drawProjectEntry(ctx, project, mainX, contentY, mainWidth)
        }
    }

    // Certifications section
    if (cvData.certifications.length > 0) {
        ensureNewPage(60)
        contentY = drawSectionHeader(ctx, 'CERTIFICATIONS', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        for (const cert of cvData.certifications) {
            ensureNewPage(80)
            const certLine = cert.name + (cert.issuer ? ` - ${cert.issuer}` : '')
            contentY = drawText(ctx, certLine, mainX, contentY, {
                font: fontBold,
                size: style.baseFontSize.body,
            })

            if (cert.date) {
                contentY = drawText(ctx, cert.date, mainX, contentY, {
                    font: fontItalic,
                    size: style.baseFontSize.small,
                    color: style.textMuted,
                })
            }

            // Render certification details as bullet points
            if (cert.details && cert.details.length > 0) {
                for (const detail of cert.details) {
                    ensureNewPage(30)
                    contentY = drawBulletPoint(ctx, detail, mainX, contentY, mainWidth, {
                        size: style.baseFontSize.small,
                    })
                }
            }

            contentY -= ctx.style.spacing.itemGap
        }
    }

    // Skills (if no sidebar)
    const mainContentSkills = cvData.skills.filter(hasValidSkill)
    if (!style.sidebarEnabled && mainContentSkills.length > 0) {
        ensureNewPage(60)
        contentY = drawSectionHeader(ctx, 'SKILLS', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2
        contentY = drawSkills(ctx, mainContentSkills, mainX, contentY, mainWidth)
    }

    // Languages (if no sidebar)
    if (!style.sidebarEnabled && cvData.languages.length > 0) {
        ensureNewPage(40)
        contentY = drawSectionHeader(ctx, 'LANGUAGES', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        const langLine = cvData.languages
            .map(l => `${l.name} (${l.proficiency.charAt(0).toUpperCase() + l.proficiency.slice(1)})`)
            .join(' • ')

        contentY = drawWrappedText(ctx, langLine, mainX, contentY, mainWidth, {
            size: style.baseFontSize.small,
            color: style.textSecondary,
        })
    }

    // Professional Development
    if (cvData.professionalDevelopment?.length) {
        ensureNewPage(50)
        contentY = drawSectionHeader(ctx, 'PROFESSIONAL DEVELOPMENT', mainX, contentY, mainWidth)
        contentY -= ctx.style.spacing.itemGap / 2

        for (const item of cvData.professionalDevelopment) {
            ensureNewPage(30)
            contentY = drawBulletPoint(ctx, item, mainX, contentY, mainWidth, {
                size: style.baseFontSize.small,
            })
        }
    }

    return pdfDoc.save()
}

// ============================================================================
// DOWNLOAD FUNCTION
// ============================================================================

export async function downloadCV(
    cvData: CVData,
    settings: CVSettings,
    filename: string = 'cv.pdf'
): Promise<void> {
    const pdfBytes = await generateCVPDF(cvData, settings)
    const arrayBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer
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
