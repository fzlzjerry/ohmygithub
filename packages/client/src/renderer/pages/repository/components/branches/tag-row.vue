<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MoreHorizontal, Tag, Trash2 } from 'lucide-vue-next'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@oh-my-github/ui'

const props = defineProps<{
  tag: GitHubTagListItem
}>()

const emit = defineEmits<{
  delete: [tag: GitHubTagListItem]
}>()

const { t } = useI18n()

const dateText = computed(() => {
  if (!props.tag.date) return ''

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(props.tag.date))
})
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition-colors hover:bg-muted/50">
    <div class="grid min-w-0 gap-1">
      <div class="flex min-w-0 items-center gap-2">
        <code class="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-body text-foreground">
          <Tag
            class="size-3 shrink-0 text-muted-foreground"
            :stroke-width="1.75"
          />
          <span class="min-w-0 truncate">{{ tag.name }}</span>
        </code>
        <Badge
          v-if="tag.isAnnotated"
          variant="outline"
        >
          {{ t('repository.branches.badges.annotated') }}
        </Badge>
      </div>
      <span class="flex min-w-0 items-center gap-2 text-body text-muted-foreground">
        <span
          v-if="dateText"
          class="shrink-0"
        >{{ dateText }}</span>
        <code
          v-if="tag.shortSha"
          class="shrink-0 font-mono"
        >{{ tag.shortSha }}</code>
        <span
          v-if="tag.message"
          class="min-w-0 truncate"
        >{{ tag.message }}</span>
      </span>
    </div>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          :aria-label="t('repository.branches.actions.menu')"
          class="shrink-0 text-muted-foreground"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal class="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          @click="emit('delete', tag)"
        >
          <Trash2 class="size-3.5" />
          {{ t('repository.branches.actions.delete') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
