<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink } from 'lucide-vue-next'
import TabSwitcher from '@/components/navigation/tab-switcher.vue'
import BranchesPanel from './branches-panel.vue'
import RulesPanel from './rules-panel.vue'
import ActionsPanel from './actions-panel.vue'
import RunnersPanel from './runners-panel.vue'
import WebhooksPanel from './webhooks-panel.vue'
import EnvironmentsPanel from './environments-panel.vue'
import PagesPanel from './pages-panel.vue'
import CustomPropertiesPanel from './custom-properties-panel.vue'

const EXTERNAL_TABS: Record<string, string> = {
  codespaces: '/codespaces',
  copilot: '/copilot/code_review',
}

const INTERNAL_TABS = [
  'branches',
  'rules',
  'actions',
  'runners',
  'webhooks',
  'environments',
  'pages',
  'custom-properties',
] as const

const props = defineProps<{
  owner: string
  repo: string
  settingsSub?: string
}>()

const emit = defineEmits<{
  'update:settingsSub': [sub: string]
}>()

const { t } = useI18n()

const activeTab = ref(props.settingsSub ?? 'branches')

watch(
  () => props.settingsSub,
  (sub) => {
    if (sub && sub !== activeTab.value) {
      activeTab.value = sub
    }
  },
)

const tabs = computed(() => [
  ...INTERNAL_TABS.map((id) => ({
    id,
    label: t(`repository.settings.automation.tabs.${id}`),
  })),
  { id: 'codespaces', label: t('repository.settings.links.codespaces'), icon: ExternalLink },
  { id: 'copilot', label: t('repository.settings.links.copilot'), icon: ExternalLink },
])

function setActiveTab(id: string): void {
  const externalPath = EXTERNAL_TABS[id]
  if (externalPath) {
    const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings${externalPath}`
    void window.ohMyGithub?.links?.openExternalUrl(url)
    return
  }

  activeTab.value = id
  emit('update:settingsSub', id)
}
</script>

<template>
  <div class="grid gap-4">
    <TabSwitcher
      :active-id="activeTab"
      :navigation-label="t('repository.settings.automation.navigation')"
      :tabs="tabs"
      @update:active-id="setActiveTab"
    />

    <BranchesPanel
      v-if="activeTab === 'branches'"
      :owner="owner"
      :repo="repo"
    />
    <RulesPanel
      v-else-if="activeTab === 'rules'"
      :owner="owner"
      :repo="repo"
    />
    <ActionsPanel
      v-else-if="activeTab === 'actions'"
      :owner="owner"
      :repo="repo"
    />
    <RunnersPanel
      v-else-if="activeTab === 'runners'"
      :owner="owner"
      :repo="repo"
    />
    <WebhooksPanel
      v-else-if="activeTab === 'webhooks'"
      :owner="owner"
      :repo="repo"
    />
    <EnvironmentsPanel
      v-else-if="activeTab === 'environments'"
      :owner="owner"
      :repo="repo"
    />
    <PagesPanel
      v-else-if="activeTab === 'pages'"
      :owner="owner"
      :repo="repo"
    />
    <CustomPropertiesPanel
      v-else-if="activeTab === 'custom-properties'"
      :owner="owner"
      :repo="repo"
    />
  </div>
</template>
