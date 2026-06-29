<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  RadioGroup,
  RadioGroupItem,
} from '@oh-my-github/ui'

const props = defineProps<{
  disabled?: boolean
  search: string
  state: GitHubIssueSearchState
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:state': [value: GitHubIssueSearchState]
}>()

const { t } = useI18n()

const stateOptions = computed<Array<{ label: string; value: GitHubIssueSearchState }>>(() => [
  { label: t('repository.issues.filters.open'), value: 'open' },
  { label: t('repository.issues.filters.closed'), value: 'closed' },
  { label: t('repository.issues.filters.all'), value: 'all' },
])

const selectedState = computed({
  get: () => props.state,
  set: (value: string) => {
    if (value === 'closed' || value === 'all') {
      emit('update:state', value)
      return
    }

    emit('update:state', 'open')
  },
})

function updateSearch(value: string | number): void {
  emit('update:search', String(value))
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <RadioGroup
      v-model="selectedState"
      class="flex min-w-0 flex-wrap items-center gap-4"
      :disabled="disabled"
      :aria-label="t('repository.issues.filters.label')"
    >
      <label
        v-for="option in stateOptions"
        :key="option.value"
        class="flex h-8 select-none items-center gap-2 text-body font-medium text-foreground"
        :class="disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'"
      >
        <RadioGroupItem :value="option.value" />
        <span>{{ option.label }}</span>
      </label>
    </RadioGroup>

    <InputGroup
      class="w-full sm:max-w-xs"
      size="sm"
    >
      <InputGroupAddon>
        <Search class="size-3.5 text-muted-foreground" />
      </InputGroupAddon>
      <InputGroupInput
        :model-value="search"
        :disabled="disabled"
        :placeholder="t('repository.issues.search.placeholder')"
        type="search"
        @update:model-value="updateSearch"
      />
    </InputGroup>
  </div>
</template>
