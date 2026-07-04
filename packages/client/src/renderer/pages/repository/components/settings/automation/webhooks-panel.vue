<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Plus, Radio, Trash2 } from 'lucide-vue-next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@oh-my-github/ui'
import {
  createRepositoryWebhook,
  deleteRepositoryWebhook,
  pingRepositoryWebhook,
  updateRepositoryWebhook,
  useRepositorySettingsInvalidation,
  useWebhooksQuery,
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
const query = useWebhooksQuery(() => props.owner, () => props.repo, hasIdentity)
const webhooks = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const pending = ref(new Set<number>())
const isDialogOpen = ref(false)
const editingId = ref<number | null>(null)
const formUrl = ref('')
const formContentType = ref<'json' | 'form'>('json')
const formSecret = ref('')
const formInsecureSsl = ref(false)
const formEvents = ref<string[]>(['push'])
const formActive = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

watch(isDialogOpen, (open) => {
  if (!open) {
    editingId.value = null
    errorMessage.value = null
  }
})

function refresh(): void {
  invalidateAutomation('webhooks', props.owner, props.repo)
}

function openCreate(): void {
  editingId.value = null
  formUrl.value = ''
  formContentType.value = 'json'
  formSecret.value = ''
  formInsecureSsl.value = false
  formEvents.value = ['push']
  formActive.value = true
  errorMessage.value = null
  isDialogOpen.value = true
}

function openEdit(webhook: GitHubRepositoryWebhook): void {
  editingId.value = webhook.id
  formUrl.value = webhook.url
  formContentType.value = webhook.contentType === 'form' ? 'form' : 'json'
  formSecret.value = ''
  formInsecureSsl.value = webhook.insecureSsl
  formEvents.value = [...webhook.events]
  formActive.value = webhook.active
  errorMessage.value = null
  isDialogOpen.value = true
}

async function submit(): Promise<void> {
  const url = formUrl.value.trim()
  if (!url || formEvents.value.length === 0 || isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = null

  const input: UpsertRepositoryWebhookInput = {
    url,
    contentType: formContentType.value,
    insecureSsl: formInsecureSsl.value,
    events: formEvents.value,
    active: formActive.value,
    ...(formSecret.value.trim() ? { secret: formSecret.value.trim() } : {}),
  }

  try {
    if (editingId.value === null) {
      await createRepositoryWebhook(props.owner, props.repo, input)
    } else {
      await updateRepositoryWebhook(props.owner, props.repo, editingId.value, input)
    }
    isDialogOpen.value = false
    refresh()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('repository.settings.automation.error')
  } finally {
    isSubmitting.value = false
  }
}

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
    refresh()
  }
}

function remove(id: number): void {
  void run(id, () => deleteRepositoryWebhook(props.owner, props.repo, id))
}

function ping(id: number): void {
  void run(id, async () => {
    await pingRepositoryWebhook(props.owner, props.repo, id)
    toast.success(t('repository.settings.automation.webhooks.pinged'))
  })
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <p class="text-caption text-muted-foreground">
        {{ t('repository.settings.automation.webhooks.hint') }}
      </p>
      <Button
        size="sm"
        type="button"
        @click="openCreate"
      >
        <Plus
          class="size-3.5"
          :stroke-width="1.75"
        />
        {{ t('repository.settings.automation.webhooks.add') }}
      </Button>
    </div>

    <div
      v-if="isLoading"
      class="flex min-h-[8rem] items-center justify-center"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <div
      v-else-if="webhooks.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(webhook, index) in webhooks"
        :key="webhook.id"
        :class="[
          'flex items-center justify-between gap-4 px-4 py-2.5',
          index > 0 ? 'border-t border-border' : '',
        ]"
      >
        <div class="grid min-w-0 gap-0.5">
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="webhook.active ? 'bg-success' : 'bg-muted-foreground/50'"
            />
            <span class="truncate text-body font-medium text-foreground">{{ webhook.url }}</span>
          </div>
          <span class="truncate text-caption text-muted-foreground">
            {{ webhook.events.join(', ') }}
            <template v-if="webhook.lastResponseStatus"> · {{ webhook.lastResponseStatus }}</template>
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            :aria-label="t('repository.settings.automation.webhooks.ping')"
            :disabled="pending.has(webhook.id)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="ping(webhook.id)"
          >
            <Radio
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </Button>
          <Button
            :aria-label="t('repository.settings.automation.webhooks.edit')"
            :disabled="pending.has(webhook.id)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="openEdit(webhook)"
          >
            <Pencil
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </Button>
          <Button
            :aria-label="t('repository.settings.automation.webhooks.remove')"
            :disabled="pending.has(webhook.id)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="remove(webhook.id)"
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
      {{ t('repository.settings.automation.webhooks.empty') }}
    </p>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ t(editingId === null
              ? 'repository.settings.automation.webhooks.createTitle'
              : 'repository.settings.automation.webhooks.editTitle') }}
          </DialogTitle>
        </DialogHeader>

        <div class="grid gap-3">
          <div class="grid gap-1.5">
            <Label for="webhook-url">{{ t('repository.settings.automation.webhooks.url') }}</Label>
            <Input
              id="webhook-url"
              v-model="formUrl"
              autocomplete="off"
              placeholder="https://"
              spellcheck="false"
              type="url"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1.5">
              <Label>{{ t('repository.settings.automation.webhooks.contentType') }}</Label>
              <Select v-model="formContentType">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">application/json</SelectItem>
                  <SelectItem value="form">application/x-www-form-urlencoded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="grid gap-1.5">
              <Label for="webhook-secret">{{ t('repository.settings.automation.webhooks.secret') }}</Label>
              <Input
                id="webhook-secret"
                v-model="formSecret"
                autocomplete="off"
                :placeholder="editingId === null ? '' : '••••••••'"
                spellcheck="false"
                type="password"
              />
            </div>
          </div>

          <div class="grid gap-1.5">
            <Label>{{ t('repository.settings.automation.webhooks.events') }}</Label>
            <TagsInput v-model="formEvents">
              <TagsInputItem
                v-for="event in formEvents"
                :key="event"
                :value="event"
              >
                <TagsInputItemText />
                <TagsInputItemDelete />
              </TagsInputItem>
              <TagsInputInput :placeholder="t('repository.settings.automation.webhooks.eventsPlaceholder')" />
            </TagsInput>
          </div>

          <div class="flex items-center justify-between gap-6">
            <span class="text-body text-foreground">{{ t('repository.settings.automation.webhooks.sslVerification') }}</span>
            <Switch
              :model-value="!formInsecureSsl"
              @update:model-value="formInsecureSsl = $event !== true"
            />
          </div>

          <div class="flex items-center justify-between gap-6">
            <span class="text-body text-foreground">{{ t('repository.settings.automation.webhooks.active') }}</span>
            <Switch v-model="formActive" />
          </div>
        </div>

        <p
          v-if="errorMessage"
          class="text-body text-destructive"
        >
          {{ errorMessage }}
        </p>

        <DialogFooter>
          <Button
            :disabled="isSubmitting"
            size="sm"
            type="button"
            variant="outline"
            @click="isDialogOpen = false"
          >
            {{ t('repository.settings.general.dangerZone.cancel') }}
          </Button>
          <Button
            :disabled="isSubmitting || !formUrl.trim() || formEvents.length === 0"
            size="sm"
            type="button"
            @click="submit"
          >
            <Spinner
              v-if="isSubmitting"
              class="size-3.5"
            />
            {{ t('repository.settings.automation.save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
