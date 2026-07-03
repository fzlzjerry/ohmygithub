<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GitBranchPlus } from 'lucide-vue-next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
} from '@oh-my-github/ui'
import GitHubBranchSelect from '@/components/github/github-branch-select.vue'
import { createBranch } from '@/composables/github/use-repositories'
import { extractIpcErrorMessage } from './ipc-error'

const props = defineProps<{
  open: boolean
  owner: string
  repo: string
  defaultBranch: string | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  created: [name: string]
}>()

const { t } = useI18n()

const name = ref('')
const fromRef = ref<string | null>(null)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const showNameError = ref(false)

const canSubmit = computed(() => Boolean(name.value.trim()) && Boolean(fromRef.value) && !isSubmitting.value)

watch(
  () => props.open,
  (open) => {
    if (!open) return

    name.value = ''
    fromRef.value = props.defaultBranch
    isSubmitting.value = false
    errorMessage.value = null
    showNameError.value = false
  },
)

function setOpen(open: boolean): void {
  if (!open && isSubmitting.value) return
  emit('update:open', open)
}

async function submit(): Promise<void> {
  const branchName = name.value.trim()

  if (!branchName) {
    showNameError.value = true
    return
  }
  if (!fromRef.value || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    await createBranch(props.owner, props.repo, branchName, fromRef.value)
    emit('created', branchName)
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = extractIpcErrorMessage(error) ?? t('repository.branches.dialogs.createBranch.error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="setOpen"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('repository.branches.dialogs.createBranch.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('repository.branches.dialogs.createBranch.description', { repo: `${owner}/${repo}` }) }}
        </DialogDescription>
      </DialogHeader>

      <form
        class="grid gap-4"
        @submit.prevent="submit"
      >
        <div class="grid gap-1.5">
          <Label for="create-branch-name">{{ t('repository.branches.dialogs.createBranch.nameLabel') }}</Label>
          <Input
            id="create-branch-name"
            v-model="name"
            autocomplete="off"
            :disabled="isSubmitting"
            :placeholder="t('repository.branches.dialogs.createBranch.namePlaceholder')"
            spellcheck="false"
            @input="showNameError = false"
          />
          <p
            v-if="showNameError"
            class="text-body text-destructive"
          >
            {{ t('repository.branches.dialogs.createBranch.nameRequired') }}
          </p>
        </div>

        <div class="grid gap-1.5">
          <Label for="create-branch-source">{{ t('repository.branches.dialogs.createBranch.sourceLabel') }}</Label>
          <GitHubBranchSelect
            id="create-branch-source"
            v-model="fromRef"
            :default-branch="defaultBranch"
            :owner="owner"
            :repo="repo"
          />
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
            type="button"
            variant="outline"
            @click="setOpen(false)"
          >
            {{ t('repository.branches.dialogs.cancel') }}
          </Button>
          <Button
            :disabled="!canSubmit"
            type="submit"
          >
            <Spinner
              v-if="isSubmitting"
              class="size-3.5"
            />
            <GitBranchPlus
              v-else
              class="size-3.5"
              :stroke-width="1.75"
            />
            {{ t('repository.branches.dialogs.createBranch.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
