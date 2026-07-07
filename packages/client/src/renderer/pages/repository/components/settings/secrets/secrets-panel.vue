<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-vue-next'
import { Button, Input, Spinner } from '@oh-my-github/ui'
import SettingsSection from '@/pages/settings/components/appearance-settings/settings-section.vue'
import {
  createRepositoryVariable,
  deleteRepositorySecret,
  deleteRepositoryVariable,
  updateRepositoryVariable,
  upsertRepositorySecret,
  useRepositorySecretsQuery,
  useRepositorySettingsInvalidation,
  useRepositoryVariablesQuery,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'
import EnvDraftRows from './env-draft-rows.vue'
import { createEnvDraft, type EnvDraft } from './env-drafts'
import type { EnvEntry } from './parse-env-entries'

const props = defineProps<{
  owner: string
  repo: string
  scope: GitHubRepositorySecretScope
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateSecrets, invalidateSecurity } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))

const secretsQuery = useRepositorySecretsQuery(() => props.owner, () => props.repo, () => props.scope, hasIdentity)
const secrets = computed(() => secretsQuery.data.value ?? [])
const isLoadingSecrets = computed(() => secretsQuery.isLoading.value)

const showVariables = computed(() => props.scope === 'actions')
const variablesQuery = useRepositoryVariablesQuery(() => props.owner, () => props.repo, showVariables)
const variables = computed(() => variablesQuery.data.value ?? [])

const secretDrafts = ref<EnvDraft[]>([])
const variableDrafts = ref<EnvDraft[]>([])
const isSavingSecretDrafts = ref(false)
const isSavingVariableDrafts = ref(false)

const editingSecretName = ref<string | null>(null)
const editingSecretValue = ref('')
const editingSecretError = ref<string | null>(null)
const isSavingSecretEdit = ref(false)

const editingVariableName = ref<string | null>(null)
const editingVariableValue = ref('')
const editingVariableError = ref<string | null>(null)
const isSavingVariableEdit = ref(false)

const pending = ref(new Set<string>())

watch(() => props.scope, () => {
  secretDrafts.value = []
  variableDrafts.value = []
  cancelEditSecret()
  cancelEditVariable()
})

function addSecretDraft(): void {
  secretDrafts.value.push(createEnvDraft())
}

function addVariableDraft(): void {
  variableDrafts.value.push(createEnvDraft())
}

function setDraftName(drafts: EnvDraft[], id: number, name: string): void {
  const draft = drafts.find((item) => item.id === id)
  if (!draft) return
  draft.name = name
  draft.error = null
}

function setDraftValue(drafts: EnvDraft[], id: number, value: string): void {
  const draft = drafts.find((item) => item.id === id)
  if (!draft) return
  draft.value = value
  draft.error = null
}

function removeDraft(drafts: EnvDraft[], id: number): void {
  const index = drafts.findIndex((draft) => draft.id === id)
  if (index !== -1) drafts.splice(index, 1)
}

function insertEntries(drafts: EnvDraft[], id: number, entries: EnvEntry[]): void {
  const index = drafts.findIndex((draft) => draft.id === id)
  if (index === -1 || entries.length === 0) return

  const [first, ...rest] = entries
  const target = drafts[index]
  target.name = first.name
  target.value = first.value
  target.error = null
  drafts.splice(index + 1, 0, ...rest.map((entry) => createEnvDraft(entry)))
}

async function saveSecretDrafts(): Promise<void> {
  if (isSavingSecretDrafts.value) return
  isSavingSecretDrafts.value = true
  let savedCount = 0
  let lastSavedName = ''

  try {
    for (const draft of [...secretDrafts.value]) {
      const name = draft.name.trim().toUpperCase()
      if (!name) {
        draft.error = t('repository.settings.secrets.draftNeedsName')
        continue
      }
      if (!draft.value) {
        draft.error = t('repository.settings.secrets.draftNeedsValue')
        continue
      }

      try {
        await upsertRepositorySecret(props.owner, props.repo, props.scope, name, draft.value)
        savedCount += 1
        lastSavedName = name
        removeDraft(secretDrafts.value, draft.id)
      } catch (error) {
        draft.error = error instanceof Error ? error.message : t('repository.settings.secrets.error')
      }
    }
  } finally {
    isSavingSecretDrafts.value = false
    if (savedCount > 0) {
      invalidateSecrets(props.scope, props.owner, props.repo)
      toast.success(savedCount === 1
        ? t('repository.settings.secrets.saved', { name: lastSavedName })
        : t('repository.settings.secrets.savedMany', { count: savedCount }))
    }
  }
}

