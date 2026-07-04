import type { Component } from 'vue'
import type { RepositoryTabId } from '@/pages/workspace/types'

export type RepositorySectionId = RepositoryTabId

export interface RepositorySection {
  id: RepositorySectionId
  icon: Component
}

export interface RepositoryOverviewInfoItem {
  id: string
  icon: Component
  label: string
  value: string
  href?: string
}

export const REPOSITORY_SETTINGS_SECTION_IDS = [
  'settingsGeneral',
  'settingsAccess',
  'settingsAutomation',
  'settingsSecurity',
  'settingsIntegrations',
] as const

export type RepositorySettingsSectionId = (typeof REPOSITORY_SETTINGS_SECTION_IDS)[number]

export const REPOSITORY_SETTINGS_PARENT_ID = 'settings'

export function isRepositorySettingsSection(id: RepositoryTabId): id is RepositorySettingsSectionId {
  return (REPOSITORY_SETTINGS_SECTION_IDS as readonly RepositoryTabId[]).includes(id)
}
