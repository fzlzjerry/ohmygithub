<script setup lang="ts">
import type { KeyboardShortcutCommandId, KeyboardShortcutDefinition } from '../../../../keyboard/shortcut-definitions'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Ban, Pencil, RotateCcw } from 'lucide-vue-next'
import {
  Button,
  ButtonGroup,
} from '@oh-my-github/ui'
import ShortcutKbd from './shortcut-kbd.vue'
import ShortcutRecorder from './shortcut-recorder.vue'

const props = defineProps<{
  accelerator: string | null
  conflictLabel?: string
  definition: KeyboardShortcutDefinition
  disabled: boolean
  editing: boolean
  customized: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  cancel: []
  disable: [commandId: KeyboardShortcutCommandId]
  reset: [commandId: KeyboardShortcutCommandId]
  save: [commandId: KeyboardShortcutCommandId, accelerator: string]
  startEdit: [commandId: KeyboardShortcutCommandId]
}>()

const { t } = useI18n()
const canReset = computed(() => props.customized && !props.pending)
const disableLabel = computed(() => props.disabled
  ? t('settings.keyboard.enable')
  : t('settings.keyboard.disable')
)

function toggleDisabled(): void {
  if (props.disabled) {
    emit('reset', props.definition.id)
    return
  }

  emit('disable', props.definition.id)
}
</script>

<template>
  <div class="mx-4 grid gap-3 border-b border-border py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div class="min-w-0">
      <div class="select-none text-label font-medium text-foreground">
        {{ t(definition.labelKey) }}
      </div>
      <p class="mt-0.5 text-body text-muted-foreground">
        {{ t(definition.descriptionKey) }}
      </p>
      <p
        v-if="conflictLabel"
        class="mt-1 text-body text-destructive"
      >
        {{ t('settings.keyboard.conflict', { command: conflictLabel }) }}
      </p>
    </div>

    <div
      v-if="editing"
      class="grid gap-2"
    >
      <ShortcutRecorder
        @cancel="emit('cancel')"
        @save="emit('save', definition.id, $event)"
      />
      <Button
        class="justify-self-start"
        size="sm"
        type="button"
        variant="ghost"
        @click="emit('cancel')"
      >
        {{ t('settings.keyboard.cancel') }}
      </Button>
    </div>

    <div
      v-else
      class="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end"
    >
      <div class="mr-1 flex min-w-24 justify-start sm:justify-end">
        <ShortcutKbd
          :accelerator="accelerator"
          :disabled="disabled"
        />
      </div>
      <ButtonGroup class="shrink-0">
        <Button
          :aria-label="t('settings.keyboard.change')"
          class="size-8"
          :disabled="pending"
          size="icon-sm"
          :title="t('settings.keyboard.change')"
          type="button"
          variant="ghost"
          @click="emit('startEdit', definition.id)"
        >
          <Pencil class="size-3.5" />
        </Button>
        <Button
          :aria-label="disableLabel"
          class="size-8"
          :disabled="pending"
          size="icon-sm"
          :title="disableLabel"
          type="button"
          variant="ghost"
          @click="toggleDisabled"
        >
          <Ban class="size-3.5" />
        </Button>
        <Button
          :aria-label="t('settings.keyboard.reset')"
          class="size-8"
          :disabled="!canReset"
          size="icon-sm"
          :title="t('settings.keyboard.reset')"
          type="button"
          variant="ghost"
          @click="emit('reset', definition.id)"
        >
          <RotateCcw class="size-3.5" />
        </Button>
      </ButtonGroup>
    </div>
  </div>
</template>
