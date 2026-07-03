<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Container, MoreHorizontal, Package as PackageIcon, Trash2 } from 'lucide-vue-next'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@oh-my-github/ui'

const props = defineProps<{
  package: GitHubPackage
}>()

const emit = defineEmits<{
  viewVersions: [pkg: GitHubPackage]
  delete: [pkg: GitHubPackage]
}>()

const { t } = useI18n()

const icon = computed(() =>
  props.package.packageType === 'container' || props.package.packageType === 'docker'
    ? Container
    : PackageIcon
)
const updatedAt = computed(() => formatDate(props.package.updatedAt))

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function openVersions(): void {
  emit('viewVersions', props.package)
}
</script>

<template>
  <div
    class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-4 text-left outline-hidden transition-colors hover:bg-muted/50"
  >
    <div class="mt-0.5 flex size-5 items-center justify-center text-muted-foreground">
      <component
        :is="icon"
        class="size-4"
      />
    </div>

    <button
      class="grid min-w-0 gap-2 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring/30"
      type="button"
      @click="openVersions"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 truncate text-control font-medium text-foreground">
          {{ package.name }}
        </span>
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge
          size="sm"
          variant="outline"
        >
          {{ package.packageType }}
        </Badge>
        <Badge
          size="sm"
          variant="secondary"
        >
          {{ t(`repository.packages.visibility.${package.visibility}`) }}
        </Badge>
        <span class="text-body text-muted-foreground">
          {{ t('repository.packages.row.versionCount', { count: package.versionCount }) }}
        </span>
        <span
          aria-hidden="true"
          class="text-body text-muted-foreground"
        >·</span>
        <span class="text-body text-muted-foreground">
          {{ t('repository.packages.row.updated', { date: updatedAt }) }}
        </span>
      </div>
    </button>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          :aria-label="t('repository.packages.actions.menu')"
          class="text-muted-foreground"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal class="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @click="openVersions">
          <PackageIcon class="size-3.5" />
          {{ t('repository.packages.actions.viewVersions') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          @click="emit('delete', package)"
        >
          <Trash2 class="size-3.5" />
          {{ t('repository.packages.actions.deletePackage') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
