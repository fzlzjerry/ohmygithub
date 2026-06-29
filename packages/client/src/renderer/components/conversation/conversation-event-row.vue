<script setup lang="ts">
import type { Component } from 'vue'
import type { ConversationActor, ConversationTimelineEvent } from './types'
import { computed } from 'vue'
import { CircleDot } from 'lucide-vue-next'
import GitHubActorLink from '../github/github-actor-link.vue'
import GitHubReferenceLink from '../github/github-reference-link.vue'
import {
  formatConversationDate,
  toConversationDateTime,
} from './format'

interface ConversationEventRowEventLike {
  id: string | number
  icon?: Component
  iconClass?: string
  text?: string | null
  body?: string | null
  type?: string | null
  actor?: ConversationActor | null
  createdAt?: string | null
  reference?: ConversationTimelineEvent['reference']
}

const props = defineProps<{
  event: ConversationTimelineEvent | ConversationEventRowEventLike
}>()

const icon = computed(() => props.event.icon ?? CircleDot)
const eventText = computed(() => {
  const text = props.event.text?.trim()
  if (text) return text

  if ('body' in props.event) {
    const body = props.event.body?.trim()
    if (body) return body
  }

  if ('type' in props.event) {
    return props.event.type?.trim() ?? ''
  }

  return ''
})
const createdLabel = computed(() => formatConversationDate(props.event.createdAt))
const createdDateTime = computed(() => toConversationDateTime(props.event.createdAt))
</script>

<template>
  <div class="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-3">
    <div class="flex h-8 items-center justify-center">
      <span class="flex size-8 items-center justify-center rounded-full border border-border bg-background">
        <component
          :is="icon"
          class="size-4"
          :class="event.iconClass ?? 'text-muted-foreground'"
        />
      </span>
    </div>

    <div
      v-if="event.reference"
      class="flex min-h-8 min-w-0 items-center gap-2 text-body"
    >
      <span
        v-if="event.actor"
        class="inline-flex min-w-0 shrink-0 items-center text-label"
      >
        <GitHubActorLink
          avatar-size="sm"
          :avatar-url="event.actor.avatarUrl"
          :login="event.actor.login"
        />
      </span>

      <span
        v-if="eventText"
        class="shrink-0 text-muted-foreground"
      >
        {{ eventText }}
      </span>

      <GitHubReferenceLink
        class="min-w-0 flex-1 overflow-hidden"
        :fallback-href="event.reference.url"
        :initial-kind="event.reference.kind"
        :initial-state="event.reference.state"
        :initial-title="event.reference.title"
        :kind-hint="event.reference.kindHint"
        :number="event.reference.number"
        :owner="event.reference.owner"
        :repo="event.reference.repo"
        variant="hover"
      />

      <time
        v-if="createdLabel"
        class="shrink-0 text-body text-muted-foreground"
        :datetime="createdDateTime"
      >
        {{ createdLabel }}
      </time>
    </div>

    <div
      v-else
      class="flex min-h-8 min-w-0 items-center"
    >
      <div
        class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body"
      >
        <span
          v-if="event.actor"
          class="inline-flex min-w-0 items-center text-label"
        >
          <GitHubActorLink
            avatar-size="sm"
            :avatar-url="event.actor.avatarUrl"
            :login="event.actor.login"
          />
        </span>

        <span
          v-if="eventText"
          class="min-w-0 break-words text-muted-foreground"
        >
          {{ eventText }}
        </span>

        <time
          v-if="createdLabel"
          class="shrink-0 text-body text-muted-foreground"
          :datetime="createdDateTime"
        >
          {{ createdLabel }}
        </time>
      </div>
    </div>
  </div>
</template>