async function saveVariableDrafts(): Promise<void> {
  if (isSavingVariableDrafts.value) return
  isSavingVariableDrafts.value = true
  const existingNames = new Set(variables.value.map((variable) => variable.name.toUpperCase()))
  let savedCount = 0

  try {
    for (const draft of [...variableDrafts.value]) {
      const name = draft.name.trim().toUpperCase()
      if (!name) {
        draft.error = t('repository.settings.secrets.draftNeedsName')
        continue
      }

      try {
        if (existingNames.has(name)) {
          await updateRepositoryVariable(props.owner, props.repo, name, draft.value)
        } else {
          await createRepositoryVariable(props.owner, props.repo, name, draft.value)
          existingNames.add(name)
        }
        savedCount += 1
        removeDraft(variableDrafts.value, draft.id)
      } catch (error) {
        draft.error = error instanceof Error ? error.message : t('repository.settings.secrets.error')
      }
    }
  } finally {
    isSavingVariableDrafts.value = false
    if (savedCount > 0) {
      invalidateSecurity('variables', props.owner, props.repo)
    }
  }
}

function startEditSecret(name: string): void {
  editingSecretName.value = name
  editingSecretValue.value = ''
  editingSecretError.value = null
}

function cancelEditSecret(): void {
  editingSecretName.value = null
  editingSecretValue.value = ''
  editingSecretError.value = null
}

async function saveSecretEdit(): Promise<void> {
  const name = editingSecretName.value
  if (!name || !editingSecretValue.value || isSavingSecretEdit.value) return
  isSavingSecretEdit.value = true
  editingSecretError.value = null

  try {
    await upsertRepositorySecret(props.owner, props.repo, props.scope, name, editingSecretValue.value)
    toast.success(t('repository.settings.secrets.saved', { name }))
    cancelEditSecret()
    invalidateSecrets(props.scope, props.owner, props.repo)
  } catch (error) {
    editingSecretError.value = error instanceof Error ? error.message : t('repository.settings.secrets.error')
  } finally {
    isSavingSecretEdit.value = false
  }
}

async function removeSecret(name: string): Promise<void> {
  const key = `secret:${name}`
  if (pending.value.has(key)) return
  pending.value = new Set([...pending.value, key])

  try {
    await deleteRepositorySecret(props.owner, props.repo, props.scope, name)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.secrets.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(key)
    pending.value = next
    invalidateSecrets(props.scope, props.owner, props.repo)
  }
}

function startEditVariable(variable: GitHubRepositoryVariable): void {
  editingVariableName.value = variable.name
  editingVariableValue.value = variable.value
  editingVariableError.value = null
}

function cancelEditVariable(): void {
  editingVariableName.value = null
  editingVariableValue.value = ''
  editingVariableError.value = null
}

async function saveVariableEdit(): Promise<void> {
  const name = editingVariableName.value
  if (!name || isSavingVariableEdit.value) return
  isSavingVariableEdit.value = true
  editingVariableError.value = null

  try {
    await updateRepositoryVariable(props.owner, props.repo, name, editingVariableValue.value)
    cancelEditVariable()
    invalidateSecurity('variables', props.owner, props.repo)
  } catch (error) {
    editingVariableError.value = error instanceof Error ? error.message : t('repository.settings.secrets.error')
  } finally {
    isSavingVariableEdit.value = false
  }
}

async function removeVariable(name: string): Promise<void> {
  const key = `variable:${name}`
  if (pending.value.has(key)) return
  pending.value = new Set([...pending.value, key])

  try {
    await deleteRepositoryVariable(props.owner, props.repo, name)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.secrets.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(key)
    pending.value = next
    invalidateSecurity('variables', props.owner, props.repo)
  }
}
</script>

