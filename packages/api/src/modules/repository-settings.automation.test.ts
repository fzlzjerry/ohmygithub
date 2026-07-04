import { describe, expect, it, vi } from 'vitest'
import type { GitHubOctokit } from '../transport'
import { RepositorySettingsAutomationApi } from './repository-settings.automation'

describe('RepositorySettingsAutomationApi', () => {
  it('summarizes protected branches and skips branches whose protection fails to load', async () => {
    const { api } = createApi()

    const summaries = await api.listProtectedBranches({ owner: 'o', repo: 'r' })

    expect(summaries).toEqual([
      {
        branch: 'main',
        requiredReviews: 2,
        requireCodeOwnerReviews: true,
        requiredStatusChecks: ['ci'],
        strictStatusChecks: true,
        enforceAdmins: true,
        requiredLinearHistory: false,
        allowForcePushes: false,
        allowDeletions: false,
        requiredConversationResolution: true,
        lockBranch: false,
        requiredSignatures: true,
      },
    ])
  })

  it('changes ruleset enforcement by re-submitting the fetched ruleset', async () => {
    const { api, request } = createApi()

    await api.setRulesetEnforcement({ owner: 'o', repo: 'r', rulesetId: 3, enforcement: 'disabled' })

    expect(request).toHaveBeenCalledWith('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
      owner: 'o',
      repo: 'r',
      ruleset_id: 3,
      name: 'main-rules',
      target: 'branch',
      enforcement: 'disabled',
      conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
      rules: [{ type: 'deletion' }],
      bypass_actors: [],
    })
  })

  it('collects actions settings tolerating unavailable sub-endpoints', async () => {
    const { api } = createApi({ actionsAccessError: true })

    const settings = await api.getActionsSettings({ owner: 'o', repo: 'r' })

    expect(settings).toMatchObject({
      enabled: true,
      allowedActions: 'selected',
      shaPinningRequired: false,
      defaultWorkflowPermissions: 'read',
      canApprovePullRequestReviews: true,
      accessLevel: null,
      retentionDays: 90,
      selectedActions: {
        githubOwnedAllowed: true,
        verifiedAllowed: false,
        patternsAllowed: ['octo-org/*'],
      },
    })
  })

  it('omits the webhook secret when left blank on update', async () => {
    const { api, request } = createApi()

    await api.updateWebhook({
      owner: 'o',
      repo: 'r',
      hookId: 5,
      input: { url: 'https://example.dev/hook', contentType: 'json', insecureSsl: false, events: ['push'], active: true },
    })

    const call = request.mock.calls.find(([route]) => route === 'PATCH /repos/{owner}/{repo}/hooks/{hook_id}')
    expect(call?.[1]).toEqual({
      owner: 'o',
      repo: 'r',
      hook_id: 5,
      active: true,
      events: ['push'],
      config: { url: 'https://example.dev/hook', content_type: 'json', insecure_ssl: '0' },
    })
  })

  it('reports pages as disabled on 404 and encodes environment names', async () => {
    const { api, request } = createApi({ pagesMissing: true })

    const pages = await api.getPagesSettings({ owner: 'o', repo: 'r' })
    expect(pages.enabled).toBe(false)

    await api.deleteEnvironmentBranchPolicy({ owner: 'o', repo: 'r', environmentName: 'prod/eu', branchPolicyId: 9 })
    expect(request).toHaveBeenCalledWith(
      'DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}',
      {
        owner: 'o',
        repo: 'r',
        environment_name: 'prod%2Feu',
        branch_policy_id: 9,
      },
    )
  })

  it('updates custom property values through the values PATCH endpoint', async () => {
    const { api, request } = createApi()

    await api.updateCustomPropertyValues({
      owner: 'o',
      repo: 'r',
      values: [{ propertyName: 'team', value: 'core' }],
    })

    expect(request).toHaveBeenCalledWith('PATCH /repos/{owner}/{repo}/properties/values', {
      owner: 'o',
      repo: 'r',
      properties: [{ property_name: 'team', value: 'core' }],
    })
  })
})

function createApi(overrides: { actionsAccessError?: boolean; pagesMissing?: boolean } = {}) {
  const request = vi.fn(async (route: string, params?: Record<string, unknown>) => {
    if (route === 'GET /repos/{owner}/{repo}/branches') {
      return { data: [{ name: 'main' }, { name: 'broken' }] }
    }
    if (route === 'GET /repos/{owner}/{repo}/branches/{branch}/protection') {
      if (params?.branch === 'broken') throw new Error('unavailable')
      return {
        data: {
          required_pull_request_reviews: {
            required_approving_review_count: 2,
            require_code_owner_reviews: true,
          },
          required_status_checks: { strict: true, contexts: ['ci'] },
          enforce_admins: { enabled: true },
          required_linear_history: { enabled: false },
          allow_force_pushes: { enabled: false },
          allow_deletions: { enabled: false },
          required_conversation_resolution: { enabled: true },
          lock_branch: { enabled: false },
          required_signatures: { enabled: true },
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/rulesets/{ruleset_id}') {
      return {
        data: {
          id: 3,
          name: 'main-rules',
          target: 'branch',
          enforcement: 'active',
          conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
          rules: [{ type: 'deletion' }],
          bypass_actors: [],
        },
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/permissions') {
      return { data: { enabled: true, allowed_actions: 'selected', sha_pinning_required: false } }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/permissions/selected-actions') {
      return { data: { github_owned_allowed: true, verified_allowed: false, patterns_allowed: ['octo-org/*'] } }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/permissions/workflow') {
      return { data: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: true } }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/permissions/access') {
      if (overrides.actionsAccessError) throw new Error('public repository')
      return { data: { access_level: 'organization' } }
    }
    if (route === 'GET /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention') {
      return { data: { days: 90 } }
    }
    if (route === 'GET /repos/{owner}/{repo}/pages') {
      if (overrides.pagesMissing) {
        const error = new Error('Not Found') as Error & { status?: number }
        error.status = 404
        throw error
      }
      return {
        data: {
          build_type: 'workflow',
          source: { branch: 'main', path: '/' },
          cname: null,
          https_enforced: true,
          html_url: 'https://o.github.io/r/',
        },
      }
    }
    return { data: {}, status: 204 }
  })
  const octokit = { request } as unknown as GitHubOctokit

  return { api: new RepositorySettingsAutomationApi(octokit), request }
}
