/**
 * CV Store - State management for CV Builder
 */
// @ts-ignore
import { create } from 'zustand'
// @ts-ignore
import { persist } from 'zustand/middleware'
import { CVData, CVSettings, createEmptyCVData, defaultCVSettings } from '../types/cv'

interface CVStore {
    cvData: CVData
    settings: CVSettings
    isDirty: boolean

    // Actions
    updatePersonalInfo: (info: Partial<CVData['personalInfo']>) => void
    updateSummary: (summary: string) => void
    addExperience: (experience: CVData['experience'][0]) => void
    updateExperience: (id: string, experience: Partial<CVData['experience'][0]>) => void
    removeExperience: (id: string) => void
    addEducation: (education: CVData['education'][0]) => void
    updateEducation: (id: string, education: Partial<CVData['education'][0]>) => void
    removeEducation: (id: string) => void
    addSkill: (skill: CVData['skills'][0]) => void
    removeSkill: (name: string) => void
    addCertification: (certification: CVData['certifications'][0]) => void
    removeCertification: (id: string) => void
    addProject: (project: CVData['projects'][0]) => void
    updateProject: (id: string, project: Partial<CVData['projects'][0]>) => void
    removeProject: (id: string) => void
    addLanguage: (language: CVData['languages'][0]) => void
    removeLanguage: (name: string) => void
    updateSettings: (settings: Partial<CVSettings>) => void
    resetToDefault: () => void
    loadCVData: (data: CVData) => void
    markClean: () => void
}

type PersistedCVState = {
    cvData?: CVData
    settings?: CVSettings
}

export const migrateCVStoreState = (
    persistedState: PersistedCVState | undefined,
    version: number
): { cvData: CVData; settings: CVSettings } => {
    if (!persistedState || version < 2) {
        return {
            cvData: createEmptyCVData(),
            settings: defaultCVSettings,
        }
    }

    return {
        cvData: persistedState.cvData || createEmptyCVData(),
        settings: persistedState.settings || defaultCVSettings,
    }
}

export const useCVStore = create<CVStore>()(
    persist(
        (set, get) => ({
            cvData: createEmptyCVData(),
            settings: defaultCVSettings,
            isDirty: false,

            updatePersonalInfo: (info) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        personalInfo: { ...state.cvData.personalInfo, ...info },
                    },
                    isDirty: true,
                })),

            updateSummary: (summary) =>
                set((state) => ({
                    cvData: { ...state.cvData, summary },
                    isDirty: true,
                })),

            addExperience: (experience) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        experience: [...state.cvData.experience, experience],
                    },
                    isDirty: true,
                })),

            updateExperience: (id, experience) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        experience: state.cvData.experience.map((exp) =>
                            exp.id === id ? { ...exp, ...experience } : exp
                        ),
                    },
                    isDirty: true,
                })),

            removeExperience: (id) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        experience: state.cvData.experience.filter((exp) => exp.id !== id),
                    },
                    isDirty: true,
                })),

            addEducation: (education) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        education: [...state.cvData.education, education],
                    },
                    isDirty: true,
                })),

            updateEducation: (id, education) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        education: state.cvData.education.map((edu) =>
                            edu.id === id ? { ...edu, ...education } : edu
                        ),
                    },
                    isDirty: true,
                })),

            removeEducation: (id) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        education: state.cvData.education.filter((edu) => edu.id !== id),
                    },
                    isDirty: true,
                })),

            addSkill: (skill) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        skills: [...state.cvData.skills, skill],
                    },
                    isDirty: true,
                })),

            removeSkill: (name) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        skills: state.cvData.skills.filter((s) => s.name !== name),
                    },
                    isDirty: true,
                })),

            addCertification: (certification) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        certifications: [...state.cvData.certifications, certification],
                    },
                    isDirty: true,
                })),

            removeCertification: (id) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        certifications: state.cvData.certifications.filter((c) => c.id !== id),
                    },
                    isDirty: true,
                })),

            addProject: (project) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        projects: [...state.cvData.projects, project],
                    },
                    isDirty: true,
                })),

            updateProject: (id, project) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        projects: state.cvData.projects.map((p) =>
                            p.id === id ? { ...p, ...project } : p
                        ),
                    },
                    isDirty: true,
                })),

            removeProject: (id) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        projects: state.cvData.projects.filter((p) => p.id !== id),
                    },
                    isDirty: true,
                })),

            addLanguage: (language) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        languages: [...state.cvData.languages, language],
                    },
                    isDirty: true,
                })),

            removeLanguage: (name) =>
                set((state) => ({
                    cvData: {
                        ...state.cvData,
                        languages: state.cvData.languages.filter((l) => l.name !== name),
                    },
                    isDirty: true,
                })),

            updateSettings: (settings) =>
                set((state) => ({
                    settings: { ...state.settings, ...settings },
                    isDirty: true,
                })),

            resetToDefault: () =>
                set({
                    cvData: createEmptyCVData(),
                    settings: defaultCVSettings,
                    isDirty: false,
                }),

            loadCVData: (data) =>
                set({
                    cvData: data,
                    isDirty: false,
                }),

            markClean: () =>
                set({ isDirty: false }),
        }),
        {
            name: 'pdfoid-cv-storage',
            version: 2,
            migrate: (persistedState, version) => migrateCVStoreState(persistedState as PersistedCVState | undefined, version),
            partialize: (state) => ({
                cvData: state.cvData,
                settings: state.settings,
            }),
        }
    )
)

// Selector hooks for performance
export const useCVPersonalInfo = () => useCVStore((state) => state.cvData.personalInfo)
export const useCVSummary = () => useCVStore((state) => state.cvData.summary)
export const useCVExperience = () => useCVStore((state) => state.cvData.experience)
export const useCVEducation = () => useCVStore((state) => state.cvData.education)
export const useCVSkills = () => useCVStore((state) => state.cvData.skills)
export const useCVCertifications = () => useCVStore((state) => state.cvData.certifications)
export const useCVProjects = () => useCVStore((state) => state.cvData.projects)
export const useCVLanguages = () => useCVStore((state) => state.cvData.languages)
export const useCVSettings = () => useCVStore((state) => state.settings)