<template>
  <div class="space-y-8">
    <p class="px-2 text-caption text-muted-foreground">
      {{ t('repository.settings.secrets.envHint') }}
    </p>

    <SettingsSection :title="t('repository.settings.secrets.secretsTitle')">
      <template #actions>
        <div class="flex items-center gap-2">
          <template v-if="secretDrafts.length > 0">
            <Button
              :aria-label="t('repository.settings.secrets.addSecret')"
              size="icon-sm"
              type="button"
              variant="ghost"
              @click="addSecretDraft"
            >
              <Plus class="size-4" />
            </Button>
            <Button
              :disabled="isSavingSecretDrafts"
              size="sm"
              type="button"
              @click="saveSecretDrafts"
            >
              <Spinner
                v-if="isSavingSecretDrafts"
                class="size-3.5"
              />
              {{ t('repository.settings.secrets.saveAll') }}
            </Button>
          </template>
          <Button
            v-else
            size="sm"
            type="button"
            variant="outline"
            @click="addSecretDraft"
          >
            <Plus class="size-4" />
            {{ t('repository.settings.secrets.addSecret') }}
          </Button>
        </div>
      </template>

      <div
        v-if="isLoadingSecrets"
        class="flex min-h-[6rem] items-center justify-center"
      >
        <Spinner class="size-4 text-muted-foreground" />
      </div>

      <div
        v-else
        class="divide-y divide-border"
      >
        <EnvDraftRows
          :drafts="secretDrafts"
          mask-values
          :name-placeholder="t('repository.settings.secrets.namePlaceholder')"
          :remove-label="t('repository.settings.secrets.removeDraft')"
          :value-placeholder="t('repository.settings.secrets.valuePlaceholder')"
          @paste-entries="(id, entries) => insertEntries(secretDrafts, id, entries)"
          @remove="(id) => removeDraft(secretDrafts, id)"
          @update:name="(id, name) => setDraftName(secretDrafts, id, name)"
          @update:value="(id, value) => setDraftValue(secretDrafts, id, value)"
        />

        <p
          v-if="secrets.length === 0 && secretDrafts.length === 0"
          class="px-4 py-6 text-center text-body text-muted-foreground"
        >
          {{ t('repository.settings.secrets.empty') }}
        </p>

        <div
          v-for="secret in secrets"
          :key="secret.name"
          class="grid gap-1.5 px-4 py-3"
        >
          <div
            v-if="editingSecretName === secret.name"
            class="flex items-center gap-2"
          >
            <span class="min-w-0 max-w-[50%] truncate font-mono text-control font-medium text-foreground">
              {{ secret.name }}
            </span>
            <Input
              v-model="editingSecretValue"
              autocomplete="off"
              autofocus
              :placeholder="t('repository.settings.secrets.valuePlaceholder')"
              size="sm"
              spellcheck="false"
              type="password"
              @keydown.enter="saveSecretEdit"
              @keydown.esc="cancelEditSecret"
            />
            <Button
              :aria-label="t('repository.settings.secrets.update')"
              :disabled="isSavingSecretEdit || !editingSecretValue"
              size="icon-sm"
              type="button"
              variant="ghost"
              @click="saveSecretEdit"
            >
              <Spinner
                v-if="isSavingSecretEdit"
                class="size-4"
              />
              <Check
                v-else
                class="size-4"
              />
            </Button>
            <Button
              :aria-label="t('repository.settings.general.dangerZone.cancel')"
              :disabled="isSavingSecretEdit"
              size="icon-sm"
              type="button"
              variant="ghost"
              @click="cancelEditSecret"
            >
              <X class="size-4" />
            </Button>
          </div>

          <div
            v-else
            class="flex items-center justify-between gap-4"
          >
            <div class="grid min-w-0 gap-0.5">
              <span class="truncate font-mono text-control font-medium text-foreground">{{ secret.name }}</span>
              <span
                v-if="secret.updatedAt"
                class="text-caption text-muted-foreground"
              >
                {{ t('repository.settings.secrets.updated', { date: new Date(secret.updatedAt).toLocaleDateString() }) }}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                :aria-label="t('repository.settings.secrets.update')"
                size="icon-sm"
                variant="ghost"
                @click="startEditSecret(secret.name)"
              >
                <Pencil class="size-4" />
              </Button>
              <Button
                :aria-label="t('repository.settings.secrets.remove')"
                :disabled="pending.has(`secret:${secret.name}`)"
                size="icon-sm"
                variant="ghost"
                @click="removeSecret(secret.name)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>

          <p
            v-if="editingSecretName === secret.name && editingSecretError"
            class="text-caption text-destructive"
          >
            {{ editingSecretError }}
          </p>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection
      v-if="showVariables"
      :title="t('repository.settings.secrets.variablesTitle')"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <template v-if="variableDrafts.length > 0">
            <Button
              :aria-label="t('repository.settings.secrets.addVariable')"
              size="icon-sm"
              type="button"
              variant="ghost"
              @click="addVariableDraft"
            >
              <Plus class="size-4" />
            </Button>
            <Button
              :disabled="isSavingVariableDrafts"
              size="sm"
              type="button"
              @click="saveVariableDrafts"
            >
              <Spinner
                v-if="isSavingVariableDrafts"
                class="size-3.5"
              />
              {{ t('repository.settings.secrets.saveAll') }}
            </Button>
          </template>
          <Button
            v-else
            size="sm"
            type="button"
            variant="outline"
            @click="addVariableDraft"
          >
            <Plus class="size-4" />
            {{ t('repository.settings.secrets.addVariable') }}
          </Button>
        </div>
      </template>

      <div class="divide-y divide-border">
        <EnvDraftRows
          :drafts="variableDrafts"
          :name-placeholder="t('repository.settings.secrets.namePlaceholder')"
          :remove-label="t('repository.settings.secrets.removeDraft')"
          :value-placeholder="t('repository.settings.secrets.variableValuePlaceholder')"
          @paste-entries="(id, entries) => insertEntries(variableDrafts, id, entries)"
          @remove="(id) => removeDraft(variableDrafts, id)"
          @update:name="(id, name) => setDraftName(variableDrafts, id, name)"
          @update:value="(id, value) => setDraftValue(variableDrafts, id, value)"
        />

        <p
          v-if="variables.length === 0 && variableDrafts.length === 0"
          class="px-4 py-6 text-center text-body text-muted-foreground"
        >
          {{ t('repository.settings.secrets.variablesEmpty') }}
        </p>

        <div
          v-for="variable in variables"
          :key="variable.name"
          class="grid gap-1.5 px-4 py-3"
        >
          <div
            v-if="editingVariableName === variable.name"
            class="flex items-center gap-2"
          >
            <span class="min-w-0 max-w-[50%] truncate font-mono text-control font-medium text-foreground">
              {{ variable.name }}
            </span>
            <Input
              v-model="editingVariableValue"
              autocomplete="off"
              autofocus
              :placeholder="t('repository.settings.secrets.variableValuePlaceholder')"
              size="sm"
              spellcheck="false"
              @keydown.enter="saveVariableEdit"
              @keydown.esc="cancelEditVariable"
            />
            <Button
              :aria-label="t('repository.settings.secrets.updateVariable')"
              :disabled="isSavingVariableEdit"
              size="icon-sm"
              type="button"
              variant="ghost"
              @click="saveVariableEdit"
            >
              <Spinner
                v-if="isSavingVariableEdit"
                class="size-4"
              />
              <Check
                v-else
                class="size-4"
              />
            </Button>
            <Button
              :aria-label="t('repository.settings.general.dangerZone.cancel')"
              :disabled="isSavingVariableEdit"
              size="icon-sm"
              type="button"
              variant="ghost"
              @click="cancelEditVariable"
            >
              <X class="size-4" />
            </Button>
          </div>

          <div
            v-else
            class="flex items-center justify-between gap-4"
          >
            <div class="grid min-w-0 gap-0.5">
              <span class="truncate font-mono text-control font-medium text-foreground">{{ variable.name }}</span>
              <span class="truncate font-mono text-caption text-muted-foreground">{{ variable.value }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                :aria-label="t('repository.settings.secrets.updateVariable')"
                size="icon-sm"
                variant="ghost"
                @click="startEditVariable(variable)"
              >
                <Pencil class="size-4" />
              </Button>
              <Button
                :aria-label="t('repository.settings.secrets.removeVariable')"
                :disabled="pending.has(`variable:${variable.name}`)"
                size="icon-sm"
                variant="ghost"
                @click="removeVariable(variable.name)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>

          <p
            v-if="editingVariableName === variable.name && editingVariableError"
            class="text-caption text-destructive"
          >
            {{ editingVariableError }}
          </p>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>
