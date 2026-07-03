<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MoreHorizontal, Trash2 } from 'lucide-vue-next'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@oh-my-github/ui'

const MAX_VISIBLE_TAGS = 3

const props = defineProps<{
  version: GitHubPackageVersion
}>()

const emit = defineEmits<{
  delete: [version: GitHubPackageVersion]
}>()

const { t } = useI18n()

const visibleTags = computed(() => props.version.containerTags.slice(0, MAX_VISIBLE_TAGS))
const overflowTagCount = computed(() => Math.max(0, props.version.containerTags.length - MAX_VISIBLE_TAGS))
const createdAt = computed(() => formatDate(props.version.createdAt))

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <div class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 transition-colors hover:bg-muted/50">
    <div class="grid min-w-0 gap-2">
      <span class="min-w-0 truncate text-control font-medium text-foreground">
        {{ version.name }}
      </span>
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge
          v-for="tag in visibleTags"
          :key="tag"
          size="sm"
          variant="outline"
        >
          {{ tag }}
        </Badge>
        <Badge
          v-if="overflowTagCount > 0"
          size="sm"
          variant="secondary"
        >
          {{ t('repository.packages.versions.row.moreTags', { count: overflowTagCount }) }}
        </Badge>
        <span class="text-body text-muted-foreground">
          {{ t('repository.packages.versions.row.created', { date: createdAt }) }}
        </span>
      </div>
    </div>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          :aria-label="t('repository.packages.versions.actions.menu')"
          class="text-muted-foreground"
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
          @click="emit('delete', version)"
        >
          <Trash2 class="size-3.5" />
          {{ t('repository.packages.actions.deleteVersion') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
