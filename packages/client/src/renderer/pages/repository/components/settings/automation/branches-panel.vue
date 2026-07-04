<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, ExternalLink, Trash2 } from 'lucide-vue-next'
import { Button, Spinner } from '@oh-my-github/ui'
import {
  deleteBranchProtection,
  useProtectedBranchesQuery,
  useRepositorySettingsInvalidation,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateAutomation } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))
const query = useProtectedBranchesQuery(() => props.owner, () => props.repo, hasIdentity)
const branches = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const expanded = ref(new Set<string>())
const pending = ref(new Set<string>())

function toggle(branch: string): void {
  const next = new Set(expanded.value)
  if (next.has(branch)) next.delete(branch)
  else next.add(branch)
  expanded.value = next
}

async function removeProtection(branch: string): Promise<void> {
  if (pending.value.has(branch)) return
  pending.value = new Set([...pending.value, branch])

  try {
    await deleteBranchProtection(props.owner, props.repo, branch)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.automation.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(branch)
    pending.value = next
    invalidateAutomation('branches', props.owner, props.repo)
  }
}

function detailItems(summary: GitHubBranchProtectionSummary): Array<{ id: string; label: string; value: string }> {
  const yes = t('repository.settings.automation.branches.yes')
  const no = t('repository.settings.automation.branches.no')
  const bool = (value: boolean) => (value ? yes : no)

  return [
    {
      id: 'reviews',
      label: t('repository.settings.automation.branches.requiredReviews'),
      value: summary.requiredReviews === null ? no : String(summary.requiredReviews),
    },
    { id: 'codeowners', label: t('repository.settings.automation.branches.codeOwners'), value: bool(summary.requireCodeOwnerReviews) },
    {
      id: 'checks',
      label: t('repository.settings.automation.branches.statusChecks'),
      value: summary.requiredStatusChecks?.length
        ? summary.requiredStatusChecks.join(', ') + (summary.strictStatusChecks ? ` (${t('repository.settings.automation.branches.strict')})` : '')
        : no,
    },
    { id: 'admins', label: t('repository.settings.automation.branches.enforceAdmins'), value: bool(summary.enforceAdmins) },
    { id: 'linear', label: t('repository.settings.automation.branches.linearHistory'), value: bool(summary.requiredLinearHistory) },
    { id: 'force', label: t('repository.settings.automation.branches.forcePushes'), value: bool(summary.allowForcePushes) },
    { id: 'deletions', label: t('repository.settings.automation.branches.deletions'), value: bool(summary.allowDeletions) },
    { id: 'conversation', label: t('repository.settings.automation.branches.conversation'), value: bool(summary.requiredConversationResolution) },
    { id: 'lock', label: t('repository.settings.automation.branches.lock'), value: bool(summary.lockBranch) },
    { id: 'signatures', label: t('repository.settings.automation.branches.signatures'), value: bool(summary.requiredSignatures) },
  ]
}

function openExternal(): void {
  const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings/branches`
  void window.ohMyGithub?.links?.openExternalUrl(url)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <p class="text-caption text-muted-foreground">
        {{ t('repository.settings.automation.branches.hint') }}
      </p>
      <Button
        size="sm"
        type="button"
        variant="outline"
        @click="openExternal"
      >
        {{ t('repository.settings.automation.editOnGitHub') }}
        <ExternalLink
          class="size-3.5"
          :stroke-width="1.75"
        />
      </Button>
    </div>

    <div
      v-if="isLoading"
      class="flex min-h-[8rem] items-center justify-center"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <div
      v-else-if="branches.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(summary, index) in branches"
        :key="summary.branch"
        :class="index > 0 ? 'border-t border-border' : ''"
      >
        <div class="flex items-center justify-between gap-4 px-4 py-2.5">
          <button
            class="flex min-w-0 flex-1 items-center gap-2 text-left outline-hidden"
            type="button"
            @click="toggle(summary.branch)"
          >
            <ChevronRight
              class="size-3.5 text-muted-foreground transition-transform"
              :class="expanded.has(summary.branch) ? 'rotate-90' : ''"
              :stroke-width="1.75"
            />
            <span class="truncate text-body font-medium text-foreground">{{ summary.branch }}</span>
          </button>
          <Button
            :aria-label="t('repository.settings.automation.branches.remove')"
            :disabled="pending.has(summary.branch)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="removeProtection(summary.branch)"
          >
            <Trash2
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </Button>
        </div>
        <dl
          v-if="expanded.has(summary.branch)"
          class="grid gap-1 border-t border-border/60 px-10 py-3"
        >
          <div
            v-for="item in detailItems(summary)"
            :key="item.id"
            class="flex items-baseline justify-between gap-4"
          >
            <dt class="text-caption text-muted-foreground">{{ item.label }}</dt>
            <dd class="text-caption text-foreground">{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <p
      v-else
      class="text-body text-muted-foreground"
    >
      {{ t('repository.settings.automation.branches.empty') }}
    </p>
  </div>
</template>
