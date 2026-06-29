<script setup lang="ts">
import type { BadgeVariants } from '@oh-my-github/ui'
import type { WorkItemKind, WorkItemState } from './types'
import { computed } from 'vue'
import { Badge } from '@oh-my-github/ui'
import WorkItemStateIcon from './work-item-state-icon.vue'

const props = defineProps<{
  state: WorkItemState
  label: string
  kind?: WorkItemKind
}>()

const resolvedKind = computed<WorkItemKind>(() => props.kind ?? inferKind(props.state))

const variant = computed<BadgeVariants['variant']>(() => {
  switch (props.state) {
    case 'open':
    case 'completed':
      return 'success'
    case 'merged':
      return 'info'
    case 'draft':
      return 'secondary'
    case 'not_planned':
      return 'warning'
    case 'closed':
      return 'destructive'
    default:
      return 'outline'
  }
})

function inferKind(state: WorkItemState): WorkItemKind {
  return state === 'draft' || state === 'merged' ? 'pull-request' : 'issue'
}
</script>

<template>
  <Badge
    class="max-w-full"
    :variant="variant"
  >
    <WorkItemStateIcon
      :kind="resolvedKind"
      size="xs"
      :state="state"
    />
    <span class="truncate">{{ label }}</span>
  </Badge>
</template>
