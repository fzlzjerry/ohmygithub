<script setup lang="ts">
import { computed } from 'vue'
import type { RepositoryOverviewInfoItem, RepositorySectionId } from '@/pages/repository/components/types'
import { chunkOverviewInfoItems } from './overview-info-columns'

const props = defineProps<{
  items: RepositoryOverviewInfoItem[]
}>()

const emit = defineEmits<{
  selectSection: [section: RepositorySectionId]
}>()

const columns = computed(() => chunkOverviewInfoItems(props.items))
</script>

<template>
  <div class="flex flex-wrap gap-x-8 gap-y-1">
    <div
      v-for="(column, columnIndex) in columns"
      :key="columnIndex"
      class="grid min-w-[240px] flex-1 content-start gap-y-1"
    >
      <div
        v-for="item in column"
        :key="item.id"
        class="flex min-w-0 items-center gap-2 py-1"
      >
        <component
          :is="item.icon"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <span class="select-none truncate text-body text-muted-foreground">
          {{ item.label }}
        </span>
        <a
          v-if="item.href"
          class="ml-auto min-w-0 truncate text-right text-body font-medium text-foreground underline underline-offset-4"
          :href="item.href"
          target="_blank"
          rel="noreferrer"
        >
          {{ item.value }}
        </a>
        <button
          v-else-if="item.section"
          type="button"
          class="ml-auto min-w-0 cursor-pointer truncate text-right text-body font-medium text-foreground underline underline-offset-4"
          @click="emit('selectSection', item.section)"
        >
          {{ item.value }}
        </button>
        <span
          v-else
          class="ml-auto min-w-0 truncate text-right text-body font-medium text-foreground"
        >
          {{ item.value }}
        </span>
      </div>
    </div>
  </div>
</template>
