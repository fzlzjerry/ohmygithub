import type { RepositorySettingsSectionId } from '../types'

export interface RepositorySettingsLink {
  id: string
  labelKey: string
  path: string
}

export const repositorySettingsLinks: Partial<Record<RepositorySettingsSectionId, readonly RepositorySettingsLink[]>> = {
  settingsSecurity: [
    { id: 'advancedSecurity', labelKey: 'repository.settings.links.advancedSecurity', path: '/security_analysis' },
    { id: 'deployKeys', labelKey: 'repository.settings.links.deployKeys', path: '/keys' },
    { id: 'secretsActions', labelKey: 'repository.settings.links.secretsActions', path: '/secrets/actions' },
    { id: 'secretsCodespaces', labelKey: 'repository.settings.links.secretsCodespaces', path: '/secrets/codespaces' },
    { id: 'secretsDependabot', labelKey: 'repository.settings.links.secretsDependabot', path: '/secrets/dependabot' },
  ],
  settingsIntegrations: [
    { id: 'githubApps', labelKey: 'repository.settings.links.githubApps', path: '/installations' },
    { id: 'emailNotifications', labelKey: 'repository.settings.links.emailNotifications', path: '/notifications' },
    { id: 'autolinks', labelKey: 'repository.settings.links.autolinks', path: '/key_links' },
  ],
}
