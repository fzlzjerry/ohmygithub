<script setup lang="ts">
import type { ConversationReaction, ConversationReactionUser } from './types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { SmilePlus } from 'lucide-vue-next'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@oh-my-github/ui'
import { REACTION_CONTENTS, reactionEmoji } from './reactions'

const props = withDefaults(defineProps<{
  reactions?: ConversationReaction[]
  canReact?: boolean
}>(), {
  reactions: () => [],
  canReact: false,
})

const emit = defineEmits<{
  toggle: [content: string, reacted: boolean]
}>()

const { t } = useI18n()
const router = useRouter()

const pickerOpen = ref(false)
// Optimistic view of toggles the server has not confirmed yet; cleared when
// fresh reactions arrive from a refetch.
const overrides = ref(new Map<string, boolean>())

watch(() => props.reactions, () => {
  overrides.value = new Map()
})

const displayReactions = computed(() => {
  const merged = new Map<string, ConversationReaction>()

  for (const reaction of props.reactions) {
    merged.set(reaction.content, { ...reaction })
  }

  for (const [content, reacted] of overrides.value) {
    const existing = merged.get(content)

    if (!existing) {
      if (reacted) merged.set(content, { content, count: 1, viewerHasReacted: true })
      continue
    }

    if (Boolean(existing.viewerHasReacted) === reacted) continue

    merged.set(content, {
      content,
      count: existing.count + (reacted ? 1 : -1),
      viewerHasReacted: reacted,
    })
  }

  return [...merged.values()].filter((reaction) => reaction.count > 0)
})

function isReacted(content: string): boolean {
  const override = overrides.value.get(content)
  if (override !== undefined) return override

  return Boolean(props.reactions.find((reaction) => reaction.content === content)?.viewerHasReacted)
}

function toggleReaction(content: string): void {
  const reacted = !isReacted(content)
  const nextOverrides = new Map(overrides.value)

  nextOverrides.set(content, reacted)
  overrides.value = nextOverrides
  pickerOpen.value = false
  emit('toggle', content, reacted)
}

function reactors(reaction: ConversationReaction): ConversationReactionUser[] {
  return reaction.reactors ?? []
}

function hiddenReactorCount(reaction: ConversationReaction): number {
  return Math.max(0, reaction.count - reactors(reaction).length)
}

function reactorFallback(user: ConversationReactionUser): string {
  return user.login.slice(0, 2).toUpperCase()
}

function openReactorAccount(user: ConversationReactionUser): void {
  void router.push(`/${encodeURIComponent(user.login)}`)
}
</script>

<template>
  <div
    v-if="displayReactions.length > 0 || canReact"
    class="flex min-w-0 flex-wrap items-center gap-1.5"
  >
    <HoverCard
      v-for="reaction in displayReactions"
      :key="reaction.content"
    >
      <HoverCardTrigger as-child>
        <Badge
          v-if="canReact"
          as="button"
          :aria-label="t('conversation.reactions.toggle', { reaction: reaction.content })"
          :aria-pressed="Boolean(reaction.viewerHasReacted)"
          class="h-7 cursor-pointer gap-1.5 px-2.5 transition-colors hover:bg-accent"
          :class="reaction.viewerHasReacted ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15' : undefined"
          type="button"
          variant="outline"
          @click="toggleReaction(reaction.content)"
        >
          <span
            aria-hidden="true"
            class="text-sm leading-none"
          >{{ reactionEmoji(reaction.content) }}</span>
          <span class="text-xs tabular-nums">{{ reaction.count }}</span>
        </Badge>
        <Badge
          v-else
          class="h-7 gap-1.5 px-2.5"
          :class="reaction.viewerHasReacted ? 'border-primary/30 bg-primary/10 text-primary' : undefined"
          variant="outline"
        >
          <span
            aria-hidden="true"
            class="text-sm leading-none"
          >{{ reactionEmoji(reaction.content) }}</span>
          <span class="text-xs tabular-nums">{{ reaction.count }}</span>
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent
        v-if="reactors(reaction).length > 0"
        :align-offset="0"
        class="w-64 p-1.5"
      >
        <ul class="grid max-h-72 gap-0.5 overflow-y-auto">
          <li
            v-for="user in reactors(reaction)"
            :key="user.login"
          >
            <button
              class="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
              type="button"
              @click="openReactorAccount(user)"
            >
              <Avatar class="size-5 shrink-0">
                <AvatarImage
                  v-if="user.avatarUrl"
                  :alt="user.login"
                  :src="user.avatarUrl"
                />
                <AvatarFallback class="text-[10px]">
                  {{ reactorFallback(user) }}
                </AvatarFallback>
              </Avatar>
              <span class="min-w-0 flex-1 truncate text-body">
                <span class="font-medium text-foreground">{{ user.name || user.login }}</span>
                <span
                  v-if="user.name"
                  class="ml-1.5 text-muted-foreground"
                >{{ user.login }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p
          v-if="hiddenReactorCount(reaction) > 0"
          class="select-none px-2 pb-1 pt-1.5 text-caption text-muted-foreground"
        >
          {{ t('conversation.reactions.moreReactors', { count: hiddenReactorCount(reaction) }) }}
        </p>
      </HoverCardContent>
    </HoverCard>

    <template v-if="canReact">
      <Popover v-model:open="pickerOpen">
        <PopoverTrigger as-child>
          <Badge
            as="button"
            :aria-label="t('conversation.reactions.add')"
            class="h-7 cursor-pointer px-2.5 text-muted-foreground transition-colors [&>svg]:size-4 hover:bg-accent hover:text-foreground"
            type="button"
            variant="outline"
          >
            <SmilePlus />
          </Badge>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          class="w-auto p-1"
        >
          <div class="flex items-center gap-0.5">
            <button
              v-for="content in REACTION_CONTENTS"
              :key="content"
              :aria-label="t('conversation.reactions.toggle', { reaction: content })"
              :aria-pressed="isReacted(content)"
              class="flex size-8 items-center justify-center rounded-md text-base transition-colors hover:bg-accent"
              :class="isReacted(content) ? 'bg-primary/10' : undefined"
              type="button"
              @click="toggleReaction(content)"
            >
              {{ reactionEmoji(content) }}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </template>
  </div>
</template>
