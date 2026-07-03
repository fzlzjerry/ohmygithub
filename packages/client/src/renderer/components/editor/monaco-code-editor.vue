<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MonacoLanguage, MonacoOptions, MonacoTheme } from 'stream-monaco'
import { ensureMonacoWorkers, useMonaco } from 'stream-monaco'
import { useCodeTheme } from '@/components/index'
import { resolveCodeLanguage } from '@/components/index'
import { allSchemeThemes } from '@/components/code/scheme-code-themes'
import { useSettingsStore } from '@/stores/settings'

const props = withDefaults(defineProps<{
  modelValue: string
  filename?: string
  language?: string
  readonly?: boolean
  options?: MonacoOptions
}>(), {
  filename: undefined,
  language: undefined,
  options: undefined,
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorElement = ref<HTMLElement>()
const settingsStore = useSettingsStore()
const { activeThemeName } = useCodeTheme()
let isUpdatingFromOutside = false

function resolveLanguage(): MonacoLanguage {
  return resolveCodeLanguage({
    filename: props.filename,
    language: props.language
  }) as MonacoLanguage
}

const monaco = useMonaco({
  automaticLayout: true,
  autoScrollInitial: false,
  autoScrollOnUpdate: false,
  fontFamily: settingsStore.codeFontStack,
  fontSize: settingsStore.codeFontSizePx,
  lineHeight: 1.5,
  lineNumbers: 'on',
  minimap: { enabled: false },
  padding: { bottom: 12, top: 12 },
  readOnly: props.readonly,
  renderLineHighlight: 'line',
  scrollBeyondLastLine: false,
  tabSize: 2,
  theme: activeThemeName.value,
  themes: allSchemeThemes as MonacoTheme[],
  wordWrap: 'on',
  ...props.options
})

onMounted(async () => {
  if (!editorElement.value) return

  ensureMonacoWorkers()
  const editor = await monaco.createEditor(editorElement.value, props.modelValue, resolveLanguage())

  editor.onDidChangeModelContent(() => {
    if (isUpdatingFromOutside) return
    emit('update:modelValue', editor.getValue())
  })
})

onBeforeUnmount(() => {
  monaco.cleanupEditor()
})

watch(
  () => props.modelValue,
  (value) => {
    const editor = monaco.getEditorView()
    if (!editor || editor.getValue() === value) return

    isUpdatingFromOutside = true
    monaco.updateCode(value, resolveLanguage())
    isUpdatingFromOutside = false
  }
)

watch(
  () => props.readonly,
  (readonly) => {
    monaco.getEditorView()?.updateOptions({ readOnly: readonly })
  }
)

watch(
  () => [props.language, props.filename] as const,
  () => {
    monaco.setLanguage(resolveLanguage())
  }
)

watch(activeThemeName, (theme) => {
  void monaco.setTheme(theme as MonacoTheme, true)
})

watch(
  () => settingsStore.codeFontSizePx,
  (fontSize) => {
    monaco.getEditorView()?.updateOptions({ fontSize })
  }
)

watch(
  () => settingsStore.codeFontStack,
  (fontFamily) => {
    monaco.getEditorView()?.updateOptions({ fontFamily })
  }
)

watch(
  () => props.options,
  (options) => {
    if (options) {
      monaco.getEditorView()?.updateOptions(options)
    }
  },
  { deep: true }
)
</script>

<template>
  <div
    ref="editorElement"
    class="monaco-editor-host min-h-0 w-full overflow-hidden"
  />
</template>

<style scoped>
/* stream-monaco sizes the container to the editor content via inline styles;
   force the editor to fill whatever box the parent gives it instead. */
.monaco-editor-host {
  height: 100% !important;
  max-height: 100% !important;
}

/* Code themes use a transparent background so the editor blends into the
   scheme-tinted panel behind it. */
.monaco-editor-host :deep(.monaco-editor),
.monaco-editor-host :deep(.monaco-editor .margin),
.monaco-editor-host :deep(.monaco-editor-background),
.monaco-editor-host :deep(.monaco-editor .monaco-editor-background) {
  background: transparent !important;
}
</style>
