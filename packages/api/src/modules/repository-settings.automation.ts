import type { GitHubOctokit } from '../transport'
import type {
  GitHubActionsSettings,
  GitHubBranchProtectionSummary,
  GitHubEnvironmentBranchPolicyItem,
  GitHubEnvironmentSettings,
  GitHubPagesSettings,
  GitHubRepositoryCustomPropertyValue,
  GitHubRepositoryRuleset,
  GitHubRepositoryWebhook,
  GitHubRulesetEnforcement,
  GitHubSelfHostedRunner,
  RepositoryOptions,
  UpsertEnvironmentInput,
  UpsertRepositoryWebhookInput,
} from '../types'

interface ProtectionResponse {
  required_pull_request_reviews?: {
    required_approving_review_count?: number | null
    require_code_owner_reviews?: boolean | null
  } | null
  required_status_checks?: { strict?: boolean | null; contexts?: string[] | null } | null
  enforce_admins?: { enabled?: boolean | null } | null
  required_linear_history?: { enabled?: boolean | null } | null
  allow_force_pushes?: { enabled?: boolean | null } | null
  allow_deletions?: { enabled?: boolean | null } | null
  required_conversation_resolution?: { enabled?: boolean | null } | null
  lock_branch?: { enabled?: boolean | null } | null
  required_signatures?: { enabled?: boolean | null } | null
}

interface RulesetResponse {
  id?: number
  name?: string | null
  target?: string | null
  enforcement?: string | null
  conditions?: { ref_name?: { include?: string[] | null; exclude?: string[] | null } | null } | null
  rules?: Array<{ type?: string | null } | null> | null
  bypass_actors?: unknown[]
}

interface WebhookResponse {
  id?: number
  config?: { url?: string | null; content_type?: string | null; insecure_ssl?: string | number | null } | null
  events?: string[] | null
  active?: boolean | null
  last_response?: { status?: string | null } | null
}

interface EnvironmentResponse {
  name?: string | null
  wait_timer?: number | null
  prevent_self_review?: boolean | null
  protection_rules?: Array<{
    type?: string | null
    wait_timer?: number | null
    prevent_self_review?: boolean | null
    reviewers?: Array<{
      type?: string | null
      reviewer?: { id?: number; login?: string | null; name?: string | null; slug?: string | null } | null
    } | null> | null
  } | null> | null
  deployment_branch_policy?: { protected_branches?: boolean | null; custom_branch_policies?: boolean | null } | null
}

interface BranchPolicyResponse {
  id?: number
  name?: string | null
  type?: string | null
}

interface PagesResponse {
  build_type?: string | null
  source?: { branch?: string | null; path?: string | null } | null
  cname?: string | null
  https_enforced?: boolean | null
  html_url?: string | null
}

export class RepositorySettingsAutomationApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async listProtectedBranches(options: RepositoryOptions): Promise<GitHubBranchProtectionSummary[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/branches', {
      owner: options.owner,
      repo: options.repo,
      protected: true,
      per_page: 100,
    })
    const branches = ((response.data ?? []) as Array<{ name?: string | null }>)
      .map((branch) => branch.name)
      .filter((name): name is string => Boolean(name))

    const summaries = await Promise.all(branches.map(async (branch) => {
      try {
        const protection = await this.octokit.request('GET /repos/{owner}/{repo}/branches/{branch}/protection', {
          owner: options.owner,
          repo: options.repo,
          branch,
        })

        return mapProtection(branch, protection.data as ProtectionResponse)
      } catch {
        return null
      }
    }))

    return summaries.filter((summary): summary is GitHubBranchProtectionSummary => summary !== null)
  }

  async deleteBranchProtection(options: RepositoryOptions & { branch: string }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/branches/{branch}/protection', {
      owner: options.owner,
      repo: options.repo,
      branch: options.branch,
    })
  }

  async listRulesets(options: RepositoryOptions): Promise<GitHubRepositoryRuleset[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/rulesets', {
      owner: options.owner,
      repo: options.repo,
      per_page: 100,
    })
    const rulesets = (response.data ?? []) as RulesetResponse[]

    const detailed = await Promise.all(rulesets.map(async (ruleset) => {
      if (!ruleset.id) return null

      try {
        const detail = await this.octokit.request('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
          owner: options.owner,
          repo: options.repo,
          ruleset_id: ruleset.id,
        })

        return mapRuleset(detail.data as RulesetResponse)
      } catch {
        return mapRuleset(ruleset)
      }
    }))

    return detailed.filter((ruleset): ruleset is GitHubRepositoryRuleset => ruleset !== null)
  }

  async setRulesetEnforcement(
    options: RepositoryOptions & { rulesetId: number; enforcement: GitHubRulesetEnforcement },
  ): Promise<void> {
    const detail = await this.octokit.request('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
      owner: options.owner,
      repo: options.repo,
      ruleset_id: options.rulesetId,
    })
    const ruleset = detail.data as RulesetResponse

    await this.octokit.request('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
      owner: options.owner,
      repo: options.repo,
      ruleset_id: options.rulesetId,
      name: ruleset.name ?? '',
      target: (ruleset.target ?? 'branch') as 'branch' | 'tag' | 'push',
      enforcement: options.enforcement,
      conditions: (ruleset.conditions ?? undefined) as never,
      rules: (ruleset.rules ?? undefined) as never,
      bypass_actors: (ruleset.bypass_actors ?? []) as never,
    })
  }

  async deleteRuleset(options: RepositoryOptions & { rulesetId: number }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
      owner: options.owner,
      repo: options.repo,
      ruleset_id: options.rulesetId,
    })
  }

  async getActionsSettings(options: RepositoryOptions): Promise<GitHubActionsSettings> {
    const repository = { owner: options.owner, repo: options.repo }
    const [permissions, workflow, access, retention] = await Promise.all([
      this.octokit.request('GET /repos/{owner}/{repo}/actions/permissions', repository)
        .then((response) => response.data as {
          enabled?: boolean
          allowed_actions?: string | null
          sha_pinning_required?: boolean | null
        })
        .catch(() => null),
      this.octokit.request('GET /repos/{owner}/{repo}/actions/permissions/workflow', repository)
        .then((response) => response.data as {
          default_workflow_permissions?: string | null
          can_approve_pull_request_reviews?: boolean | null
        })
        .catch(() => null),
      this.octokit.request('GET /repos/{owner}/{repo}/actions/permissions/access', repository)
        .then((response) => (response.data as { access_level?: string | null }).access_level ?? null)
        .catch(() => null),
      (this.octokit.request as (route: string, params: Record<string, unknown>) => Promise<{ data?: { days?: number | null } }>)(
        'GET /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention',
        repository,
      )
        .then((response) => response.data?.days ?? null)
        .catch(() => null),
    ])

    let selectedActions: GitHubActionsSettings['selectedActions'] = null
    if (permissions?.allowed_actions === 'selected') {
      selectedActions = await this.octokit
        .request('GET /repos/{owner}/{repo}/actions/permissions/selected-actions', repository)
        .then((response) => {
          const data = response.data as {
            github_owned_allowed?: boolean
            verified_allowed?: boolean
            patterns_allowed?: string[] | null
          }

          return {
            githubOwnedAllowed: Boolean(data.github_owned_allowed),
            verifiedAllowed: Boolean(data.verified_allowed),
            patternsAllowed: data.patterns_allowed ?? [],
          }
        })
        .catch(() => null)
    }

    return {
      enabled: Boolean(permissions?.enabled),
      allowedActions: normalizeAllowedActions(permissions?.allowed_actions),
      shaPinningRequired: typeof permissions?.sha_pinning_required === 'boolean'
        ? permissions.sha_pinning_required
        : null,
      defaultWorkflowPermissions: workflow?.default_workflow_permissions === 'write'
        ? 'write'
        : workflow?.default_workflow_permissions === 'read' ? 'read' : null,
      canApprovePullRequestReviews: typeof workflow?.can_approve_pull_request_reviews === 'boolean'
        ? workflow.can_approve_pull_request_reviews
        : null,
      accessLevel: access === 'none' || access === 'user' || access === 'organization' ? access : null,
      retentionDays: typeof retention === 'number' ? retention : null,
      selectedActions,
    }
  }

  async updateActionsPermissions(
    options: RepositoryOptions & { enabled: boolean; allowedActions?: 'all' | 'local_only' | 'selected' },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/actions/permissions', {
      owner: options.owner,
      repo: options.repo,
      enabled: options.enabled,
      ...(options.allowedActions ? { allowed_actions: options.allowedActions } : {}),
    })
  }

  async updateSelectedActions(
    options: RepositoryOptions & { githubOwnedAllowed: boolean; verifiedAllowed: boolean; patternsAllowed: string[] },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/actions/permissions/selected-actions', {
      owner: options.owner,
      repo: options.repo,
      github_owned_allowed: options.githubOwnedAllowed,
      verified_allowed: options.verifiedAllowed,
      patterns_allowed: options.patternsAllowed,
    })
  }

  async updateWorkflowPermissions(
    options: RepositoryOptions & { defaultWorkflowPermissions: 'read' | 'write'; canApprovePullRequestReviews: boolean },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/actions/permissions/workflow', {
      owner: options.owner,
      repo: options.repo,
      default_workflow_permissions: options.defaultWorkflowPermissions,
      can_approve_pull_request_reviews: options.canApprovePullRequestReviews,
    })
  }

  async updateAccessLevel(
    options: RepositoryOptions & { accessLevel: 'none' | 'user' | 'organization' },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/actions/permissions/access', {
      owner: options.owner,
      repo: options.repo,
      access_level: options.accessLevel,
    })
  }

  async updateRetention(options: RepositoryOptions & { days: number }): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention' as never, {
      owner: options.owner,
      repo: options.repo,
      days: options.days,
    } as never)
  }

  async listRunners(options: RepositoryOptions): Promise<GitHubSelfHostedRunner[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/actions/runners', {
      owner: options.owner,
      repo: options.repo,
      per_page: 100,
    })
    const data = response.data as {
      runners?: Array<{
        id?: number
        name?: string | null
        os?: string | null
        status?: string | null
        busy?: boolean | null
        labels?: Array<{ name?: string | null } | null> | null
      } | null> | null
    }

    return (data.runners ?? [])
      .filter((runner): runner is NonNullable<typeof runner> => runner !== null)
      .map((runner) => ({
        id: runner.id ?? 0,
        name: runner.name ?? '',
        os: runner.os ?? '',
        status: runner.status ?? 'offline',
        busy: Boolean(runner.busy),
        labels: (runner.labels ?? [])
          .map((label) => label?.name)
          .filter((name): name is string => Boolean(name)),
      }))
  }

  async deleteRunner(options: RepositoryOptions & { runnerId: number }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}', {
      owner: options.owner,
      repo: options.repo,
      runner_id: options.runnerId,
    })
  }

  async listWebhooks(options: RepositoryOptions): Promise<GitHubRepositoryWebhook[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/hooks', {
      owner: options.owner,
      repo: options.repo,
      per_page: 100,
    })

    return ((response.data ?? []) as WebhookResponse[]).map(mapWebhook)
  }

  async createWebhook(options: RepositoryOptions & { input: UpsertRepositoryWebhookInput }): Promise<void> {
    await this.octokit.request('POST /repos/{owner}/{repo}/hooks', {
      owner: options.owner,
      repo: options.repo,
      active: options.input.active,
      events: options.input.events,
      config: webhookConfig(options.input),
    })
  }

  async updateWebhook(
    options: RepositoryOptions & { hookId: number; input: UpsertRepositoryWebhookInput },
  ): Promise<void> {
    await this.octokit.request('PATCH /repos/{owner}/{repo}/hooks/{hook_id}', {
      owner: options.owner,
      repo: options.repo,
      hook_id: options.hookId,
      active: options.input.active,
      events: options.input.events,
      config: webhookConfig(options.input),
    })
  }

  async deleteWebhook(options: RepositoryOptions & { hookId: number }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/hooks/{hook_id}', {
      owner: options.owner,
      repo: options.repo,
      hook_id: options.hookId,
    })
  }

  async pingWebhook(options: RepositoryOptions & { hookId: number }): Promise<void> {
    await this.octokit.request('POST /repos/{owner}/{repo}/hooks/{hook_id}/pings', {
      owner: options.owner,
      repo: options.repo,
      hook_id: options.hookId,
    })
  }

  async listEnvironmentSettings(options: RepositoryOptions): Promise<GitHubEnvironmentSettings[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/environments', {
      owner: options.owner,
      repo: options.repo,
      per_page: 100,
    })
    const data = response.data as { environments?: Array<EnvironmentResponse | null> | null }
    const environments = (data.environments ?? [])
      .filter((environment): environment is EnvironmentResponse => environment !== null)

    return Promise.all(environments.map(async (environment) => {
      const name = environment.name ?? ''
      const branchPolicy = environment.deployment_branch_policy?.custom_branch_policies
        ? 'custom' as const
        : environment.deployment_branch_policy?.protected_branches
          ? 'protected' as const
          : 'all' as const

      let customPolicies: GitHubEnvironmentBranchPolicyItem[] = []
      if (branchPolicy === 'custom' && name) {
        customPolicies = await this.listEnvironmentBranchPolicies({ ...options, environmentName: name }).catch(() => [])
      }

      const reviewersRule = environment.protection_rules?.find((rule) => rule?.type === 'required_reviewers')
      const waitRule = environment.protection_rules?.find((rule) => rule?.type === 'wait_timer')

      return {
        name,
        waitTimer: waitRule?.wait_timer ?? environment.wait_timer ?? 0,
        preventSelfReview: Boolean(reviewersRule?.prevent_self_review ?? environment.prevent_self_review),
        reviewers: (reviewersRule?.reviewers ?? [])
          .filter((reviewer): reviewer is NonNullable<typeof reviewer> => reviewer !== null)
          .map((reviewer) => ({
            type: reviewer.type === 'Team' ? 'Team' as const : 'User' as const,
            id: reviewer.reviewer?.id ?? 0,
            name: reviewer.reviewer?.login ?? reviewer.reviewer?.slug ?? reviewer.reviewer?.name ?? '',
          })),
        branchPolicy,
        customPolicies,
      }
    }))
  }

  async upsertEnvironment(
    options: RepositoryOptions & { environmentName: string; input: UpsertEnvironmentInput },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/environments/{environment_name}', {
      owner: options.owner,
      repo: options.repo,
      environment_name: encodeEnvironmentName(options.environmentName),
      wait_timer: options.input.waitTimer,
      prevent_self_review: options.input.preventSelfReview,
      reviewers: options.input.reviewers.length > 0
        ? options.input.reviewers.map((reviewer) => ({ type: reviewer.type, id: reviewer.id }))
        : null,
      deployment_branch_policy: options.input.branchPolicy === 'all'
        ? null
        : {
            protected_branches: options.input.branchPolicy === 'protected',
            custom_branch_policies: options.input.branchPolicy === 'custom',
          },
    })
  }

  async deleteEnvironment(options: RepositoryOptions & { environmentName: string }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/environments/{environment_name}', {
      owner: options.owner,
      repo: options.repo,
      environment_name: encodeEnvironmentName(options.environmentName),
    })
  }

  async listEnvironmentBranchPolicies(
    options: RepositoryOptions & { environmentName: string },
  ): Promise<GitHubEnvironmentBranchPolicyItem[]> {
    const response = await this.octokit.request(
      'GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies',
      {
        owner: options.owner,
        repo: options.repo,
        environment_name: encodeEnvironmentName(options.environmentName),
      },
    )
    const data = response.data as { branch_policies?: Array<BranchPolicyResponse | null> | null }

    return (data.branch_policies ?? [])
      .filter((policy): policy is BranchPolicyResponse => policy !== null)
      .map((policy) => ({
        id: policy.id ?? 0,
        name: policy.name ?? '',
        type: policy.type === 'tag' ? 'tag' : 'branch',
      }))
  }

  async createEnvironmentBranchPolicy(
    options: RepositoryOptions & { environmentName: string; name: string; type: 'branch' | 'tag' },
  ): Promise<void> {
    await this.octokit.request(
      'POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies',
      {
        owner: options.owner,
        repo: options.repo,
        environment_name: encodeEnvironmentName(options.environmentName),
        name: options.name,
        type: options.type,
      },
    )
  }

  async deleteEnvironmentBranchPolicy(
    options: RepositoryOptions & { environmentName: string; branchPolicyId: number },
  ): Promise<void> {
    await this.octokit.request(
      'DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}',
      {
        owner: options.owner,
        repo: options.repo,
        environment_name: encodeEnvironmentName(options.environmentName),
        branch_policy_id: options.branchPolicyId,
      },
    )
  }

  async getPagesSettings(options: RepositoryOptions): Promise<GitHubPagesSettings> {
    const repository = { owner: options.owner, repo: options.repo }

    let pages: PagesResponse | null = null
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/pages', repository)
      pages = response.data as PagesResponse
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return {
          enabled: false,
          buildType: null,
          sourceBranch: null,
          sourcePath: null,
          cname: null,
          httpsEnforced: false,
          url: null,
          latestBuildStatus: null,
        }
      }
      throw error
    }

    const latestBuildStatus = await this.octokit
      .request('GET /repos/{owner}/{repo}/pages/builds/latest', repository)
      .then((response) => (response.data as { status?: string | null }).status ?? null)
      .catch(() => null)

    return {
      enabled: true,
      buildType: pages.build_type === 'workflow' ? 'workflow' : pages.build_type === 'legacy' ? 'legacy' : null,
      sourceBranch: pages.source?.branch ?? null,
      sourcePath: pages.source?.path ?? null,
      cname: pages.cname ?? null,
      httpsEnforced: Boolean(pages.https_enforced),
      url: pages.html_url ?? null,
      latestBuildStatus,
    }
  }

  async enablePages(
    options: RepositoryOptions & { buildType: 'legacy' | 'workflow'; sourceBranch?: string; sourcePath?: '/' | '/docs' },
  ): Promise<void> {
    await this.octokit.request('POST /repos/{owner}/{repo}/pages', {
      owner: options.owner,
      repo: options.repo,
      build_type: options.buildType,
      ...(options.buildType === 'legacy' && options.sourceBranch
        ? { source: { branch: options.sourceBranch, path: options.sourcePath ?? '/' } }
        : {}),
    })
  }

  async updatePages(
    options: RepositoryOptions & {
      cname?: string | null
      httpsEnforced?: boolean
      buildType?: 'legacy' | 'workflow'
      sourceBranch?: string
      sourcePath?: '/' | '/docs'
    },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/pages', {
      owner: options.owner,
      repo: options.repo,
      ...(options.cname !== undefined ? { cname: options.cname } : {}),
      ...(options.httpsEnforced !== undefined ? { https_enforced: options.httpsEnforced } : {}),
      ...(options.buildType ? { build_type: options.buildType } : {}),
      ...(options.sourceBranch
        ? { source: { branch: options.sourceBranch, path: options.sourcePath ?? '/' } }
        : {}),
    } as never)
  }

  async disablePages(options: RepositoryOptions): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/pages', {
      owner: options.owner,
      repo: options.repo,
    })
  }

  async requestPagesBuild(options: RepositoryOptions): Promise<void> {
    await this.octokit.request('POST /repos/{owner}/{repo}/pages/builds', {
      owner: options.owner,
      repo: options.repo,
    })
  }

  async getCustomPropertyValues(options: RepositoryOptions): Promise<GitHubRepositoryCustomPropertyValue[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/properties/values', {
      owner: options.owner,
      repo: options.repo,
    })

    return ((response.data ?? []) as Array<{ property_name?: string | null; value?: string | string[] | null }>)
      .map((item) => ({
        propertyName: item.property_name ?? '',
        value: item.value ?? null,
      }))
  }

  async updateCustomPropertyValues(
    options: RepositoryOptions & { values: GitHubRepositoryCustomPropertyValue[] },
  ): Promise<void> {
    await this.octokit.request('PATCH /repos/{owner}/{repo}/properties/values', {
      owner: options.owner,
      repo: options.repo,
      properties: options.values.map((value) => ({
        property_name: value.propertyName,
        value: value.value,
      })),
    })
  }
}

