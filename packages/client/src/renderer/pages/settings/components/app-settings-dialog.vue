<script setup lang="ts">
import { computed } from 'vue'
import { Keyboard, Palette } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@oh-my-github/ui'
import type { SettingsTabId } from '../settings-tabs'
import AppearanceSettings from './appearance-settings/index.vue'
import KeyboardSettingsPage from './keyboard/keyboard-settings-page.vue'

const props = defineProps<{
  activeTab: SettingsTabId
}>()

const emit = defineEmits<{
  close: []
  selectTab: [tab: SettingsTabId]
}>()

const { t } = useI18n()
const tabs = [
  {
    id: 'appearance',
    icon: Palette,
    labelKey: 'settings.tabs.appearance',
  },
  {
    id: 'keyboard',
    icon: Keyboard,
    labelKey: 'settings.tabs.keyboard',
  },
] satisfies Array<{
  id: SettingsTabId
  icon: typeof Palette
  labelKey: string
}>
const activeTabTitle = computed(() => t(`settings.tabs.${props.activeTab}`))

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) {
    emit('close')
  }
}
</script>

<template>
  <Dialog
    :open="true"
    @update:open="handleOpenChange"
  >
    <DialogContent
      class="grid-cols-[13rem_minmax(0,1fr)] !h-[calc(100vh-2rem)] !max-h-[680px] !w-[calc(100vw-2rem)] !max-w-[880px] !gap-0 !overflow-hidden !p-0 sm:!max-w-[880px]"
    >
      <DialogTitle class="sr-only">
        {{ t('settings.title') }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ t('settings.description') }}
      </DialogDescription>

      <aside class="flex min-h-0 flex-col border-r border-border bg-muted/30 p-4">
        <nav
          :aria-label="t('settings.navigation')"
          class="min-h-0 flex-1 overflow-auto"
        >
          <div class="space-y-1">
            <p class="select-none px-2 pb-1 text-caption font-medium text-muted-foreground">
              {{ t('settings.sections.interface') }}
            </p>
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="flex h-9 w-full select-none items-center gap-2 rounded-md px-2 text-left text-control outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
              :class="activeTab === tab.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
              type="button"
              @click="emit('selectTab', tab.id)"
            >
              <component
                :is="tab.icon"
                class="size-4 shrink-0"
              />
              <span class="truncate">
                {{ t(tab.labelKey) }}
              </span>
            </button>
          </div>
        </nav>
      </aside>

      <section class="min-h-0 overflow-auto p-6 pr-12">
        <header class="mb-6">
          <h2 class="select-none truncate text-heading font-semibold text-foreground">
            {{ activeTabTitle }}
          </h2>
        </header>

        <AppearanceSettings v-if="activeTab === 'appearance'" />
        <KeyboardSettingsPage v-else-if="activeTab === 'keyboard'" />
      </section>
    </DialogContent>
  </Dialog>
</template>
