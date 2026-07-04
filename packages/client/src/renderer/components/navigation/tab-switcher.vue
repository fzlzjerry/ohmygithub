<script setup lang="ts">
import type { Component } from 'vue'

export interface TabSwitcherItem {
  id: string
  label: string
  icon?: Component
  count?: number | null
  disabled?: boolean
}

const props = defineProps<{
  activeId: string
  navigationLabel: string
  tabs: TabSwitcherItem[]
}>()

const emit = defineEmits<{
  'update:activeId': [id: string]
}>()

function selectTab(tab: TabSwitcherItem): void {
  if (tab.disabled || tab.id === props.activeId) return

  emit('update:activeId', tab.id)
}

function formatCount(count: number): string {
  return new Intl.NumberFormat().format(count)
}
</script>

<template>
  <nav
    :aria-label="navigationLabel"
    class="flex min-w-0 flex-wrap items-center gap-1"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="inline-flex h-8 select-none items-center gap-1.5 border-b px-2 text-body font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring/30"
      :class="tab.disabled
        ? 'cursor-not-allowed border-transparent text-muted-foreground/70'
        : tab.id === activeId
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
      :aria-current="tab.id === activeId ? 'page' : undefined"
      :aria-disabled="tab.disabled ? 'true' : undefined"
      :disabled="tab.disabled"
      type="button"
      @click="selectTab(tab)"
    >
      <component
        :is="tab.icon"
        v-if="tab.icon"
        class="size-3.5"
      />
      <span>{{ tab.label }}</span>
      <span
        v-if="tab.count !== undefined && tab.count !== null"
        class="rounded-full bg-muted px-1.5 text-caption tabular-nums text-muted-foreground"
      >
        {{ formatCount(tab.count) }}
      </span>
    </button>
  </nav>
</template>
