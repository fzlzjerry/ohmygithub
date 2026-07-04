<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink } from 'lucide-vue-next'
import type { RepositorySettingsSectionId } from '../types'
import { repositorySettingsLinks } from './settings-links'
import GeneralSection from './general/general-section.vue'
import AccessSection from './access/access-section.vue'
import AutomationSection from './automation/automation-section.vue'
import SecuritySection from './security/security-section.vue'

const props = defineProps<{
  category: RepositorySettingsSectionId
  owner: string
  repo: string
  settingsSub?: string
}>()

const emit = defineEmits<{
  renamed: [newName: string]
  deleted: []
  'update:settingsSub': [sub: string]
}>()

const { t } = useI18n()

const links = computed(() => repositorySettingsLinks[props.category] ?? [])

function openLink(path: string): void {
  const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings${path}`
  void window.ohMyGithub?.links?.openExternalUrl(url)
}
</script>

<template>
  <GeneralSection
    v-if="category === 'settingsGeneral'"
    :owner="owner"
    :repo="repo"
    @deleted="emit('deleted')"
    @renamed="emit('renamed', $event)"
  />

  <AccessSection
    v-else-if="category === 'settingsAccess'"
    :owner="owner"
    :repo="repo"
    :settings-sub="settingsSub"
    @update:settings-sub="emit('update:settingsSub', $event)"
  />

  <AutomationSection
    v-else-if="category === 'settingsAutomation'"
    :owner="owner"
    :repo="repo"
    :settings-sub="settingsSub"
    @update:settings-sub="emit('update:settingsSub', $event)"
  />

  <SecuritySection
    v-else-if="category === 'settingsSecurity'"
    :owner="owner"
    :repo="repo"
    :settings-sub="settingsSub"
    @update:settings-sub="emit('update:settingsSub', $event)"
  />

  <section
    v-else
    class="grid gap-3"
  >
    <p class="text-body text-muted-foreground">
      {{ t('repository.settings.externalHint') }}
    </p>

    <div class="overflow-hidden rounded-xl border border-border bg-card">
      <button
        v-for="(link, index) in links"
        :key="link.id"
        :class="[
          'flex h-11 w-full items-center justify-between px-4 text-left text-body text-foreground outline-hidden transition-colors hover:bg-muted/70 focus-visible:bg-muted/70',
          index > 0 ? 'border-t border-border' : '',
        ]"
        type="button"
        @click="openLink(link.path)"
      >
        <span class="min-w-0 truncate">{{ t(link.labelKey) }}</span>
        <ExternalLink
          class="size-3.5 shrink-0 text-muted-foreground"
          :stroke-width="1.75"
        />
      </button>
    </div>
  </section>
</template>