function mapProtection(branch: string, protection: ProtectionResponse): GitHubBranchProtectionSummary {
  return {
    branch,
    requiredReviews: protection.required_pull_request_reviews?.required_approving_review_count ?? null,
    requireCodeOwnerReviews: Boolean(protection.required_pull_request_reviews?.require_code_owner_reviews),
    requiredStatusChecks: protection.required_status_checks?.contexts ?? null,
    strictStatusChecks: Boolean(protection.required_status_checks?.strict),
    enforceAdmins: Boolean(protection.enforce_admins?.enabled),
    requiredLinearHistory: Boolean(protection.required_linear_history?.enabled),
    allowForcePushes: Boolean(protection.allow_force_pushes?.enabled),
    allowDeletions: Boolean(protection.allow_deletions?.enabled),
    requiredConversationResolution: Boolean(protection.required_conversation_resolution?.enabled),
    lockBranch: Boolean(protection.lock_branch?.enabled),
    requiredSignatures: Boolean(protection.required_signatures?.enabled),
  }
}

function mapRuleset(ruleset: RulesetResponse): GitHubRepositoryRuleset {
  return {
    id: ruleset.id ?? 0,
    name: ruleset.name ?? '',
    target: ruleset.target ?? 'branch',
    enforcement: ruleset.enforcement === 'evaluate' || ruleset.enforcement === 'disabled'
      ? ruleset.enforcement
      : 'active',
    rules: (ruleset.rules ?? [])
      .map((rule) => rule?.type)
      .filter((type): type is string => Boolean(type)),
    refConditions: ruleset.conditions?.ref_name?.include ?? [],
  }
}

function mapWebhook(webhook: WebhookResponse): GitHubRepositoryWebhook {
  return {
    id: webhook.id ?? 0,
    url: webhook.config?.url ?? '',
    contentType: webhook.config?.content_type ?? 'json',
    insecureSsl: webhook.config?.insecure_ssl === '1' || webhook.config?.insecure_ssl === 1,
    events: webhook.events ?? [],
    active: Boolean(webhook.active),
    lastResponseStatus: webhook.last_response?.status ?? null,
  }
}

function webhookConfig(input: UpsertRepositoryWebhookInput): Record<string, string> {
  const config: Record<string, string> = {
    url: input.url,
    content_type: input.contentType,
    insecure_ssl: input.insecureSsl ? '1' : '0',
  }
  if (input.secret?.trim()) {
    config.secret = input.secret.trim()
  }

  return config
}

function normalizeAllowedActions(value: string | null | undefined): 'all' | 'local_only' | 'selected' | null {
  return value === 'all' || value === 'local_only' || value === 'selected' ? value : null
}

function encodeEnvironmentName(name: string): string {
  return encodeURIComponent(name)
}
