<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TabSwitcher from '@/components/navigation/tab-switcher.vue'
import AdvancedSecurityPanel from './advanced-security-panel.vue'
import DeployKeysPanel from './deploy-keys-panel.vue'
import SecretsPanel from './secrets-panel.vue'

const props = defineProps<{
  owner: string
  repo: string
  settingsSub?: string
}>()

const emit = defineEmits<{
  'update:settingsSub': [sub: string]
}>()

const { t } = useI18n()

const activeTab = ref(props.settingsSub ?? 'advanced-security')

watch(
  () => props.settingsSub,
  (sub) => {
    if (sub && sub !== activeTab.value) {
      activeTab.value = sub
    }
  },
)

const tabs = computed(() => [
  { id: 'advanced-security', label: t('repository.settings.security.tabs.advancedSecurity') },
  { id: 'deploy-keys', label: t('repository.settings.security.tabs.deployKeys') },
  { id: 'secrets', label: t('repository.settings.security.tabs.secrets') },
])

function setActiveTab(id: string): void {
  activeTab.value = id
  emit('update:settingsSub', id)
}
</script>

<template>
  <div class="grid gap-4">
    <TabSwitcher
      :active-id="activeTab"
      :navigation-label="t('repository.settings.security.navigation')"
      :tabs="tabs"
      @update:active-id="setActiveTab"
    />

    <AdvancedSecurityPanel
      v-if="activeTab === 'advanced-security'"
      :owner="owner"
      :repo="repo"
    />
    <DeployKeysPanel
      v-else-if="activeTab === 'deploy-keys'"
      :owner="owner"
      :repo="repo"
    />
    <SecretsPanel
      v-else-if="activeTab === 'secrets'"
      :owner="owner"
      :repo="repo"
    />
  </div>
</template>
