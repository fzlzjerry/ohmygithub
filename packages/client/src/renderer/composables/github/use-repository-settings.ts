import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useQuery, useQueryCache } from '@pinia/colada'
import { REPOSITORY_OVERVIEW_QUERY_VERSION } from './use-repositories'

export function useRepositoryGeneralSettingsQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery<GitHubRepositoryGeneralSettings>({
    key: () => ['github', 'repository', 'settings', 'general', toValue(owner), toValue(repo)],
    enabled: () => Boolean(toValue(owner)) && Boolean(toValue(repo)) && toValue(enabled),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    query: async () => requireBridge().getGeneral(toValue(owner), toValue(repo)),
  })
}

export function useRepositoryAccessOverviewQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery<GitHubRepositoryAccessOverview>({
    key: () => ['github', 'repository', 'settings', 'access', toValue(owner), toValue(repo)],
    enabled: () => Boolean(toValue(owner)) && Boolean(toValue(repo)) && toValue(enabled),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    query: async () => requireAccessBridge().getOverview(toValue(owner), toValue(repo)),
  })
}

export function useRepositoryInteractionLimitsQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery<GitHubInteractionLimits | null>({
    key: () => ['github', 'repository', 'settings', 'interaction-limits', toValue(owner), toValue(repo)],
    enabled: () => Boolean(toValue(owner)) && Boolean(toValue(repo)) && toValue(enabled),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    query: async () => requireAccessBridge().getInteractionLimits(toValue(owner), toValue(repo)),
  })
}

function automationBridge() {
  const bridge = window.ohMyGithub?.repositorySettings?.automation
  if (!bridge) throw new Error('GitHub repository settings bridge is unavailable')
  return bridge
}

function useAutomationQuery<T>(
  segment: string,
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
  fetcher: (owner: string, repo: string) => Promise<T>,
) {
  return useQuery<T>({
    key: () => ['github', 'repository', 'settings', 'automation', segment, toValue(owner), toValue(repo)],
    enabled: () => Boolean(toValue(owner)) && Boolean(toValue(repo)) && toValue(enabled),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    query: async () => fetcher(toValue(owner), toValue(repo)),
  })
}

export function useProtectedBranchesQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('branches', owner, repo, enabled, (o, r) => automationBridge().listProtectedBranches(o, r))
}

export function useRulesetsQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('rulesets', owner, repo, enabled, (o, r) => automationBridge().listRulesets(o, r))
}

export function useActionsSettingsQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('actions', owner, repo, enabled, (o, r) => automationBridge().getActionsSettings(o, r))
}

export function useRunnersQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('runners', owner, repo, enabled, (o, r) => automationBridge().listRunners(o, r))
}

export function useWebhooksQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('webhooks', owner, repo, enabled, (o, r) => automationBridge().listWebhooks(o, r))
}

export function useEnvironmentSettingsQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('environments', owner, repo, enabled, (o, r) => automationBridge().listEnvironments(o, r))
}

export function usePagesSettingsQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('pages', owner, repo, enabled, (o, r) => automationBridge().getPages(o, r))
}

export function useCustomPropertiesQuery(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useAutomationQuery('custom-properties', owner, repo, enabled, (o, r) => automationBridge().getCustomProperties(o, r))
}

export function useRepositorySettingsInvalidation() {
  const queryCache = useQueryCache()

  return {
    invalidateGeneralSettings(owner: string, repo: string): void {
      void queryCache.invalidateQueries({
        key: ['github', 'repository', 'settings', 'general', owner, repo],
      })
    },
    invalidateAccessOverview(owner: string, repo: string): void {
      void queryCache.invalidateQueries({
        key: ['github', 'repository', 'settings', 'access', owner, repo],
      })
    },
    invalidateInteractionLimits(owner: string, repo: string): void {
      void queryCache.invalidateQueries({
        key: ['github', 'repository', 'settings', 'interaction-limits', owner, repo],
      })
    },
    invalidateAutomation(segment: string, owner: string, repo: string): void {
      void queryCache.invalidateQueries({
        key: ['github', 'repository', 'settings', 'automation', segment, owner, repo],
      })
    },
    invalidateRepositoryOverview(owner: string, repo: string): void {
      void queryCache.invalidateQueries({
        key: ['github', 'repository', 'overview', REPOSITORY_OVERVIEW_QUERY_VERSION, owner, repo],
      })
    },
  }
}

