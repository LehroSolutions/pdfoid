import { describe, expect, it } from 'vitest'
import { useCVStore, migrateCVStoreState } from '../store/cvStore'
import { createEmptyCVData, defaultCVSettings } from '../types/cv'

describe('cvStore migration', () => {
  it('resets persisted CV data for versions below 2', () => {
    const migrated = migrateCVStoreState(
      {
        cvData: {
          ...createEmptyCVData(),
          personalInfo: {
            ...createEmptyCVData().personalInfo,
            fullName: 'Legacy User',
          },
        },
        settings: { ...defaultCVSettings, template: 'classic' },
      },
      1
    )

    expect(migrated.cvData.personalInfo.fullName).toBe('')
    expect(migrated.settings).toEqual(defaultCVSettings)
  })

  it('keeps persisted state for version 2 and above', () => {
    const migrated = migrateCVStoreState(
      {
        cvData: {
          ...createEmptyCVData(),
          personalInfo: {
            ...createEmptyCVData().personalInfo,
            fullName: 'Current User',
            email: 'current@example.com',
          },
        },
        settings: { ...defaultCVSettings, template: 'minimal' },
      },
      2
    )

    expect(migrated.cvData.personalInfo.fullName).toBe('Current User')
    expect(migrated.cvData.personalInfo.email).toBe('current@example.com')
    expect(migrated.settings.template).toBe('minimal')
  })

  it('resetToDefault returns fresh empty data', () => {
    useCVStore.setState({
      cvData: {
        ...createEmptyCVData(),
        personalInfo: {
          ...createEmptyCVData().personalInfo,
          fullName: 'Should Reset',
          email: 'reset@example.com',
        },
      },
      settings: { ...defaultCVSettings, template: 'creative' },
      isDirty: true,
    })

    useCVStore.getState().resetToDefault()
    const state = useCVStore.getState()

    expect(state.cvData.personalInfo.fullName).toBe('')
    expect(state.cvData.personalInfo.email).toBe('')
    expect(state.settings.template).toBe(defaultCVSettings.template)
    expect(state.isDirty).toBe(false)
  })
})

