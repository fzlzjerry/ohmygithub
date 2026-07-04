import type { RepositorySettingsSectionId } from '../types'

export interface RepositorySettingsLink {
  id: string
  labelKey: string
  path: string
}

export const repositorySettingsLinks: Partial<Record<RepositorySettingsSectionId, readonly RepositorySettingsLink[]>> = {
  settingsIntegrations: [
    { id: 'githubApps', labelKey: 'repository.settings.links.githubApps', path: '/installations' },
    { id: 'emailNotifications', labelKey: 'repository.settings.links.emailNotifications', path: '/notifications' },
    { id: 'autolinks', labelKey: 'repository.settings.links.autolinks', path: '/key_links' },
  ],
}
