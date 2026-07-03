<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { deletePackage, deletePackageVersion } from '@/composables/github/use-packages'

export type PackageDeleteTarget =
  | { kind: 'package'; package: GitHubPackage }
  | { kind: 'version'; package: GitHubPackage; version: GitHubPackageVersion }

const props = defineProps<{
  open: boolean
  owner: string
  target: PackageDeleteTarget | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  deleted: [target: PackageDeleteTarget]
}>()

const { t } = useI18n()

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

const isScopeError = computed(() => Boolean(errorMessage.value) && /403|scope/i.test(errorMessage.value ?? ''))
const showLastVersionHint = computed(() =>
  Boolean(errorMessage.value) && !isScopeError.value && props.target?.kind === 'version'
)

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
    if (target.kind === 'package') {
      await deletePackage(props.owner, target.package.packageType, target.package.name)
    } else {
      await deletePackageVersion(
        props.owner,
        target.package.packageType,
        target.package.name,
        target.version.id,
      )
    }

    emit('deleted', target)
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = extractIpcErrorMessage(error)
      ?? t(
        target.kind === 'package'
          ? 'repository.packages.deleteDialog.packageError'
          : 'repository.packages.deleteDialog.versionError',
      )
  } finally {
    isSubmitting.value = false
  }
}

function extractIpcErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null

  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
    .trim()

  return message || null
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
            target?.kind === 'version'
              ? 'repository.packages.deleteDialog.versionTitle'
              : 'repository.packages.deleteDialog.packageTitle',
          ) }}
        </DialogTitle>
        <DialogDescription>
          {{ t(
            target?.kind === 'version'
              ? 'repository.packages.deleteDialog.versionDescription'
              : 'repository.packages.deleteDialog.packageDescription',
            { name: target?.kind === 'version' ? target.version.name : target?.package.name ?? '' },
          ) }}
        </DialogDescription>
      </DialogHeader>

      <p class="text-body text-muted-foreground">
        {{ t('repository.packages.deleteDialog.irreversibleHint') }}
      </p>

      <div
        v-if="errorMessage"
        class="grid gap-1"
      >
        <p
          class="text-body text-destructive"
          role="alert"
        >
          {{ isScopeError ? t('repository.packages.deleteDialog.scopeError') : errorMessage }}
        </p>
        <p
          v-if="showLastVersionHint"
          class="text-body text-muted-foreground"
        >
          {{ t('repository.packages.deleteDialog.lastVersionHint') }}
        </p>
      </div>

      <DialogFooter>
        <Button
          :disabled="isSubmitting"
          size="sm"
          type="button"
          variant="outline"
          @click="setOpen(false)"
        >
          {{ t('repository.packages.deleteDialog.cancel') }}
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
          {{ t('repository.packages.deleteDialog.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