function requireBridge() {
  const bridge = window.ohMyGithub?.repositorySettings
  if (!bridge) throw new Error('GitHub repository settings bridge is unavailable')
  return bridge
}

export function updateGeneralSettings(
  owner: string,
  repo: string,
  input: UpdateRepositoryGeneralSettingsInput,
): Promise<void> {
  return requireBridge().updateGeneral(owner, repo, input)
}

export function replaceTopics(owner: string, repo: string, names: string[]): Promise<void> {
  return requireBridge().replaceTopics(owner, repo, names)
}

export function setDiscussionsEnabled(repositoryNodeId: string, enabled: boolean): Promise<void> {
  return requireBridge().setDiscussions(repositoryNodeId, enabled)
}

export function setSponsorshipsEnabled(repositoryNodeId: string, enabled: boolean): Promise<void> {
  return requireBridge().setSponsorships(repositoryNodeId, enabled)
}

export function setImmutableReleases(owner: string, repo: string, enabled: boolean): Promise<void> {
  return requireBridge().setImmutableReleases(owner, repo, enabled)
}

export function transferRepository(
  owner: string,
  repo: string,
  newOwner: string,
  newName?: string,
): Promise<void> {
  return requireBridge().transfer(owner, repo, newOwner, newName)
}

export function deleteRepository(owner: string, repo: string): Promise<void> {
  return requireBridge().deleteRepository(owner, repo)
}

function requireAccessBridge() {
  const bridge = window.ohMyGithub?.repositorySettings?.access
  if (!bridge) throw new Error('GitHub repository settings bridge is unavailable')
  return bridge
}

export function addCollaborator(
  owner: string,
  repo: string,
  username: string,
  permission: GitHubRepositoryCollaboratorRole,
): Promise<'invited' | 'added'> {
  return requireAccessBridge().addCollaborator(owner, repo, username, permission)
}

export function removeCollaborator(owner: string, repo: string, username: string): Promise<void> {
  return requireAccessBridge().removeCollaborator(owner, repo, username)
}

export function updateInvitation(
  owner: string,
  repo: string,
  invitationId: number,
  permissions: string,
): Promise<void> {
  return requireAccessBridge().updateInvitation(owner, repo, invitationId, permissions)
}

export function cancelInvitation(owner: string, repo: string, invitationId: number): Promise<void> {
  return requireAccessBridge().cancelInvitation(owner, repo, invitationId)
}

export function setTeamAccess(
  org: string,
  teamSlug: string,
  owner: string,
  repo: string,
  permission: string,
): Promise<void> {
  return requireAccessBridge().setTeam(org, teamSlug, owner, repo, permission)
}

export function removeTeamAccess(org: string, teamSlug: string, owner: string, repo: string): Promise<void> {
  return requireAccessBridge().removeTeam(org, teamSlug, owner, repo)
}

export function setRepositoryInteractionLimits(
  owner: string,
  repo: string,
  limit: GitHubInteractionLimitGroup,
  expiry?: GitHubInteractionLimitExpiry,
): Promise<void> {
  return requireAccessBridge().setInteractionLimits(owner, repo, limit, expiry)
}

export function clearRepositoryInteractionLimits(owner: string, repo: string): Promise<void> {
  return requireAccessBridge().clearInteractionLimits(owner, repo)
}

export function deleteBranchProtection(owner: string, repo: string, branch: string): Promise<void> {
  return automationBridge().deleteBranchProtection(owner, repo, branch)
}

export function setRulesetEnforcement(
  owner: string,
  repo: string,
  rulesetId: number,
  enforcement: GitHubRulesetEnforcement,
): Promise<void> {
  return automationBridge().setRulesetEnforcement(owner, repo, rulesetId, enforcement)
}

export function deleteRuleset(owner: string, repo: string, rulesetId: number): Promise<void> {
  return automationBridge().deleteRuleset(owner, repo, rulesetId)
}

