<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Spinner } from '@oh-my-github/ui'
import {
  updateRepositoryCustomProperties,
  useCustomPropertiesQuery,
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
const query = useCustomPropertiesQuery(() => props.owner, () => props.repo, hasIdentity)
const properties = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const drafts = ref<Record<string, string>>({})
const isSaving = ref(false)

watch(properties, (values) => {
  const next: Record<string, string> = {}
  for (const property of values) {
    next[property.propertyName] = Array.isArray(property.value)
      ? property.value.join(', ')
      : property.value ?? ''
  }
  drafts.value = next
}, { immediate: true })

const isDirty = computed(() => properties.value.some((property) => {
  const original = Array.isArray(property.value) ? property.value.join(', ') : property.value ?? ''
  return (drafts.value[property.propertyName] ?? '') !== original
}))

async function save(): Promise<void> {
  if (!isDirty.value || isSaving.value) return
  isSaving.value = true

  const values: GitHubRepositoryCustomPropertyValue[] = properties.value
    .filter((property) => {
      const original = Array.isArray(property.value) ? property.value.join(', ') : property.value ?? ''
      return (drafts.value[property.propertyName] ?? '') !== original
    })
    .map((property) => {
      const draft = (drafts.value[property.propertyName] ?? '').trim()
      const value = Array.isArray(property.value)
        ? draft ? draft.split(',').map((item) => item.trim()).filter(Boolean) : null
        : draft || null

      return { propertyName: property.propertyName, value }
    })

  try {
    await updateRepositoryCustomProperties(props.owner, props.repo, values)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.automation.error'))
  } finally {
    isSaving.value = false
    invalidateAutomation('custom-properties', props.owner, props.repo)
  }
}
</script>

<template>
  <div
    v-if="isLoading"
    class="flex min-h-[8rem] items-center justify-center"
  >
    <Spinner class="size-4 text-muted-foreground" />
  </div>

  <div
    v-else-if="properties.length > 0"
    class="grid max-w-xl gap-3"
  >
    <p class="text-caption text-muted-foreground">
      {{ t('repository.settings.automation.customProperties.hint') }}
    </p>

    <div class="grid gap-2">
      <div
        v-for="property in properties"
        :key="property.propertyName"
        class="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center gap-3"
      >
        <span class="truncate text-body font-medium text-foreground">{{ property.propertyName }}</span>
        <Input
          v-model="drafts[property.propertyName]"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <div
      v-if="isDirty"
      class="flex justify-end"
    >
      <Button
        :disabled="isSaving"
        size="sm"
        type="button"
        @click="save"
      >
        <Spinner
          v-if="isSaving"
          class="size-3.5"
        />
        {{ t('repository.settings.automation.save') }}
      </Button>
    </div>
  </div>

  <p
    v-else
    class="text-body text-muted-foreground"
  >
    {{ t('repository.settings.automation.customProperties.empty') }}
  </p>
</template>
