/**
 * CV Data Types for PDFoid CV Builder
 * Designed for modern, professional CV layouts
 */

export interface CVPersonalInfo {
    fullName: string
    title: string
    email: string
    phone?: string
    location?: string
    linkedin?: string
    portfolio?: string
    github?: string
}

export interface CVExperience {
    id: string
    company: string
    position: string
    location?: string
    startDate: string
    endDate: string // 'Present' or date string
    description: string[]
    highlights?: string[]
}

export interface CVEducation {
    id: string
    institution: string
    degree: string
    field: string
    location?: string
    startDate?: string
    endDate: string
    gpa?: string
    highlights?: string[]
}

export interface CVCertification {
    id: string
    name: string
    issuer: string
    date: string
    credentialId?: string
    url?: string
    details?: string[]
}

export interface CVSkill {
    name: string
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    category?: string
}

export interface CVProject {
    id: string
    name: string
    description: string
    technologies?: string[]
    url?: string
    github?: string
}

export interface CVLanguage {
    name: string
    proficiency: 'basic' | 'conversational' | 'fluent' | 'native'
}

export interface CVData {
    personalInfo: CVPersonalInfo
    summary: string
    experience: CVExperience[]
    education: CVEducation[]
    skills: CVSkill[]
    certifications: CVCertification[]
    projects: CVProject[]
    languages: CVLanguage[]
    professionalDevelopment?: string[]
}

export type CVTemplate = 'modern' | 'classic' | 'minimal' | 'creative'

export interface CVSettings {
    template: CVTemplate
    primaryColor: string
    secondaryColor: string
    showPhoto: boolean
    photoUrl?: string
    fontSize: 'small' | 'medium' | 'large'
    spacing: 'compact' | 'normal' | 'relaxed'
}

/**
 * Create an empty CV object. This factory returns a fresh object to avoid
 * accidental state sharing across store resets/migrations.
 */
export const createEmptyCVData = (): CVData => ({
    personalInfo: {
        fullName: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        portfolio: '',
        github: '',
    },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    languages: [],
    professionalDevelopment: [],
})

export const defaultCVData: CVData = createEmptyCVData()

export const defaultCVSettings: CVSettings = {
    template: 'modern',
    primaryColor: '#0F766E', // Deep teal
    secondaryColor: '#D97706', // Warm amber
    showPhoto: false,
    fontSize: 'medium',
    spacing: 'normal',
}