export function updateActionsPermissions(
  owner: string,
  repo: string,
  enabled: boolean,
  allowedActions?: 'all' | 'local_only' | 'selected',
): Promise<void> {
  return automationBridge().updateActionsPermissions(owner, repo, enabled, allowedActions)
}

export function updateSelectedActions(
  owner: string,
  repo: string,
  githubOwnedAllowed: boolean,
  verifiedAllowed: boolean,
  patternsAllowed: string[],
): Promise<void> {
  return automationBridge().updateSelectedActions(owner, repo, githubOwnedAllowed, verifiedAllowed, patternsAllowed)
}

export function updateWorkflowPermissions(
  owner: string,
  repo: string,
  defaultWorkflowPermissions: 'read' | 'write',
  canApprovePullRequestReviews: boolean,
): Promise<void> {
  return automationBridge().updateWorkflowPermissions(owner, repo, defaultWorkflowPermissions, canApprovePullRequestReviews)
}

export function updateActionsAccessLevel(
  owner: string,
  repo: string,
  accessLevel: 'none' | 'user' | 'organization',
): Promise<void> {
  return automationBridge().updateAccessLevel(owner, repo, accessLevel)
}

export function updateActionsRetention(owner: string, repo: string, days: number): Promise<void> {
  return automationBridge().updateRetention(owner, repo, days)
}

export function deleteSelfHostedRunner(owner: string, repo: string, runnerId: number): Promise<void> {
  return automationBridge().deleteRunner(owner, repo, runnerId)
}

export function createRepositoryWebhook(
  owner: string,
  repo: string,
  input: UpsertRepositoryWebhookInput,
): Promise<void> {
  return automationBridge().createWebhook(owner, repo, input)
}

export function updateRepositoryWebhook(
  owner: string,
  repo: string,
  hookId: number,
  input: UpsertRepositoryWebhookInput,
): Promise<void> {
  return automationBridge().updateWebhook(owner, repo, hookId, input)
}

export function deleteRepositoryWebhook(owner: string, repo: string, hookId: number): Promise<void> {
  return automationBridge().deleteWebhook(owner, repo, hookId)
}

export function pingRepositoryWebhook(owner: string, repo: string, hookId: number): Promise<void> {
  return automationBridge().pingWebhook(owner, repo, hookId)
}

export function upsertRepositoryEnvironment(
  owner: string,
  repo: string,
  environmentName: string,
  input: UpsertEnvironmentInput,
): Promise<void> {
  return automationBridge().upsertEnvironment(owner, repo, environmentName, input)
}

export function deleteRepositoryEnvironment(owner: string, repo: string, environmentName: string): Promise<void> {
  return automationBridge().deleteEnvironment(owner, repo, environmentName)
}

export function createEnvironmentBranchPolicy(
  owner: string,
  repo: string,
  environmentName: string,
  name: string,
  type: 'branch' | 'tag',
): Promise<void> {
  return automationBridge().createEnvironmentBranchPolicy(owner, repo, environmentName, name, type)
}

export function deleteEnvironmentBranchPolicy(
  owner: string,
  repo: string,
  environmentName: string,
  branchPolicyId: number,
): Promise<void> {
  return automationBridge().deleteEnvironmentBranchPolicy(owner, repo, environmentName, branchPolicyId)
}

export function enableRepositoryPages(
  owner: string,
  repo: string,
  buildType: 'legacy' | 'workflow',
  sourceBranch?: string,
  sourcePath?: '/' | '/docs',
): Promise<void> {
  return automationBridge().enablePages(owner, repo, buildType, sourceBranch, sourcePath)
}

export function updateRepositoryPages(
  owner: string,
  repo: string,
  input: UpdateRepositoryPagesInput,
): Promise<void> {
  return automationBridge().updatePages(owner, repo, input)
}

export function disableRepositoryPages(owner: string, repo: string): Promise<void> {
  return automationBridge().disablePages(owner, repo)
}

export function requestRepositoryPagesBuild(owner: string, repo: string): Promise<void> {
  return automationBridge().requestPagesBuild(owner, repo)
}

export function updateRepositoryCustomProperties(
  owner: string,
  repo: string,
  values: GitHubRepositoryCustomPropertyValue[],
): Promise<void> {
  return automationBridge().updateCustomProperties(owner, repo, values)
}
