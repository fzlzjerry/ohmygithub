<script setup lang="ts">
import type {
  WorkspaceBookmark,
  WorkspaceBookmarkFolder,
  WorkspaceSidebarTreeItem,
} from '../types'
import type { CreateBookmarkFolderResult } from '../composables/use-workspace-bookmarks'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, Folder, Inbox, Plus, Search } from 'lucide-vue-next'
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
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from '@oh-my-github/ui'
import {
  bookmarkToTreeItem,
  organizationToTreeItem,
} from '../sidebar-tree-items'
import {
  ISSUE_CATEGORIES,
  PULL_REQUEST_CATEGORIES,
  issueCategoryToTreeItem,
  pullRequestCategoryToTreeItem,
} from '../sidebar-work-items'
import WorkspaceSidebarTree from './workspace-sidebar-tree.vue'
import WorkspaceUserPanel from './workspace-user-panel.vue'

const props = defineProps<{
  activeUrl: string
  bookmarkFolders: WorkspaceBookmarkFolder[]
  bookmarks: WorkspaceBookmark[]
  createBookmarkFolder: (title: string) => CreateBookmarkFolderResult
  isFullscreen: boolean
  organizations: GitHubOrganization[]
  organizationsError: boolean
  organizationsLoading: boolean
  viewer: AuthViewer | null
  width: number
}>()

type WorkspaceSidebarSectionId = 'bookmarks' | 'pull-requests' | 'issues' | 'organizations'
const INBOX_ITEM_ID = 'workspace-sidebar:inbox'

const emit = defineEmits<{
  select: [url: string]
  startResize: [event: PointerEvent]
}>()

const { t } = useI18n()
const { state } = useSidebar()
const expandedIds = reactive(new Set<string>())
const autoExpandedIds = reactive(new Set<string>())
const manuallyExpandedIds = reactive(new Set<string>())
const collapsedSectionIds = reactive(new Set<WorkspaceSidebarSectionId>())
const visibleCounts = reactive(new Map<string, number>())
const activeItemId = ref<string | null>(null)
const activeItemUrl = ref<string | null>(null)
const pendingSelectedUrl = ref<string | null>(null)
const isBookmarkFolderDialogOpen = ref(false)
const bookmarkFolderTitle = ref('')
const bookmarkFolderError = ref<'duplicate' | 'empty' | null>(null)
const hasOrganizations = computed(() => props.organizations.length > 0)
const showOrganizationsLoading = computed(() => props.organizationsLoading && !hasOrganizations.value)
const showOrganizationsError = computed(() => props.organizationsError && !hasOrganizations.value)
const showOrganizationsEmpty = computed(() =>
  !props.organizationsLoading && !props.organizationsError && !hasOrganizations.value,
)
const treeLabels = computed(() => ({
  issues: t('workspace.sidebar.groups.issues'),
  pullRequests: t('workspace.sidebar.groups.pullRequests'),
}))
const sidebarStyle = computed<Record<string, string>>(() => ({
  width: `${props.width}px`,
  marginLeft: state.value === 'expanded' ? '0px' : `-${props.width}px`,
  transition: 'margin-left 200ms cubic-bezier(0.32, 0.72, 0, 1)',
}))
const rootBookmarks = computed(() => props.bookmarks.filter((bookmark) => bookmark.folderId === null))
const bookmarkItems = computed<WorkspaceSidebarTreeItem[]>(() => {
  const folderItems = props.bookmarkFolders.map((folder) => {
    const children = props.bookmarks
      .filter((bookmark) => bookmark.folderId === folder.id)
      .map((bookmark) => bookmarkToTreeItem(bookmark, {
        activeItemId: activeItemId.value,
        activeUrl: props.activeUrl,
        labels: treeLabels.value,
      }))

    return {
      id: `bookmark-folder:${folder.id}`,
      label: folder.title,
      icon: Folder,
      canExpand: children.length > 0,
      forceExpanded: children.some((child) => child.isActive),
      children,
    }
  })

  return [
    ...folderItems,
    ...rootBookmarks.value.map((bookmark) => bookmarkToTreeItem(bookmark, {
      activeItemId: activeItemId.value,
      activeUrl: props.activeUrl,
      labels: treeLabels.value,
    })),
  ]
})
const showBookmarksEmpty = computed(() => props.bookmarkFolders.length === 0 && props.bookmarks.length === 0)
const bookmarkFolderErrorMessage = computed(() => {
  if (!bookmarkFolderError.value) return ''
  return t(`workspace.bookmarks.folderErrors.${bookmarkFolderError.value}`)
})
const pullRequestItems = computed<WorkspaceSidebarTreeItem[]>(() => {
  return PULL_REQUEST_CATEGORIES.map((category) =>
    pullRequestCategoryToTreeItem(
      category,
      t(`workspace.sidebar.pullRequestCategories.${category}`),
      activeItemId.value,
      props.activeUrl,
    )
  )
})
const issueItems = computed<WorkspaceSidebarTreeItem[]>(() => {
  return ISSUE_CATEGORIES.map((category) =>
    issueCategoryToTreeItem(
      category,
      t(`workspace.sidebar.issueCategories.${category}`),
      activeItemId.value,
      props.activeUrl,
    )
  )
})

