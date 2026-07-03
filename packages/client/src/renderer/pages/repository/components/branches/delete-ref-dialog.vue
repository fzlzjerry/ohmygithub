<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '@oh-my-github/ui'
import { deleteBranch, deleteTag } from '@/composables/github/use-repositories'
import { extractIpcErrorMessage } from './ipc-error'

export interface DeleteRefTarget {
  kind: 'branch' | 'tag'
  name: string
}

const props = defineProps<{
  open: boolean
  owner: string
  repo: string
  target: DeleteRefTarget | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  deleted: [target: DeleteRefTarget]
}>()

const { t } = useI18n()

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return

    isSubmitting.value = false
    errorMessage.value = null
  },
)

function setOpen(open: boolean): void {
  if (!open && isSubmitting.value) return
  emit('update:open', open)
}

async function confirmDelete(): Promise<void> {
  const target = props.target
  if (!target || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    if (target.kind === 'branch') {
      await deleteBranch(props.owner, props.repo, target.name)
    } else {
      await deleteTag(props.owner, props.repo, target.name)
    }

    emit('deleted', target)
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = extractIpcErrorMessage(error) ?? t('repository.branches.dialogs.deleteRef.error')
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
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>
          {{ t(
            target?.kind === 'tag'
              ? 'repository.branches.dialogs.deleteRef.tagTitle'
              : 'repository.branches.dialogs.deleteRef.branchTitle',
          ) }}
        </DialogTitle>
        <DialogDescription>
          {{ t(
            target?.kind === 'tag'
              ? 'repository.branches.dialogs.deleteRef.tagDescription'
              : 'repository.branches.dialogs.deleteRef.branchDescription',
            { name: target?.name ?? '' },
          ) }}
        </DialogDescription>
      </DialogHeader>

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
          @click="setOpen(false)"
        >
          {{ t('repository.branches.dialogs.cancel') }}
        </Button>
        <Button
          :disabled="isSubmitting"
          size="sm"
          type="button"
          variant="destructive"
          @click="confirmDelete"
        >
          <Spinner
            v-if="isSubmitting"
            class="size-3.5"
          />
          {{ t('repository.branches.dialogs.deleteRef.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
