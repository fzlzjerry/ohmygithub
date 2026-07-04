<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import {
  Button,
  Input,
  SegmentedControl,
  Spinner,
} from '@oh-my-github/ui'
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

const SCOPES: readonly GitHubRepositorySecretScope[] = ['actions', 'codespaces', 'dependabot']

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { invalidateSecrets, invalidateSecurity } = useRepositorySettingsInvalidation()

const hasIdentity = computed(() => Boolean(props.owner && props.repo))
const scope = ref<GitHubRepositorySecretScope>('actions')
const scopeItems = computed(() => SCOPES.map((item) => ({
  value: item,
  label: t(`repository.settings.security.secrets.scopes.${item}`),
})))

const secretsQuery = useRepositorySecretsQuery(() => props.owner, () => props.repo, scope, hasIdentity)
const secrets = computed(() => secretsQuery.data.value ?? [])
const isLoadingSecrets = computed(() => secretsQuery.isLoading.value)

const showVariables = computed(() => scope.value === 'actions')
const variablesQuery = useRepositoryVariablesQuery(() => props.owner, () => props.repo, showVariables)
const variables = computed(() => variablesQuery.data.value ?? [])

const secretName = ref('')
const secretValue = ref('')
const isSavingSecret = ref(false)
const variableName = ref('')
const variableValue = ref('')
const editingVariable = ref<string | null>(null)
const isSavingVariable = ref(false)
const pending = ref(new Set<string>())

function updateScope(value: unknown): void {
  if (value === 'actions' || value === 'codespaces' || value === 'dependabot') {
    scope.value = value
  }
}

async function saveSecret(): Promise<void> {
  const name = secretName.value.trim().toUpperCase()
  if (!name || !secretValue.value || isSavingSecret.value) return
  isSavingSecret.value = true

  try {
    await upsertRepositorySecret(props.owner, props.repo, scope.value, name, secretValue.value)
    secretName.value = ''
    secretValue.value = ''
    toast.success(t('repository.settings.security.secrets.saved', { name }))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.security.error'))
  } finally {
    isSavingSecret.value = false
    invalidateSecrets(scope.value, props.owner, props.repo)
  }
}

function editSecret(name: string): void {
  secretName.value = name
  secretValue.value = ''
}

async function removeSecret(name: string): Promise<void> {
  const key = `secret:${name}`
  if (pending.value.has(key)) return
  pending.value = new Set([...pending.value, key])

  try {
    await deleteRepositorySecret(props.owner, props.repo, scope.value, name)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.security.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(key)
    pending.value = next
    invalidateSecrets(scope.value, props.owner, props.repo)
  }
}

async function saveVariable(): Promise<void> {
  const name = variableName.value.trim().toUpperCase()
  if (!name || isSavingVariable.value) return
  isSavingVariable.value = true

  try {
    if (editingVariable.value) {
      await updateRepositoryVariable(props.owner, props.repo, editingVariable.value, variableValue.value)
    } else {
      await createRepositoryVariable(props.owner, props.repo, name, variableValue.value)
    }
    variableName.value = ''
    variableValue.value = ''
    editingVariable.value = null
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.security.error'))
  } finally {
    isSavingVariable.value = false
    invalidateSecurity('variables', props.owner, props.repo)
  }
}

function editVariable(variable: GitHubRepositoryVariable): void {
  editingVariable.value = variable.name
  variableName.value = variable.name
  variableValue.value = variable.value
}

async function removeVariable(name: string): Promise<void> {
  const key = `variable:${name}`
  if (pending.value.has(key)) return
  pending.value = new Set([...pending.value, key])

  try {
    await deleteRepositoryVariable(props.owner, props.repo, name)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.security.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(key)
    pending.value = next
    invalidateSecurity('variables', props.owner, props.repo)
  }
}
</script>

