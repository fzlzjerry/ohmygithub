<script setup lang="ts">
import type {
  KeyboardShortcutCommandId,
  KeyboardShortcutDefinition,
  KeyboardShortcutGroupId,
} from '../../../../keyboard/shortcut-definitions'
import { useI18n } from 'vue-i18n'
import ShortcutRow from './shortcut-row.vue'

defineProps<{
  accelerators: Record<KeyboardShortcutCommandId, string | null>
  conflictLabels: Partial<Record<KeyboardShortcutCommandId, string>>
  customizedIds: Set<KeyboardShortcutCommandId>
  disabledIds: Set<KeyboardShortcutCommandId>
  editingId: KeyboardShortcutCommandId | null
  group: KeyboardShortcutGroupId
  pendingId: KeyboardShortcutCommandId | null
  shortcuts: readonly KeyboardShortcutDefinition[]
}>()

const emit = defineEmits<{
  cancel: []
  disable: [commandId: KeyboardShortcutCommandId]
  reset: [commandId: KeyboardShortcutCommandId]
  save: [commandId: KeyboardShortcutCommandId, accelerator: string]
  startEdit: [commandId: KeyboardShortcutCommandId]
}>()

const { t } = useI18n()

function saveShortcut(commandId: KeyboardShortcutCommandId, accelerator: string): void {
  emit('save', commandId, accelerator)
}
</script>

<template>
  <section class="space-y-2.5">
    <div class="select-none px-2 text-caption font-medium text-muted-foreground">
      {{ t(`settings.keyboard.groups.${group}`) }}
    </div>
    <div class="overflow-hidden rounded-[var(--radius-menu-shell)] border border-border bg-card">
      <ShortcutRow
        v-for="shortcut in shortcuts"
        :key="shortcut.id"
        :accelerator="accelerators[shortcut.id]"
        :conflict-label="conflictLabels[shortcut.id]"
        :customized="customizedIds.has(shortcut.id)"
        :definition="shortcut"
        :disabled="disabledIds.has(shortcut.id)"
        :editing="editingId === shortcut.id"
        :pending="pendingId === shortcut.id"
        @cancel="emit('cancel')"
        @disable="emit('disable', $event)"
        @reset="emit('reset', $event)"
        @save="saveShortcut"
        @start-edit="emit('startEdit', $event)"
      />
    </div>
  </section>
</template>
