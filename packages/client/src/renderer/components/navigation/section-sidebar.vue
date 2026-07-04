<script setup lang="ts">
import type { Component } from 'vue'
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

export interface SectionSidebarChildItem {
  id: string
  label: string
  disabled?: boolean
}

export interface SectionSidebarItem {
  id: string
  label: string
  icon: Component
  countLabel?: string | null
  disabled?: boolean
  children?: readonly SectionSidebarChildItem[]
  defaultExpanded?: boolean
}

const props = defineProps<{
  activeId: string
  items: readonly SectionSidebarItem[]
  navigationLabel: string
}>()

const emit = defineEmits<{
  'update:activeId': [value: string]
}>()

const expandedIds = ref(new Set(
  props.items
    .filter((item) => hasChildren(item) && item.defaultExpanded)
    .map((item) => item.id),
))

function hasChildren(item: SectionSidebarItem): boolean {
  return (item.children?.length ?? 0) > 0
}

function isExpanded(item: SectionSidebarItem): boolean {
  return expandedIds.value.has(item.id)
}

function isParentOfActive(item: SectionSidebarItem): boolean {
  return item.children?.some((child) => child.id === props.activeId) ?? false
}

function toggleExpanded(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

function selectItem(item: SectionSidebarItem): void {
  emit('update:activeId', item.id)

  if (hasChildren(item) && !expandedIds.value.has(item.id)) {
    expandedIds.value = new Set([...expandedIds.value, item.id])
  }
}

watch(
  () => [props.activeId, props.items] as const,
  ([activeId, items]) => {
    const parent = items.find((item) => item.children?.some((child) => child.id === activeId))
    if (parent && !expandedIds.value.has(parent.id)) {
      expandedIds.value = new Set([...expandedIds.value, parent.id])
    }
  },
  { immediate: true },
)
</script>

<template>
  <aside class="flex h-full w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
    <slot name="header" />

    <nav
      class="grid gap-1 px-2 py-1.5"
      :aria-label="navigationLabel"
    >
      <template
        v-for="item in items"
        :key="item.id"
      >
        <div class="relative">
          <button
            :class="[
              'grid h-9 w-full grid-cols-[0.25rem_1rem_minmax(0,1fr)_auto] items-center gap-x-1 rounded-lg text-left text-body font-normal outline-hidden transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
              hasChildren(item) ? 'pr-8' : 'pr-2',
              activeId === item.id || isParentOfActive(item) ? 'text-foreground' : 'text-muted-foreground',
            ]"
            :aria-current="activeId === item.id ? 'page' : undefined"
            :disabled="item.disabled"
            type="button"
            @click="selectItem(item)"
          >
            <span
              class="h-4 w-0.5 justify-self-center rounded-full"
              :class="activeId === item.id ? 'bg-muted-foreground' : 'bg-transparent'"
            />
            <component
              :is="item.icon"
              class="size-3.5 justify-self-center"
              :stroke-width="1.75"
            />
            <span class="ml-1 min-w-0 truncate select-none">
              {{ item.label }}
            </span>
            <span
              v-if="item.countLabel"
              class="select-none tabular-nums text-muted-foreground opacity-70"
            >
              {{ item.countLabel }}
            </span>
          </button>

          <button
            v-if="hasChildren(item)"
            class="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-hidden transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
            :aria-expanded="isExpanded(item)"
            :aria-label="item.label"
            type="button"
            @click.stop="toggleExpanded(item.id)"
          >
            <ChevronRight
              class="size-3.5 transition-transform"
              :class="isExpanded(item) ? 'rotate-90' : ''"
              :stroke-width="1.75"
            />
          </button>
        </div>

        <template v-if="hasChildren(item) && isExpanded(item)">
          <button
            v-for="child in item.children"
            :key="child.id"
            :class="[
              'grid h-8 w-full grid-cols-[0.25rem_1rem_minmax(0,1fr)_auto] items-center gap-x-1 rounded-lg pr-2 text-left text-body font-normal outline-hidden transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
              activeId === child.id ? 'text-foreground' : 'text-muted-foreground',
            ]"
            :aria-current="activeId === child.id ? 'page' : undefined"
            :disabled="child.disabled"
            type="button"
            @click="emit('update:activeId', child.id)"
          >
            <span
              class="h-4 w-0.5 justify-self-center rounded-full"
              :class="activeId === child.id ? 'bg-muted-foreground' : 'bg-transparent'"
            />
            <span aria-hidden="true" />
            <span class="ml-1 min-w-0 truncate select-none">
              {{ child.label }}
            </span>
          </button>
        </template>
      </template>
    </nav>
  </aside>
</template>
