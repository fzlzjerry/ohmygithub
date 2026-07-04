<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound, Trash2 } from 'lucide-vue-next'
import { Button, Input, Spinner, Switch, Textarea } from '@oh-my-github/ui'
import {
  addDeployKey,
  deleteDeployKey,
  useDeployKeysQuery,
  useRepositorySettingsInvalidation,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateSecurity } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))
const query = useDeployKeysQuery(() => props.owner, () => props.repo, hasIdentity)
const keys = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const newTitle = ref('')
const newKey = ref('')
const newReadOnly = ref(true)
const isAdding = ref(false)
const pending = ref(new Set<number>())

function refresh(): void {
  invalidateSecurity('deploy-keys', props.owner, props.repo)
}

async function add(): Promise<void> {
  const title = newTitle.value.trim()
  const key = newKey.value.trim()
  if (!title || !key || isAdding.value) return
  isAdding.value = true

  try {
    await addDeployKey(props.owner, props.repo, title, key, newReadOnly.value)
    newTitle.value = ''
    newKey.value = ''
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.security.error'))
  } finally {
    isAdding.value = false
    refresh()
  }
}

async function remove(keyId: number): Promise<void> {
  if (pending.value.has(keyId)) return
  pending.value = new Set([...pending.value, keyId])

  try {
    await deleteDeployKey(props.owner, props.repo, keyId)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.security.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(keyId)
    pending.value = next
    refresh()
  }
}
</script>

<template>
  <div class="grid gap-4">
    <form
      class="grid max-w-xl gap-2"
      @submit.prevent="add"
    >
      <Input
        v-model="newTitle"
        autocomplete="off"
        :placeholder="t('repository.settings.security.deployKeys.titlePlaceholder')"
        spellcheck="false"
      />
      <Textarea
        v-model="newKey"
        :placeholder="t('repository.settings.security.deployKeys.keyPlaceholder')"
        rows="3"
        spellcheck="false"
      />
      <div class="flex items-center justify-between gap-4">
        <label class="flex items-center gap-2 text-body text-foreground">
          <Switch v-model="newReadOnly" />
          {{ t('repository.settings.security.deployKeys.readOnly') }}
        </label>
        <Button
          :disabled="isAdding || !newTitle.trim() || !newKey.trim()"
          size="sm"
          type="submit"
        >
          <Spinner
            v-if="isAdding"
            class="size-3.5"
          />
          <KeyRound
            v-else
            class="size-3.5"
            :stroke-width="1.75"
          />
          {{ t('repository.settings.security.deployKeys.add') }}
        </Button>
      </div>
    </form>

    <div
      v-if="isLoading"
      class="flex min-h-[6rem] items-center justify-center"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <div
      v-else-if="keys.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(key, index) in keys"
        :key="key.id"
        :class="[
          'flex items-center justify-between gap-4 px-4 py-2.5',
          index > 0 ? 'border-t border-border' : '',
        ]"
      >
        <div class="grid min-w-0 gap-0.5">
          <span class="truncate text-body font-medium text-foreground">{{ key.title }}</span>
          <span class="truncate font-mono text-caption text-muted-foreground">
            {{ key.key.slice(0, 40) }}… · {{ t(key.readOnly
              ? 'repository.settings.security.deployKeys.readOnlyBadge'
              : 'repository.settings.security.deployKeys.readWriteBadge') }}
          </span>
        </div>
        <Button
          :aria-label="t('repository.settings.security.deployKeys.remove')"
          :disabled="pending.has(key.id)"
          size="icon-sm"
          type="button"
          variant="outline"
          @click="remove(key.id)"
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
      {{ t('repository.settings.security.deployKeys.empty') }}
    </p>
  </div>
</template>
