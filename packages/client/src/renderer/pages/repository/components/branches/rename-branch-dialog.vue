<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil } from 'lucide-vue-next'
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
import { renameBranch } from '@/composables/github/use-repositories'
import { extractIpcErrorMessage } from './ipc-error'

const props = defineProps<{
  open: boolean
  owner: string
  repo: string
  branch: GitHubBranchListItem | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  renamed: [newName: string]
}>()

const { t } = useI18n()

const newName = ref('')
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

const canSubmit = computed(() => {
  const value = newName.value.trim()

  return Boolean(value) && value !== props.branch?.name && !isSubmitting.value
})

watch(
  () => props.open,
  (open) => {
    if (!open) return

    newName.value = props.branch?.name ?? ''
    isSubmitting.value = false
    errorMessage.value = null
  },
)

function setOpen(open: boolean): void {
  if (!open && isSubmitting.value) return
  emit('update:open', open)
}

async function submit(): Promise<void> {
  const branch = props.branch
  const value = newName.value.trim()
  if (!branch || !value || value === branch.name || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    await renameBranch(props.owner, props.repo, branch.name, value)
    emit('renamed', value)
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = extractIpcErrorMessage(error) ?? t('repository.branches.dialogs.renameBranch.error')
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
        <DialogTitle>{{ t('repository.branches.dialogs.renameBranch.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('repository.branches.dialogs.renameBranch.description', { name: branch?.name ?? '' }) }}
        </DialogDescription>
      </DialogHeader>

      <form
        class="grid gap-4"
        @submit.prevent="submit"
      >
        <div class="grid gap-1.5">
          <Label for="rename-branch-name">{{ t('repository.branches.dialogs.renameBranch.nameLabel') }}</Label>
          <Input
            id="rename-branch-name"
            v-model="newName"
            autocomplete="off"
            :disabled="isSubmitting"
            spellcheck="false"
          />
          <p class="text-caption text-muted-foreground">
            {{ t('repository.branches.dialogs.renameBranch.hint') }}
          </p>
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
            <Pencil
              v-else
              class="size-3.5"
              :stroke-width="1.75"
            />
            {{ t('repository.branches.dialogs.renameBranch.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
