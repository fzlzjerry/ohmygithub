<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Trash2 } from 'lucide-vue-next'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@oh-my-github/ui'
import {
  deleteRuleset,
  setRulesetEnforcement,
  useRepositorySettingsInvalidation,
  useRulesetsQuery,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'

const ENFORCEMENTS: readonly GitHubRulesetEnforcement[] = ['active', 'evaluate', 'disabled']

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateAutomation } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))
const query = useRulesetsQuery(() => props.owner, () => props.repo, hasIdentity)
const rulesets = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const pending = ref(new Set<number>())

async function run(id: number, action: () => Promise<void>): Promise<void> {
  if (pending.value.has(id)) return
  pending.value = new Set([...pending.value, id])

  try {
    await action()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.automation.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(id)
    pending.value = next
    invalidateAutomation('rulesets', props.owner, props.repo)
  }
}

function changeEnforcement(id: number, value: unknown): void {
  if (typeof value !== 'string') return
  void run(id, () => setRulesetEnforcement(props.owner, props.repo, id, value as GitHubRulesetEnforcement))
}

function remove(id: number): void {
  void run(id, () => deleteRuleset(props.owner, props.repo, id))
}

function openExternal(): void {
  const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings/rules`
  void window.ohMyGithub?.links?.openExternalUrl(url)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <p class="text-caption text-muted-foreground">
        {{ t('repository.settings.automation.rules.hint') }}
      </p>
      <Button
        size="sm"
        type="button"
        variant="outline"
        @click="openExternal"
      >
        {{ t('repository.settings.automation.editOnGitHub') }}
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
      v-else-if="rulesets.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(ruleset, index) in rulesets"
        :key="ruleset.id"
        :class="[
          'flex items-center justify-between gap-4 px-4 py-2.5',
          index > 0 ? 'border-t border-border' : '',
        ]"
      >
        <div class="grid min-w-0 gap-0.5">
          <span class="truncate text-body font-medium text-foreground">{{ ruleset.name }}</span>
          <span class="truncate text-caption text-muted-foreground">
            {{ t('repository.settings.automation.rules.summary', {
              target: ruleset.target,
              rules: ruleset.rules.length,
              refs: ruleset.refConditions.join(', ') || '—',
            }) }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Select
            :disabled="pending.has(ruleset.id)"
            :model-value="ruleset.enforcement"
            @update:model-value="changeEnforcement(ruleset.id, $event)"
          >
            <SelectTrigger class="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="enforcement in ENFORCEMENTS"
                :key="enforcement"
                :value="enforcement"
              >
                {{ t(`repository.settings.automation.rules.enforcement.${enforcement}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            :aria-label="t('repository.settings.automation.rules.remove')"
            :disabled="pending.has(ruleset.id)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="remove(ruleset.id)"
          >
            <Trash2
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </Button>
        </div>
      </div>
    </div>

    <p
      v-else
      class="text-body text-muted-foreground"
    >
      {{ t('repository.settings.automation.rules.empty') }}
    </p>
  </div>
</template>
