<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink } from 'lucide-vue-next'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@oh-my-github/ui'
import GithubBranchSelect from '@/components/github/github-branch-select.vue'
import {
  disableRepositoryPages,
  enableRepositoryPages,
  requestRepositoryPagesBuild,
  updateRepositoryPages,
  usePagesSettingsQuery,
  useRepositorySettingsInvalidation,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'
import SettingsToggleRow from '../general/settings-toggle-row.vue'

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateAutomation } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))
const query = usePagesSettingsQuery(() => props.owner, () => props.repo, hasIdentity)
const pages = computed(() => query.data.value ?? null)
const isLoading = computed(() => query.isLoading.value)

const enableBuildType = ref<'workflow' | 'legacy'>('workflow')
const enableBranch = ref<string | null>(null)
const enablePath = ref<'/' | '/docs'>('/')
const cnameText = ref('')
const isBusy = ref(false)

watch(pages, (value) => {
  cnameText.value = value?.cname ?? ''
}, { immediate: true })

function refresh(): void {
  invalidateAutomation('pages', props.owner, props.repo)
}

async function run(action: () => Promise<void>): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true

  try {
    await action()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.automation.error'))
  } finally {
    isBusy.value = false
    refresh()
  }
}

function enable(): void {
  void run(() => enableRepositoryPages(
    props.owner,
    props.repo,
    enableBuildType.value,
    enableBuildType.value === 'legacy' ? enableBranch.value ?? undefined : undefined,
    enableBuildType.value === 'legacy' ? enablePath.value : undefined,
  ))
}

function toggleHttps(value: boolean): void {
  void run(() => updateRepositoryPages(props.owner, props.repo, { httpsEnforced: value }))
}

function saveCname(): void {
  void run(() => updateRepositoryPages(props.owner, props.repo, {
    cname: cnameText.value.trim() || null,
  }))
}

function requestBuild(): void {
  void run(async () => {
    await requestRepositoryPagesBuild(props.owner, props.repo)
    toast.success(t('repository.settings.automation.pages.buildRequested'))
  })
}

function disable(): void {
  void run(() => disableRepositoryPages(props.owner, props.repo))
}

function openSite(): void {
  if (pages.value?.url) {
    void window.ohMyGithub?.links?.openExternalUrl(pages.value.url)
  }
}

function openVisibility(): void {
  const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings/pages`
  void window.ohMyGithub?.links?.openExternalUrl(url)
}
</script>

<template>
  <div
    v-if="isLoading || !pages"
    class="flex min-h-[8rem] items-center justify-center"
  >
    <Spinner class="size-4 text-muted-foreground" />
  </div>

  <div
    v-else-if="!pages.enabled"
    class="grid max-w-xl gap-3"
  >
    <p class="text-body text-muted-foreground">
      {{ t('repository.settings.automation.pages.disabledHint') }}
    </p>
    <div class="grid gap-1.5">
      <Label>{{ t('repository.settings.automation.pages.buildType') }}</Label>
      <Select v-model="enableBuildType">
        <SelectTrigger class="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="workflow">{{ t('repository.settings.automation.pages.workflow') }}</SelectItem>
          <SelectItem value="legacy">{{ t('repository.settings.automation.pages.legacy') }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div
      v-if="enableBuildType === 'legacy'"
      class="flex items-center gap-2"
    >
      <GithubBranchSelect
        v-model="enableBranch"
        :owner="owner"
        :repo="repo"
        trigger-class="w-52"
      />
      <Select v-model="enablePath">
        <SelectTrigger class="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="/">/</SelectItem>
          <SelectItem value="/docs">/docs</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <Button
        :disabled="isBusy || (enableBuildType === 'legacy' && !enableBranch)"
        size="sm"
        type="button"
        @click="enable"
      >
        <Spinner
          v-if="isBusy"
          class="size-3.5"
        />
        {{ t('repository.settings.automation.pages.enable') }}
      </Button>
    </div>
  </div>

  <div
    v-else
    class="grid max-w-xl gap-4"
  >
    <div class="grid gap-1">
      <button
        v-if="pages.url"
        class="inline-flex items-center gap-1 text-body font-medium text-foreground underline-offset-4 outline-hidden hover:underline"
        type="button"
        @click="openSite"
      >
        {{ pages.url }}
        <ExternalLink
          class="size-3.5"
          :stroke-width="1.75"
        />
      </button>
      <span class="text-caption text-muted-foreground">
        {{ t('repository.settings.automation.pages.summary', {
          buildType: pages.buildType ?? '—',
          source: pages.sourceBranch ? `${pages.sourceBranch}${pages.sourcePath ?? ''}` : '—',
          build: pages.latestBuildStatus ?? '—',
        }) }}
      </span>
    </div>

    <SettingsToggleRow
      :disabled="isBusy"
      :model-value="pages.httpsEnforced"
      :title="t('repository.settings.automation.pages.httpsEnforced')"
      @update:model-value="toggleHttps"
    />

    <div class="grid gap-1.5">
      <Label for="pages-cname">{{ t('repository.settings.automation.pages.cname') }}</Label>
      <div class="flex items-center gap-2">
        <Input
          id="pages-cname"
          v-model="cnameText"
          autocomplete="off"
          class="flex-1"
          placeholder="docs.example.com"
          spellcheck="false"
        />
        <Button
          :disabled="isBusy || cnameText.trim() === (pages.cname ?? '')"
          size="sm"
          type="button"
          @click="saveCname"
        >
          {{ t('repository.settings.automation.save') }}
        </Button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Button
        :disabled="isBusy"
        size="sm"
        type="button"
        variant="outline"
        @click="requestBuild"
      >
        {{ t('repository.settings.automation.pages.requestBuild') }}
      </Button>
      <Button
        :disabled="isBusy"
        size="sm"
        type="button"
        variant="destructive"
        @click="disable"
      >
        {{ t('repository.settings.automation.pages.disable') }}
      </Button>
    </div>

    <button
      class="inline-flex items-center gap-1 justify-self-start text-caption text-muted-foreground underline-offset-4 outline-hidden hover:underline"
      type="button"
      @click="openVisibility"
    >
      {{ t('repository.settings.automation.pages.visibility') }}
      <ExternalLink
        class="size-3"
        :stroke-width="1.75"
      />
    </button>
  </div>
</template>
