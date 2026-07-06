<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
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
} from '@oh-my-github/ui'
import SettingsSection from '@/pages/settings/components/appearance-settings/settings-section.vue'
import {
  addCollaborator,
  cancelInvitation,
  removeCollaborator,
  updateInvitation,
} from '@/composables/github/use-repository-settings'
import { useToast } from '@/composables/use-toast'

const COLLABORATOR_ROLES: readonly GitHubRepositoryCollaboratorRole[] = ['pull', 'triage', 'push', 'maintain', 'admin']
const INVITATION_PERMISSIONS = ['read', 'triage', 'write', 'maintain', 'admin'] as const

const props = defineProps<{
  owner: string
  repo: string
  overview: GitHubRepositoryAccessOverview
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const toast = useToast()

const isAddDialogOpen = ref(false)
const newUsername = ref('')
const newRole = ref<GitHubRepositoryCollaboratorRole>('push')
const isAdding = ref(false)
const addError = ref<string | null>(null)
const pendingKeys = ref(new Set<string>())

watch(isAddDialogOpen, (open) => {
  if (open) {
    newUsername.value = ''
    newRole.value = 'push'
    addError.value = null
  }
})

function isPending(key: string): boolean {
  return pendingKeys.value.has(key)
}

async function run(key: string, action: () => Promise<void>): Promise<void> {
  if (pendingKeys.value.has(key)) return
  pendingKeys.value = new Set([...pendingKeys.value, key])

  try {
    await action()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('repository.settings.access.error'))
  } finally {
    const next = new Set(pendingKeys.value)
    next.delete(key)
    pendingKeys.value = next
    emit('refresh')
  }
}

async function add(): Promise<void> {
  const username = newUsername.value.trim()
  if (!username || isAdding.value) return
  isAdding.value = true
  addError.value = null

  try {
    const result = await addCollaborator(props.owner, props.repo, username, newRole.value)
    toast.success(t(result === 'invited'
      ? 'repository.settings.access.collaborators.invited'
      : 'repository.settings.access.collaborators.added', { username }))
    isAddDialogOpen.value = false
    emit('refresh')
  } catch (error) {
    addError.value = error instanceof Error ? error.message : t('repository.settings.access.error')
  } finally {
    isAdding.value = false
  }
}

function changeRole(login: string, value: unknown): void {
  if (typeof value !== 'string') return
  void run(`role:${login}`, () =>
    addCollaborator(props.owner, props.repo, login, value as GitHubRepositoryCollaboratorRole).then(() => undefined))
}

function remove(login: string): void {
  void run(`remove:${login}`, () => removeCollaborator(props.owner, props.repo, login))
}

function changeInvitation(id: number, value: unknown): void {
  if (typeof value !== 'string') return
  void run(`invitation:${id}`, () => updateInvitation(props.owner, props.repo, id, value))
}

function cancel(id: number): void {
  void run(`cancel:${id}`, () => cancelInvitation(props.owner, props.repo, id))
}
</script>

