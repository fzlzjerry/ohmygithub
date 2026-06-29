<script setup lang="ts">
import type { Component } from 'vue'
import type { WorkItemKind, WorkItemState } from './types'
import { computed } from 'vue'
import {
  CircleCheck,
  CircleDot,
  CircleSlash,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  kind: WorkItemKind
  state: WorkItemState
  size?: 'xs' | 'sm' | 'md'
  tone?: 'state' | 'current'
}>(), {
  size: 'sm',
  tone: 'state',
})

const icon = computed<Component>(() => {
  if (props.kind === 'pull-request') {
    if (props.state === 'draft') return GitPullRequestDraft
    if (props.state === 'merged') return GitMerge
    if (props.state === 'closed') return GitPullRequestClosed

    return GitPullRequest
  }

  if (props.state === 'completed') return CircleCheck
  if (props.state === 'not_planned' || props.state === 'closed') return CircleSlash

  return CircleDot
})

const toneClass = computed(() => {
  if (props.tone === 'current') return 'text-current'

  if (props.kind === 'pull-request') {
    if (props.state === 'draft') return 'text-muted-foreground'
    if (props.state === 'merged') return 'text-[color:var(--accent-purple)]'
    if (props.state === 'closed') return 'text-destructive'

    return 'text-success'
  }

  if (props.state === 'completed') return 'text-[color:var(--accent-purple)]'
  if (props.state === 'not_planned' || props.state === 'closed') return 'text-muted-foreground'

  return 'text-success'
})

const sizeClass = computed(() => {
  if (props.size === 'xs') return 'size-3'
  if (props.size === 'md') return 'size-4'

  return 'size-3.5'
})
</script>

<template>
  <component
    :is="icon"
    class="shrink-0"
    :class="[sizeClass, toneClass]"
    :stroke-width="1.8"
  />
</template>
