<script setup lang="ts">
import type { WorkspaceSidebarTreeItem as WorkspaceSidebarTreeItemData } from '../types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Ellipsis } from 'lucide-vue-next'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@oh-my-github/ui'
import WorkspaceSidebarTreeItemComponent from './workspace-sidebar-tree-item.vue'

const ROOT_VISIBLE_STEP = 4

const props = defineProps<{
  items: WorkspaceSidebarTreeItemData[]
  activeItemId: string | null
  expandedIds: Set<string>
  visibleCounts: Map<string, number>
  listId: string
  activeUrl: string
}>()

const emit = defineEmits<{
  autoExpand: [id: string]
  select: [url: string, itemId: string]
  showMore: [listId: string, visibleCount: number]
  toggle: [id: string]
}>()

const { t } = useI18n()

const visibleCount = computed(() => props.visibleCounts.get(props.listId) ?? ROOT_VISIBLE_STEP)
const visibleItems = computed(() => props.items.slice(0, visibleCount.value))
const showMore = computed(() => props.items.length > visibleCount.value)

function showMoreItems(): void {
  emit('showMore', props.listId, Math.min(props.items.length, visibleCount.value + ROOT_VISIBLE_STEP))
}
</script>

<template>
  <SidebarMenu>
    <WorkspaceSidebarTreeItemComponent
      v-for="item in visibleItems"
      :key="item.id"
      :active-item-id="activeItemId"
      :active-url="activeUrl"
      :expanded-ids="expandedIds"
      :item="item"
      :level="0"
      :visible-counts="visibleCounts"
      @auto-expand="emit('autoExpand', $event)"
      @select="(url: string, itemId: string) => emit('select', url, itemId)"
      @show-more="(listId: string, visibleCount: number) => emit('showMore', listId, visibleCount)"
      @toggle="emit('toggle', $event)"
    />

    <SidebarMenuItem v-if="showMore">
      <SidebarMenuButton
        size="sm"
        :tooltip="t('workspace.sidebar.more')"
        type="button"
        @click="showMoreItems"
      >
        <Ellipsis />
        <span>{{ t('workspace.sidebar.more') }}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
