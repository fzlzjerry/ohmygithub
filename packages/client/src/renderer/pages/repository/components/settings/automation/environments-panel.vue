<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  Switch,
} from '@oh-my-github/ui'
import {
  createEnvironmentBranchPolicy,
  deleteEnvironmentBranchPolicy,
  deleteRepositoryEnvironment,
  upsertRepositoryEnvironment,
  useEnvironmentSettingsQuery,
  useRepositorySettingsInvalidation,
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
const query = useEnvironmentSettingsQuery(() => props.owner, () => props.repo, hasIdentity)
const environments = computed(() => query.data.value ?? [])
const isLoading = computed(() => query.isLoading.value)

const pending = ref(new Set<string>())
const isDialogOpen = ref(false)
const editingName = ref<string | null>(null)
const editingReviewers = ref<Array<{ type: 'User' | 'Team'; id: number }>>([])
const formName = ref('')
const formWaitTimer = ref('0')
const formPreventSelfReview = ref(false)
const formBranchPolicy = ref<'all' | 'protected' | 'custom'>('all')
const formCustomPolicies = ref<GitHubEnvironmentBranchPolicyItem[]>([])
const newPolicyName = ref('')
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

function refresh(): void {
  invalidateAutomation('environments', props.owner, props.repo)
}

function openCreate(): void {
  editingName.value = null
  editingReviewers.value = []
  formName.value = ''
  formWaitTimer.value = '0'
  formPreventSelfReview.value = false
  formBranchPolicy.value = 'all'
  formCustomPolicies.value = []
  errorMessage.value = null
  isDialogOpen.value = true
}

function openEdit(environment: GitHubEnvironmentSettings): void {
  editingName.value = environment.name
  editingReviewers.value = environment.reviewers.map((reviewer) => ({ type: reviewer.type, id: reviewer.id }))
  formName.value = environment.name
  formWaitTimer.value = String(environment.waitTimer)
  formPreventSelfReview.value = environment.preventSelfReview
  formBranchPolicy.value = environment.branchPolicy
  formCustomPolicies.value = [...environment.customPolicies]
  errorMessage.value = null
  isDialogOpen.value = true
}

async function submit(): Promise<void> {
  const name = formName.value.trim()
  const waitTimer = Number(formWaitTimer.value)
  if (!name || isSubmitting.value) return
  if (!Number.isInteger(waitTimer) || waitTimer < 0 || waitTimer > 43200) {
    errorMessage.value = t('repository.settings.automation.environments.waitTimerInvalid')
    return
  }

  isSubmitting.value = true
  errorMessage.value = null

  try {
    await upsertRepositoryEnvironment(props.owner, props.repo, name, {
      waitTimer,
      preventSelfReview: formPreventSelfReview.value,
      reviewers: editingReviewers.value,
      branchPolicy: formBranchPolicy.value,
    })
    isDialogOpen.value = false
    refresh()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('repository.settings.automation.error')
  } finally {
    isSubmitting.value = false
  }
}

async function addPolicy(): Promise<void> {
  const name = editingName.value
  const pattern = newPolicyName.value.trim()
  if (!name || !pattern || isSubmitting.value) return
  isSubmitting.value = true

  try {
    await createEnvironmentBranchPolicy(props.owner, props.repo, name, pattern, 'branch')
    newPolicyName.value = ''
    refresh()
    isDialogOpen.value = false
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('repository.settings.automation.error')
  } finally {
    isSubmitting.value = false
  }
}

async function removePolicy(policyId: number): Promise<void> {
  const name = editingName.value
  if (!name || isSubmitting.value) return
  isSubmitting.value = true

  try {
    await deleteEnvironmentBranchPolicy(props.owner, props.repo, name, policyId)
    formCustomPolicies.value = formCustomPolicies.value.filter((policy) => policy.id !== policyId)
    refresh()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('repository.settings.automation.error')
  } finally {
    isSubmitting.value = false
  }
}

async function remove(name: string): Promise<void> {
  if (pending.value.has(name)) return
  pending.value = new Set([...pending.value, name])

  try {
    await deleteRepositoryEnvironment(props.owner, props.repo, name)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.automation.error'))
  } finally {
    const next = new Set(pending.value)
    next.delete(name)
    pending.value = next
    refresh()
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <p class="text-caption text-muted-foreground">
        {{ t('repository.settings.automation.environments.hint') }}
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
        {{ t('repository.settings.automation.environments.add') }}
      </Button>
    </div>

    <div
      v-if="isLoading"
      class="flex min-h-[8rem] items-center justify-center"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <div
      v-else-if="environments.length > 0"
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        v-for="(environment, index) in environments"
        :key="environment.name"
        :class="[
          'flex items-center justify-between gap-4 px-4 py-2.5',
          index > 0 ? 'border-t border-border' : '',
        ]"
      >
        <div class="grid min-w-0 gap-0.5">
          <span class="truncate text-body font-medium text-foreground">{{ environment.name }}</span>
          <span class="truncate text-caption text-muted-foreground">
            {{ t('repository.settings.automation.environments.summary', {
              reviewers: environment.reviewers.length,
              wait: environment.waitTimer,
              policy: t(`repository.settings.automation.environments.policy.${environment.branchPolicy}`),
            }) }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            :aria-label="t('repository.settings.automation.environments.edit')"
            :disabled="pending.has(environment.name)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="openEdit(environment)"
          >
            <Pencil
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </Button>
          <Button
            :aria-label="t('repository.settings.automation.environments.remove')"
            :disabled="pending.has(environment.name)"
            size="icon-sm"
            type="button"
            variant="outline"
            @click="remove(environment.name)"
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
      {{ t('repository.settings.automation.environments.empty') }}
    </p>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ t(editingName === null
              ? 'repository.settings.automation.environments.createTitle'
              : 'repository.settings.automation.environments.editTitle') }}
          </DialogTitle>
        </DialogHeader>

        <div class="grid gap-3">
          <div class="grid gap-1.5">
            <Label for="environment-name">{{ t('repository.settings.automation.environments.name') }}</Label>
            <Input
              id="environment-name"
              v-model="formName"
              autocomplete="off"
              :disabled="editingName !== null"
              spellcheck="false"
            />
          </div>

          <div class="grid gap-1.5">
            <Label for="environment-wait">{{ t('repository.settings.automation.environments.waitTimer') }}</Label>
            <Input
              id="environment-wait"
              v-model="formWaitTimer"
              class="w-28"
              inputmode="numeric"
            />
          </div>

          <div class="flex items-center justify-between gap-6">
            <span class="text-body text-foreground">
              {{ t('repository.settings.automation.environments.preventSelfReview') }}
            </span>
            <Switch v-model="formPreventSelfReview" />
          </div>

          <p
            v-if="editingReviewers.length > 0"
            class="text-caption text-muted-foreground"
          >
            {{ t('repository.settings.automation.environments.reviewersKept', { count: editingReviewers.length }) }}
          </p>

          <div class="grid gap-1.5">
            <Label>{{ t('repository.settings.automation.environments.branchPolicyLabel') }}</Label>
            <RadioGroup v-model="formBranchPolicy">
              <label
                v-for="policy in (['all', 'protected', 'custom'] as const)"
                :key="policy"
                class="flex items-center gap-2"
              >
                <RadioGroupItem :value="policy" />
                <span class="text-body text-foreground">
                  {{ t(`repository.settings.automation.environments.policy.${policy}`) }}
                </span>
              </label>
            </RadioGroup>
          </div>

          <div
            v-if="formBranchPolicy === 'custom' && editingName !== null"
            class="grid gap-2"
          >
            <div
              v-for="policy in formCustomPolicies"
              :key="policy.id"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-body text-foreground">{{ policy.name }} ({{ policy.type }})</span>
              <Button
                :disabled="isSubmitting"
                size="icon-sm"
                type="button"
                variant="outline"
                @click="removePolicy(policy.id)"
              >
                <Trash2
                  class="size-3.5 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </Button>
            </div>
            <div class="flex items-center gap-2">
              <Input
                v-model="newPolicyName"
                class="flex-1"
                :placeholder="t('repository.settings.automation.environments.policyPlaceholder')"
                spellcheck="false"
              />
              <Button
                :disabled="isSubmitting || !newPolicyName.trim()"
                size="sm"
                type="button"
                variant="outline"
                @click="addPolicy"
              >
                {{ t('repository.settings.automation.environments.addPolicy') }}
              </Button>
            </div>
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
            :disabled="isSubmitting || !formName.trim()"
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
