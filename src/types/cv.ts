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
 * Default CV data for Lehlohonolo Wessie
 * Extracted from the original CV PDF
 */
export const defaultCVData: CVData = {
    personalInfo: {
        fullName: 'Lehlohonolo Wessie',
        title: 'Backend Developer | Founder, Dolphin Bou Audio | Co-Founder, Lehro Solutions',
        email: 'sadjiim.673dc@gmail.com',
        phone: '082 508 2517',
        location: 'City of Johannesburg, Gauteng, South Africa',
        linkedin: 'linkedin.com/in/lehlohonolo-wessie-0a04b124a',
        portfolio: 'lehlohonolow.github.io/cvwebsite/',
    },
    summary: 'Backend developer focused on JavaScript/Node.js, SAP CAP, and service-oriented architecture with a DevOps mindset. Builds full-stack web and mobile applications using React Native, including an ecommerce platform and an AI-enabled HR/payroll system. Co-founder of Lehro Solutions and Dolphin Bou Audio, and creator of open-source tools (PDFoid, Gidevo API Tool, MCPSOIDS).',
    experience: [
        {
            id: 'exp-1',
            company: 'Lehro Solutions',
            position: 'Co-Founder',
            location: 'Gauteng, South Africa',
            startDate: 'February 2025',
            endDate: 'Present',
            description: [
                'Co-founded a technology solutions company focused on innovative software delivery',
                'Leading backend development and architecture for client applications',
                'Collaborating on product strategy and scalable implementation across industries',
            ],
        },
        {
            id: 'exp-2',
            company: 'Self Employed',
            position: 'Backend Developer',
            location: 'South Africa',
            startDate: 'September 2024',
            endDate: 'Present',
            description: [
                'Built full-stack web applications for personal and client projects',
                'Delivered an ecommerce platform and supported client brand styling with a small team',
                'Developed an AI-enabled HR and payroll system as part of a co-founded AI suite',
                'Designed and managed PostgreSQL databases',
            ],
        },
        {
            id: 'exp-3',
            company: 'Self Employed',
            position: 'Freelance Graphic Designer',
            location: 'South Africa',
            startDate: 'June 2018',
            endDate: 'Present',
            description: [
                'Created cover art, logos, custom art pieces, and clothing mockups for diverse clients',
                'Managed project timelines and deliverables to ensure high-quality outcomes',
                'Expanded into UI/UX design and 3D animation for digital products',
            ],
        },
    ],
    education: [
        {
            id: 'edu-1',
            institution: 'University of Pretoria (Universiteit van Pretoria)',
            degree: 'Bachelor of Arts',
            field: 'Philosophy',
            startDate: 'January 2018',
            endDate: 'December 2020',
        },
    ],
    skills: [
        // Backend Development
        { name: 'Node.js', level: 'advanced', category: 'Backend Development' },
        { name: 'REST APIs', level: 'advanced', category: 'Backend Development' },
        { name: 'Microservices', level: 'intermediate', category: 'Backend Development' },
        { name: 'Service-Oriented Architecture (SOA)', level: 'intermediate', category: 'Backend Development' },
        { name: 'Express.js', level: 'advanced', category: 'Backend Development' },
        { name: 'SAP CAP', level: 'intermediate', category: 'Backend Development' },

        // Database
        { name: 'PostgreSQL', level: 'advanced', category: 'Database Management' },
        { name: 'MongoDB', level: 'intermediate', category: 'Database Management' },
        { name: 'SQL', level: 'advanced', category: 'Database Management' },
        { name: 'NoSQL', level: 'intermediate', category: 'Database Management' },

        // Frontend & Mobile
        { name: 'React', level: 'intermediate', category: 'Frontend & Mobile' },
        { name: 'React Native', level: 'intermediate', category: 'Frontend & Mobile' },
        { name: 'Vue.js', level: 'intermediate', category: 'Frontend & Mobile' },
        { name: 'TypeScript', level: 'intermediate', category: 'Frontend & Mobile' },

        // Languages
        { name: 'JavaScript', level: 'advanced', category: 'Programming Languages' },
        { name: 'Java', level: 'intermediate', category: 'Programming Languages' },
        { name: 'Python', level: 'intermediate', category: 'Programming Languages' },
        { name: 'C#', level: 'intermediate', category: 'Programming Languages' },
        { name: 'C++', level: 'beginner', category: 'Programming Languages' },
        { name: '.NET', level: 'intermediate', category: 'Programming Languages' },

        // Tools & DevOps
        { name: 'Git', level: 'advanced', category: 'Tools & DevOps' },
        { name: 'GitHub', level: 'advanced', category: 'Tools & DevOps' },
        { name: 'Docker', level: 'intermediate', category: 'Tools & DevOps' },
        { name: 'Jenkins', level: 'beginner', category: 'Tools & DevOps' },
        { name: 'Postman', level: 'advanced', category: 'Tools & DevOps' },

        // Cloud
        { name: 'SAP Cloud Platform', level: 'intermediate', category: 'Cloud Technologies' },

        // Design
        { name: 'Graphic Design', level: 'advanced', category: 'Design' },
        { name: 'UI/UX Design', level: 'intermediate', category: 'Design' },
        { name: '3D Animation', level: 'beginner', category: 'Design' },
    ],
    certifications: [
        {
            id: 'cert-1',
            name: 'SAP Certified Associate - Backend Developer (SAP CAP)',
            issuer: 'SAP',
            date: 'September 2024',
            details: [
                'Mastered SAP Cloud Application Programming Model (CAP) concepts for scalable cloud solutions',
                'Gained backend development expertise in SAP environments with JavaScript/Node.js and SOA',
            ],
        },
    ],
    projects: [
        {
            id: 'proj-1',
            name: 'PDFoid',
            description: 'Open-source PDF editor and viewer built to streamline document workflows',
            technologies: ['React', 'TypeScript', 'PDF.js', 'pdf-lib'],
        },
        {
            id: 'proj-2',
            name: 'Gidevo API Tool',
            description: 'Open-source API toolkit to help developers and enterprises scale integrations',
            technologies: ['Node.js', 'REST API'],
        },
        {
            id: 'proj-3',
            name: 'MCPSOIDS',
            description: 'AI-driven tools for small businesses and enterprises to improve efficiency',
            technologies: ['AI', 'Node.js', 'Cloud'],
        },
    ],
    languages: [
        { name: 'English', proficiency: 'fluent' },
    ],
    professionalDevelopment: [
        'Continuous learning of backend development tools and frameworks through online platforms',
        'Participated in workshops on cloud computing, backend development, and AI (agents and LLMs)',
    ],
}

export const defaultCVSettings: CVSettings = {
    template: 'modern',
    primaryColor: '#0F766E', // Deep teal
    secondaryColor: '#D97706', // Warm amber
    showPhoto: false,
    fontSize: 'medium',
    spacing: 'normal',
}