const organizationItems = computed<WorkspaceSidebarTreeItem[]>(() => {
  return props.organizations.map((organization) =>
    organizationToTreeItem(organization, {
      activeItemId: activeItemId.value,
      activeUrl: props.activeUrl,
      labels: treeLabels.value,
      scope: 'organizations',
    })
  )
})

function toggleExpanded(id: string): void {
  autoExpandedIds.delete(id)

  if (manuallyExpandedIds.has(id)) {
    manuallyExpandedIds.delete(id)
    syncExpandedId(id)
    return
  }

  manuallyExpandedIds.add(id)
  syncExpandedId(id)
}

function toggleSection(id: WorkspaceSidebarSectionId): void {
  if (collapsedSectionIds.has(id)) {
    collapsedSectionIds.delete(id)
    return
  }

  collapsedSectionIds.add(id)
}

function isSectionExpanded(id: WorkspaceSidebarSectionId): boolean {
  return !collapsedSectionIds.has(id)
}

function sectionToggleLabel(id: WorkspaceSidebarSectionId, title: string): string {
  return t(isSectionExpanded(id) ? 'workspace.sidebar.collapseGroup' : 'workspace.sidebar.expandGroup', {
    title,
  })
}

function setVisibleCount(listId: string, visibleCount: number): void {
  visibleCounts.set(listId, visibleCount)
}

function syncExpandedId(id: string): void {
  if (autoExpandedIds.has(id) || manuallyExpandedIds.has(id)) {
    expandedIds.add(id)
    return
  }

  expandedIds.delete(id)
}

function autoExpand(id: string): void {
  autoExpandedIds.add(id)
  syncExpandedId(id)
}

function applyAutoExpandedIds(ids: string[]): void {
  const nextIds = new Set(ids)

  for (const id of [...autoExpandedIds]) {
    if (!nextIds.has(id)) {
      autoExpandedIds.delete(id)
      syncExpandedId(id)
    }
  }

  for (const id of nextIds) {
    autoExpand(id)
  }
}

function selectSidebarItem(url: string, itemId: string): void {
  activeItemId.value = itemId
  activeItemUrl.value = url
  pendingSelectedUrl.value = url === props.activeUrl ? null : url
  emit('select', url)
}

function isInboxActive(): boolean {
  return activeItemId.value ? activeItemId.value === INBOX_ITEM_ID : props.activeUrl === '/inbox'
}

function collectForceExpandedIds(items: WorkspaceSidebarTreeItem[]): string[] {
  const ids: string[] = []

  for (const item of items) {
    if (item.forceExpanded) {
      ids.push(item.id)
    }

    if (item.children?.length) {
      ids.push(...collectForceExpandedIds(item.children))
    }
  }

  return ids
}

function expandActiveAncestors(): void {
  applyAutoExpandedIds(collectForceExpandedIds([
    ...bookmarkItems.value,
    ...pullRequestItems.value,
    ...issueItems.value,
    ...organizationItems.value,
  ]))
}

function syncActiveItem(): void {
  if (pendingSelectedUrl.value) {
    if (pendingSelectedUrl.value === props.activeUrl) {
      pendingSelectedUrl.value = null
    }

    return
  }

  if (activeItemId.value && activeItemUrl.value === props.activeUrl) {
    return
  }

  const nextItemId = props.activeUrl === '/inbox'
    ? INBOX_ITEM_ID
    : findFirstItemIdByUrl([
      ...bookmarkItems.value,
      ...pullRequestItems.value,
      ...issueItems.value,
      ...organizationItems.value,
    ], props.activeUrl)

  activeItemId.value = nextItemId
  activeItemUrl.value = nextItemId ? props.activeUrl : null
}

function findFirstItemIdByUrl(items: WorkspaceSidebarTreeItem[], url: string): string | null {
  for (const item of items) {
    if (item.url === url) {
      return item.id
    }

    if (item.children?.length) {
      const childItemId = findFirstItemIdByUrl(item.children, url)
      if (childItemId) return childItemId
    }
  }

  return null
}

function submitBookmarkFolder(): void {
  const result = props.createBookmarkFolder(bookmarkFolderTitle.value)

  if (!result.ok) {
    bookmarkFolderError.value = result.reason
    return
  }

  isBookmarkFolderDialogOpen.value = false
}

