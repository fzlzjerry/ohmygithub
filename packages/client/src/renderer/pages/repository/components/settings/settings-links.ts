import type { RepositorySettingsSectionId } from '../types'

export interface RepositorySettingsLink {
  id: string
  labelKey: string
  path: string
}

export const repositorySettingsLinks: Record<RepositorySettingsSectionId, readonly RepositorySettingsLink[]> = {
  settingsGeneral: [
    { id: 'general', labelKey: 'repository.settings.links.general', path: '' },
  ],
  settingsAccess: [
    { id: 'collaborators', labelKey: 'repository.settings.links.collaborators', path: '/access' },
    { id: 'interactionLimits', labelKey: 'repository.settings.links.interactionLimits', path: '/interaction_limits' },
    { id: 'reviewLimits', labelKey: 'repository.settings.links.reviewLimits', path: '/review_limits' },
    { id: 'reportedContent', labelKey: 'repository.settings.links.reportedContent', path: '/reported_content' },
  ],
  settingsAutomation: [
    { id: 'branches', labelKey: 'repository.settings.links.branches', path: '/branches' },
    { id: 'rules', labelKey: 'repository.settings.links.rules', path: '/rules' },
    { id: 'actions', labelKey: 'repository.settings.links.actions', path: '/actions' },
    { id: 'runners', labelKey: 'repository.settings.links.runners', path: '/actions/runners' },
    { id: 'webhooks', labelKey: 'repository.settings.links.webhooks', path: '/hooks' },
    { id: 'environments', labelKey: 'repository.settings.links.environments', path: '/environments' },
    { id: 'codespaces', labelKey: 'repository.settings.links.codespaces', path: '/codespaces' },
    { id: 'copilot', labelKey: 'repository.settings.links.copilot', path: '/copilot/code_review' },
    { id: 'pages', labelKey: 'repository.settings.links.pages', path: '/pages' },
    { id: 'customProperties', labelKey: 'repository.settings.links.customProperties', path: '/custom-properties' },
  ],
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
