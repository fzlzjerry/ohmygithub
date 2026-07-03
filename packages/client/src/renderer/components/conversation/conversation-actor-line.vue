<script setup lang="ts">
import type { ConversationActor, ConversationBadge } from './types'
import { computed } from 'vue'
import { Badge } from '@oh-my-github/ui'
import GitHubActorLink from '@/components/github/github-actor-link.vue'
import {
  formatConversationDate,
  toConversationDateTime,
} from './format'

const props = withDefaults(defineProps<{
  actor: ConversationActor
  createdAt?: string | null
  updatedAt?: string | null
  badges?: ConversationBadge[]
  showAvatar?: boolean
}>(), {
  badges: () => [],
  showAvatar: true,
})

const createdLabel = computed(() => formatConversationDate(props.createdAt))
const updatedLabel = computed(() => {
  if (!props.updatedAt || props.updatedAt === props.createdAt) return null

  return formatConversationDate(props.updatedAt)
})
const createdDateTime = computed(() => toConversationDateTime(props.createdAt))
const updatedDateTime = computed(() => toConversationDateTime(props.updatedAt))
const visibleBadges = computed(() => props.badges.filter((badge) => badge.label.trim().length > 0))
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <GitHubActorLink
      v-if="showAvatar"
      class="shrink-0"
      avatar-size="md"
      :avatar-url="actor.avatarUrl"
      :is-bot="actor.isBot"
      :login="actor.login"
      :show-username="false"
    />

    <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <GitHubActorLink
        class="text-label"
        avatar-size="sm"
        :avatar-url="actor.avatarUrl"
        :is-bot="actor.isBot"
        :login="actor.login"
        :show-avatar="false"
      />

      <span
        v-if="createdLabel || updatedLabel"
        class="inline-flex min-w-0 items-baseline gap-1 text-caption text-muted-foreground"
      >
        <time
          v-if="createdLabel"
          class="truncate"
          :datetime="createdDateTime"
        >
          {{ createdLabel }}
        </time>
        <span
          v-if="createdLabel && updatedLabel"
          aria-hidden="true"
        >·</span>
        <time
          v-if="updatedLabel"
          class="truncate"
          :datetime="updatedDateTime"
        >
          {{ updatedLabel }}
        </time>
      </span>

      <span
        v-if="visibleBadges.length > 0"
        class="flex min-w-0 flex-wrap items-center gap-1 self-center"
      >
        <Badge
          v-for="badge in visibleBadges"
          :key="badge.id"
          class="max-w-full"
          size="sm"
          :variant="badge.variant ?? 'secondary'"
        >
          <span class="truncate">{{ badge.label }}</span>
        </Badge>
      </span>
    </div>
  </div>
</template>