<template>
  <div class="grid gap-4">
    <SegmentedControl
      :aria-label="t('repository.settings.security.secrets.scopesLabel')"
      class="justify-self-start"
      :items="scopeItems"
      :model-value="scope"
      @update:model-value="updateScope"
    />

    <form
      class="flex max-w-xl items-center gap-2"
      @submit.prevent="saveSecret"
    >
      <Input
        v-model="secretName"
        autocomplete="off"
        class="w-48 font-mono uppercase"
        :placeholder="t('repository.settings.security.secrets.namePlaceholder')"
        spellcheck="false"
      />
      <Input
        v-model="secretValue"
        autocomplete="off"
        class="flex-1"
        :placeholder="t('repository.settings.security.secrets.valuePlaceholder')"
        spellcheck="false"
        type="password"
      />
      <Button
        :disabled="isSavingSecret || !secretName.trim() || !secretValue"
        size="sm"
        type="submit"
      >
        <Spinner
          v-if="isSavingSecret"
          class="size-3.5"
        />
        <Plus
          v-else
          class="size-3.5"
          :stroke-width="1.75"
        />
        {{ t('repository.settings.security.secrets.save') }}
      </Button>
    </form>

    <div
      v-if="isLoadingSecrets"
      class="flex min-h-[6rem] items-center justify-center"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <div
      v-else-if="secrets.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(secret, index) in secrets"
        :key="secret.name"
        :class="[
          'flex items-center justify-between gap-4 px-4 py-2.5',
          index > 0 ? 'border-t border-border' : '',
        ]"
      >
        <div class="grid min-w-0 gap-0.5">
          <span class="truncate font-mono text-body font-medium text-foreground">{{ secret.name }}</span>
          <span
            v-if="secret.updatedAt"
            class="text-caption text-muted-foreground"
          >
            {{ t('repository.settings.security.secrets.updated', { date: new Date(secret.updatedAt).toLocaleDateString() }) }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            :aria-label="t('repository.settings.security.secrets.update')"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="editSecret(secret.name)"
          >
            <Pencil
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </Button>
          <Button
            :aria-label="t('repository.settings.security.secrets.remove')"
            :disabled="pending.has(`secret:${secret.name}`)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="removeSecret(secret.name)"
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
      {{ t('repository.settings.security.secrets.empty') }}
    </p>

    <template v-if="showVariables">
      <h3 class="mt-2 text-control font-medium text-foreground">
        {{ t('repository.settings.security.secrets.variablesTitle') }}
      </h3>

      <form
        class="flex max-w-xl items-center gap-2"
        @submit.prevent="saveVariable"
      >
        <Input
          v-model="variableName"
          autocomplete="off"
          class="w-48 font-mono uppercase"
          :disabled="editingVariable !== null"
          :placeholder="t('repository.settings.security.secrets.namePlaceholder')"
          spellcheck="false"
        />
        <Input
          v-model="variableValue"
          autocomplete="off"
          class="flex-1"
          :placeholder="t('repository.settings.security.secrets.variableValuePlaceholder')"
          spellcheck="false"
        />
        <Button
          :disabled="isSavingVariable || !variableName.trim()"
          size="sm"
          type="submit"
        >
          <Spinner
            v-if="isSavingVariable"
            class="size-3.5"
          />
          {{ t(editingVariable ? 'repository.settings.security.secrets.updateVariable' : 'repository.settings.security.secrets.addVariable') }}
        </Button>
      </form>

      <div
        v-if="variables.length > 0"
        class="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div
          v-for="(variable, index) in variables"
          :key="variable.name"
          :class="[
            'flex items-center justify-between gap-4 px-4 py-2.5',
            index > 0 ? 'border-t border-border' : '',
          ]"
        >
          <div class="grid min-w-0 gap-0.5">
            <span class="truncate font-mono text-body font-medium text-foreground">{{ variable.name }}</span>
            <span class="truncate font-mono text-caption text-muted-foreground">{{ variable.value }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Button
              :aria-label="t('repository.settings.security.secrets.updateVariable')"
              size="icon-sm"
              type="button"
              variant="outline"
              @click="editVariable(variable)"
            >
              <Pencil
                class="size-3.5 text-muted-foreground"
                :stroke-width="1.75"
              />
            </Button>
            <Button
              :aria-label="t('repository.settings.security.secrets.removeVariable')"
              :disabled="pending.has(`variable:${variable.name}`)"
              size="icon-sm"
              type="button"
              variant="outline"
              @click="removeVariable(variable.name)"
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
        {{ t('repository.settings.security.secrets.variablesEmpty') }}
      </p>
    </template>
  </div>
</template>
