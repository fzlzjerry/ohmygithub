<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tag } from 'lucide-vue-next'
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
  Textarea,
} from '@oh-my-github/ui'
import GitHubBranchSelect from '@/components/github/github-branch-select.vue'
import { createTag } from '@/composables/github/use-repositories'
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
const message = ref('')
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
    message.value = ''
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
  const tagName = name.value.trim()

  if (!tagName) {
    showNameError.value = true
    return
  }
  if (!fromRef.value || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    await createTag(props.owner, props.repo, tagName, fromRef.value, message.value.trim() || null)
    emit('created', tagName)
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = extractIpcErrorMessage(error) ?? t('repository.branches.dialogs.createTag.error')
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
        <DialogTitle>{{ t('repository.branches.dialogs.createTag.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('repository.branches.dialogs.createTag.description', { repo: `${owner}/${repo}` }) }}
        </DialogDescription>
      </DialogHeader>

      <form
        class="grid gap-4"
        @submit.prevent="submit"
      >
        <div class="grid gap-1.5">
          <Label for="create-tag-name">{{ t('repository.branches.dialogs.createTag.nameLabel') }}</Label>
          <Input
            id="create-tag-name"
            v-model="name"
            autocomplete="off"
            :disabled="isSubmitting"
            :placeholder="t('repository.branches.dialogs.createTag.namePlaceholder')"
            spellcheck="false"
            @input="showNameError = false"
          />
          <p
            v-if="showNameError"
            class="text-body text-destructive"
          >
            {{ t('repository.branches.dialogs.createTag.nameRequired') }}
          </p>
        </div>

        <div class="grid gap-1.5">
          <Label for="create-tag-source">{{ t('repository.branches.dialogs.createTag.sourceLabel') }}</Label>
          <GitHubBranchSelect
            id="create-tag-source"
            v-model="fromRef"
            :default-branch="defaultBranch"
            :owner="owner"
            :repo="repo"
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="create-tag-message">{{ t('repository.branches.dialogs.createTag.messageLabel') }}</Label>
          <Textarea
            id="create-tag-message"
            v-model="message"
            class="max-h-40 min-h-20"
            :disabled="isSubmitting"
            :placeholder="t('repository.branches.dialogs.createTag.messagePlaceholder')"
            spellcheck="false"
          />
          <p class="text-caption text-muted-foreground">
            {{ t('repository.branches.dialogs.createTag.messageHint') }}
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
            <Tag
              v-else
              class="size-3.5"
              :stroke-width="1.75"
            />
            {{ t('repository.branches.dialogs.createTag.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