<template>
  <SettingsSection :title="t('repository.settings.access.tabs.collaborators')">
    <template #actions>
      <Button
        size="sm"
        type="button"
        variant="outline"
        @click="isAddDialogOpen = true"
      >
        <Plus class="size-4" />
        {{ t('repository.settings.access.collaborators.add') }}
      </Button>
    </template>

    <div class="divide-y divide-border">
      <p
        v-if="overview.collaborators.length === 0 && overview.invitations.length === 0"
        class="px-4 py-6 text-center text-body text-muted-foreground"
      >
        {{ t('repository.settings.access.collaborators.empty') }}
      </p>

      <div
        v-for="collaborator in overview.collaborators"
        :key="collaborator.login"
        class="flex items-center justify-between gap-4 px-4 py-3"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <img
            :alt="collaborator.login"
            class="size-6 rounded-full"
            :src="collaborator.avatarUrl"
          >
          <span class="truncate text-control font-medium text-foreground">{{ collaborator.login }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Select
            :disabled="isPending(`role:${collaborator.login}`)"
            :model-value="collaborator.roleName"
            @update:model-value="changeRole(collaborator.login, $event)"
          >
            <SelectTrigger
              class="min-w-28"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem
                v-if="!COLLABORATOR_ROLES.includes(collaborator.roleName as GitHubRepositoryCollaboratorRole)"
                :value="collaborator.roleName"
              >
                {{ collaborator.roleName }}
              </SelectItem>
              <SelectItem
                v-for="role in COLLABORATOR_ROLES"
                :key="role"
                :value="role"
              >
                {{ t(`repository.settings.access.roles.${role}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            :aria-label="t('repository.settings.access.collaborators.remove')"
            :disabled="isPending(`remove:${collaborator.login}`)"
            size="icon-sm"
            variant="ghost"
            @click="remove(collaborator.login)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </div>

      <div
        v-for="invitation in overview.invitations"
        :key="invitation.id"
        class="flex items-center justify-between gap-4 px-4 py-3"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <img
            v-if="invitation.inviteeAvatarUrl"
            :alt="invitation.inviteeLogin ?? ''"
            class="size-6 rounded-full"
            :src="invitation.inviteeAvatarUrl"
          >
          <span class="truncate text-control font-medium text-foreground">
            {{ invitation.inviteeLogin ?? t('repository.settings.access.collaborators.unknownInvitee') }}
          </span>
          <span class="select-none rounded-full bg-muted px-1.5 text-caption text-muted-foreground">
            {{ t('repository.settings.access.collaborators.pending') }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Select
            :disabled="isPending(`invitation:${invitation.id}`)"
            :model-value="invitation.permissions"
            @update:model-value="changeInvitation(invitation.id, $event)"
          >
            <SelectTrigger
              class="min-w-28"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem
                v-if="!INVITATION_PERMISSIONS.includes(invitation.permissions as typeof INVITATION_PERMISSIONS[number])"
                :value="invitation.permissions"
              >
                {{ invitation.permissions }}
              </SelectItem>
              <SelectItem
                v-for="permission in INVITATION_PERMISSIONS"
                :key="permission"
                :value="permission"
              >
                {{ t(`repository.settings.access.invitationPermissions.${permission}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            :aria-label="t('repository.settings.access.collaborators.cancelInvitation')"
            :disabled="isPending(`cancel:${invitation.id}`)"
            size="icon-sm"
            variant="ghost"
            @click="cancel(invitation.id)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </div>
    </div>
  </SettingsSection>

  <Dialog v-model:open="isAddDialogOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('repository.settings.access.collaborators.addTitle') }}</DialogTitle>
      </DialogHeader>

      <form
        class="grid gap-3"
        @submit.prevent="add"
      >
        <div class="grid gap-1.5">
          <Label for="collaborator-username">{{ t('repository.settings.access.collaborators.addPlaceholder') }}</Label>
          <Input
            id="collaborator-username"
            v-model="newUsername"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="grid gap-1.5">
          <Label>{{ t('repository.settings.access.collaborators.role') }}</Label>
          <Select v-model="newRole">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="role in COLLABORATOR_ROLES"
                :key="role"
                :value="role"
              >
                {{ t(`repository.settings.access.roles.${role}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p
          v-if="addError"
          class="text-body text-destructive"
        >
          {{ addError }}
        </p>
      </form>

      <DialogFooter>
        <Button
          :disabled="isAdding"
          size="sm"
          type="button"
          variant="outline"
          @click="isAddDialogOpen = false"
        >
          {{ t('repository.settings.general.dangerZone.cancel') }}
        </Button>
        <Button
          :disabled="isAdding || !newUsername.trim()"
          size="sm"
          type="button"
          @click="add"
        >
          <Spinner
            v-if="isAdding"
            class="size-3.5"
          />
          {{ t('repository.settings.access.collaborators.add') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
