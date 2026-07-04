<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Trash2 } from 'lucide-vue-next'
import { Button, Spinner } from '@oh-my-github/ui'
import {
  deleteSelfHostedRunner,
  useRepositorySettingsInvalidation,
  useRunnersQuery,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateAutomation } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))
const query = useRunnersQuery(() => props.owner, () => props.repo, hasIdentity)
const runners = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const pending = ref(new Set<number>())

async function remove(runnerId: number): Promise<void> {
  if (pending.value.has(runnerId)) return
  pending.value = new Set([...pending.value, runnerId])

  try {
    await deleteSelfHostedRunner(props.owner, props.repo, runnerId)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.automation.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(runnerId)
    pending.value = next
    invalidateAutomation('runners', props.owner, props.repo)
  }
}

function openExternal(): void {
  const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings/actions/runners/new`
  void window.ohMyGithub?.links?.openExternalUrl(url)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <p class="text-caption text-muted-foreground">
        {{ t('repository.settings.automation.runners.hint') }}
      </p>
      <Button
        size="sm"
        type="button"
        variant="outline"
        @click="openExternal"
      >
        {{ t('repository.settings.automation.runners.new') }}
        <ExternalLink
          class="size-3.5"
          :stroke-width="1.75"
        />
      </Button>
    </div>

    <div
      v-if="isLoading"
      class="flex min-h-[8rem] items-center justify-center"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <div
      v-else-if="runners.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(runner, index) in runners"
        :key="runner.id"
        :class="[
          'flex items-center justify-between gap-4 px-4 py-2.5',
          index > 0 ? 'border-t border-border' : '',
        ]"
      >
        <div class="grid min-w-0 gap-0.5">
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="runner.status === 'online' ? 'bg-success' : 'bg-muted-foreground/50'"
            />
            <span class="truncate text-body font-medium text-foreground">{{ runner.name }}</span>
          </div>
          <span class="truncate text-caption text-muted-foreground">
            {{ runner.os }} · {{ runner.busy
              ? t('repository.settings.automation.runners.busy')
              : runner.status }} · {{ runner.labels.join(', ') }}
          </span>
        </div>
        <Button
          :aria-label="t('repository.settings.automation.runners.remove')"
          :disabled="pending.has(runner.id)"
          size="icon-sm"
          type="button"
          variant="outline"
          @click="remove(runner.id)"
        >
          <Trash2
            class="size-3.5 text-muted-foreground"
            :stroke-width="1.75"
          />
        </Button>
      </div>
    </div>

    <p
      v-else
      class="text-body text-muted-foreground"
    >
      {{ t('repository.settings.automation.runners.empty') }}
    </p>
  </div>
</template>