function resetBookmarkFolderDialog(): void {
  bookmarkFolderTitle.value = ''
  bookmarkFolderError.value = null
}

watch(isBookmarkFolderDialogOpen, (isOpen) => {
  if (!isOpen) {
    resetBookmarkFolderDialog()
  }
})

watch(bookmarkFolderTitle, () => {
  bookmarkFolderError.value = null
})

watch(
  () => [props.activeUrl, bookmarkItems.value, pullRequestItems.value, issueItems.value, organizationItems.value],
  () => {
    syncActiveItem()
    expandActiveAncestors()
  },
  { immediate: true },
)
</script>

<template>
  <aside
    data-workspace-sidebar
    class="relative flex h-full shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground"
    :style="sidebarStyle"
  >
    <SidebarHeader
      :class="isFullscreen
        ? 'gap-0 px-2 pb-1 pt-0'
        : 'gap-2 px-2 pb-2 pt-0'"
    >
      <div
        aria-hidden="true"
        class="workspace-titlebar-spacer"
        :data-fullscreen="isFullscreen ? 'true' : undefined"
      />
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            class="before:hidden"
            size="sm"
            :tooltip="t('workspace.sidebar.search')"
            type="button"
          >
            <Search />
            <span>{{ t('workspace.sidebar.search') }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            class="before:hidden"
            size="sm"
            :is-active="isInboxActive()"
            :tooltip="t('workspace.sidebar.items.inbox')"
            type="button"
            @click="selectSidebarItem('/inbox', INBOX_ITEM_ID)"
          >
            <Inbox />
            <span>{{ t('workspace.sidebar.items.inbox') }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup class="px-2 py-1">
        <div class="flex h-7 items-center gap-1 px-2 pr-1">
          <SidebarGroupLabel class="h-6 flex-1 px-0 text-caption">
            {{ t('workspace.bookmarks.title') }}
          </SidebarGroupLabel>
          <button
            :aria-label="t('workspace.bookmarks.newFolder')"
            class="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:text-foreground"
            type="button"
            @click="isBookmarkFolderDialogOpen = true"
          >
            <Plus class="size-3.5" />
          </button>
          <button
            :aria-label="sectionToggleLabel('bookmarks', t('workspace.bookmarks.title'))"
            class="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:text-foreground"
            type="button"
            @click="toggleSection('bookmarks')"
          >
            <ChevronDown
              v-if="isSectionExpanded('bookmarks')"
              class="size-3.5"
            />
            <ChevronRight
              v-else
              class="size-3.5"
            />
          </button>
        </div>

        <SidebarGroupContent v-if="isSectionExpanded('bookmarks')">
          <p
            v-if="showBookmarksEmpty"
            class="px-2 py-1.5 text-caption text-muted-foreground"
          >
            {{ t('workspace.bookmarks.empty') }}
          </p>

          <WorkspaceSidebarTree
            v-else
            :active-item-id="activeItemId"
            :active-url="activeUrl"
            :expanded-ids="expandedIds"
            :items="bookmarkItems"
            list-id="bookmarks"
            :visible-counts="visibleCounts"
            @auto-expand="autoExpand"
            @select="selectSidebarItem"
            @show-more="setVisibleCount"
            @toggle="toggleExpanded"
          />
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup class="px-2 py-1">
        <div class="flex h-7 items-center gap-1 px-2 pr-1">
          <SidebarGroupLabel class="h-6 flex-1 px-0 text-caption">
            {{ t('workspace.sidebar.groups.pullRequests') }}
          </SidebarGroupLabel>
          <button
            :aria-label="sectionToggleLabel('pull-requests', t('workspace.sidebar.groups.pullRequests'))"
            class="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:text-foreground"
            type="button"
            @click="toggleSection('pull-requests')"
          >
            <ChevronDown
              v-if="isSectionExpanded('pull-requests')"
              class="size-3.5"
            />
            <ChevronRight
              v-else
              class="size-3.5"
            />
          </button>
        </div>

        <SidebarGroupContent v-if="isSectionExpanded('pull-requests')">
          <WorkspaceSidebarTree
            :active-item-id="activeItemId"
            :active-url="activeUrl"
            :expanded-ids="expandedIds"
            :items="pullRequestItems"
            list-id="viewer-pull-requests"
            :visible-counts="visibleCounts"
            @auto-expand="autoExpand"
            @select="selectSidebarItem"
            @show-more="setVisibleCount"
            @toggle="toggleExpanded"
          />
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup class="px-2 py-1">
        <div class="flex h-7 items-center gap-1 px-2 pr-1">
          <SidebarGroupLabel class="h-6 flex-1 px-0 text-caption">
            {{ t('workspace.sidebar.groups.issues') }}
          </SidebarGroupLabel>
          <button
            :aria-label="sectionToggleLabel('issues', t('workspace.sidebar.groups.issues'))"
            class="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:text-foreground"
            type="button"
            @click="toggleSection('issues')"
          >
            <ChevronDown
              v-if="isSectionExpanded('issues')"
              class="size-3.5"
            />
            <ChevronRight
              v-else
              class="size-3.5"
            />
          </button>
        </div>

        <SidebarGroupContent v-if="isSectionExpanded('issues')">
          <WorkspaceSidebarTree
            :active-item-id="activeItemId"
            :active-url="activeUrl"
            :expanded-ids="expandedIds"
            :items="issueItems"
            list-id="viewer-issues"
            :visible-counts="visibleCounts"
            @auto-expand="autoExpand"
            @select="selectSidebarItem"
            @show-more="setVisibleCount"
            @toggle="toggleExpanded"
          />
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup class="px-2 py-1">
        <div class="flex h-7 items-center gap-1 px-2 pr-1">
          <SidebarGroupLabel class="h-6 flex-1 px-0 text-caption">
            {{ t('workspace.sidebar.groups.organizations') }}
          </SidebarGroupLabel>
          <button
            :aria-label="sectionToggleLabel('organizations', t('workspace.sidebar.groups.organizations'))"
            class="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:text-foreground"
            type="button"
            @click="toggleSection('organizations')"
          >
            <ChevronDown
              v-if="isSectionExpanded('organizations')"
              class="size-3.5"
            />
            <ChevronRight
              v-else
              class="size-3.5"
            />
          </button>
        </div>
        <SidebarGroupContent v-if="isSectionExpanded('organizations')">
          <SidebarMenu v-if="showOrganizationsLoading">
            <SidebarMenuItem
              v-for="index in 3"
              :key="index"
            >
              <SidebarMenuSkeleton show-icon />
            </SidebarMenuItem>
          </SidebarMenu>

          <p
            v-else-if="showOrganizationsError"
            class="px-2 py-1.5 text-caption text-muted-foreground"
          >
            {{ t('workspace.sidebar.organizations.error') }}
          </p>

          <p
            v-else-if="showOrganizationsEmpty"
            class="px-2 py-1.5 text-caption text-muted-foreground"
          >
            {{ t('workspace.sidebar.organizations.empty') }}
          </p>

          <WorkspaceSidebarTree
            v-else
            :active-item-id="activeItemId"
            :active-url="activeUrl"
            :expanded-ids="expandedIds"
            :items="organizationItems"
            list-id="organizations"
            :visible-counts="visibleCounts"
            @auto-expand="autoExpand"
            @select="selectSidebarItem"
            @show-more="setVisibleCount"
            @toggle="toggleExpanded"
          />
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter
      v-if="viewer"
      class="border-t border-border"
    >
      <WorkspaceUserPanel :viewer="viewer" />
    </SidebarFooter>

    <button
      class="group absolute right-0 top-0 z-20 h-full w-1 translate-x-1/2 cursor-col-resize bg-transparent outline-hidden"
      :aria-label="t('workspace.sidebar.resize')"
      role="separator"
      type="button"
      @pointerdown="emit('startResize', $event)"
    >
      <span class="block h-full w-full transition-colors group-hover:bg-border group-focus-visible:bg-sidebar-ring" />
    </button>
  </aside>

  <Dialog v-model:open="isBookmarkFolderDialogOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('workspace.bookmarks.newFolder') }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ t('workspace.bookmarks.newFolderDescription') }}
        </DialogDescription>
      </DialogHeader>

      <form
        class="space-y-4"
        @submit.prevent="submitBookmarkFolder"
      >
        <div class="space-y-2">
          <Label for="workspace-bookmark-folder-title">
            {{ t('workspace.bookmarks.folderName') }}
          </Label>
          <Input
            id="workspace-bookmark-folder-title"
            v-model="bookmarkFolderTitle"
            autocomplete="off"
            :placeholder="t('workspace.bookmarks.folderNamePlaceholder')"
          />
          <p
            v-if="bookmarkFolderErrorMessage"
            class="text-caption text-destructive"
          >
            {{ bookmarkFolderErrorMessage }}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            @click="isBookmarkFolderDialogOpen = false"
          >
            {{ t('workspace.bookmarks.cancel') }}
          </Button>
          <Button type="submit">
            {{ t('workspace.bookmarks.createFolder') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.workspace-titlebar-spacer {
  height: 2.25rem;
  -webkit-app-region: drag;
}

.workspace-titlebar-spacer[data-fullscreen="true"] {
  height: 0.25rem;
}

:deep([data-workspace-sidebar] [data-sidebar="menu-button"][data-active="true"]::before) {
  display: none !important;
}

:deep([data-workspace-sidebar] [data-sidebar="menu-button"]:focus-visible) {
  box-shadow: none !important;
}
</style>
