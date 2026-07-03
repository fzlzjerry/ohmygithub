<script setup lang="ts">
import type { ConversationReaction } from './types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SmilePlus } from 'lucide-vue-next'
import { Badge, Popover, PopoverContent, PopoverTrigger } from '@oh-my-github/ui'
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
</script>

<template>
  <div
    v-if="displayReactions.length > 0 || canReact"
    class="flex min-w-0 flex-wrap items-center gap-1.5"
  >
    <template v-if="canReact">
      <Badge
        v-for="reaction in displayReactions"
        :key="reaction.content"
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

    <template v-else>
      <Badge
        v-for="reaction in displayReactions"
        :key="reaction.content"
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
    </template>
  </div>
</template>
