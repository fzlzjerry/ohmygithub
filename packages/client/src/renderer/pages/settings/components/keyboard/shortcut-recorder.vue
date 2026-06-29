<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { eventToAccelerator } from '../../../../keyboard/shortcut-accelerator'
import { useKeyboardShortcutStore } from '../../../../stores/keyboard-shortcuts'
import ShortcutKbd from './shortcut-kbd.vue'

const emit = defineEmits<{
  cancel: []
  save: [accelerator: string]
}>()

const { t } = useI18n()
const shortcuts = useKeyboardShortcutStore()
const target = ref<HTMLButtonElement>()
const previewAccelerator = ref<string | null>(null)
const errorMessage = ref('')

onMounted(() => {
  void nextTick(() => target.value?.focus())
})

function handleKeydown(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    emit('cancel')
    return
  }

  const accelerator = eventToAccelerator(event, shortcuts.platform)

  if (!accelerator) {
    previewAccelerator.value = null
    errorMessage.value = t('settings.keyboard.recorderInvalid')
    return
  }

  previewAccelerator.value = accelerator
  errorMessage.value = ''
  emit('save', accelerator)
}
</script>

<template>
  <button
    ref="target"
    data-shortcut-recorder
    class="grid min-h-14 w-full select-none gap-1 rounded-lg border border-border bg-card px-3 py-2 text-left outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    type="button"
    @keydown.capture="handleKeydown"
  >
    <span class="text-body font-medium text-foreground">
      {{ t('settings.keyboard.recorderPrompt') }}
    </span>
    <span
      v-if="previewAccelerator"
      class="flex items-center"
    >
      <ShortcutKbd :accelerator="previewAccelerator" />
    </span>
    <span
      v-else
      class="text-body text-muted-foreground"
    >
      {{ errorMessage || t('settings.keyboard.recorderHint') }}
    </span>
  </button>
</template>
