<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import { Badge, Button, Card } from '@oh-my-github/ui'
import { MockGitHubClient, type GitHubWorkspaceItem } from '@oh-my-github/api'

type ViewKey = 'inbox' | 'pulls' | 'issues' | 'actions' | 'repositories'

const { d, t } = useI18n()
const client = new MockGitHubClient()
const activeView = ref<ViewKey>('inbox')
const items = ref<GitHubWorkspaceItem[]>([])
const selectedId = ref<string>()
const appMeta = window.ohMyGithub?.app ?? { name: 'Oh My GitHub', version: '0.1.0' }

const views = computed<Array<{ key: ViewKey; label: string }>>(() => [
  { key: 'inbox', label: t('views.inbox') },
  { key: 'pulls', label: t('views.pulls') },
  { key: 'issues', label: t('views.issues') },
  { key: 'actions', label: t('views.actions') },
  { key: 'repositories', label: t('views.repositories') }
])

const filteredItems = computed(() => {
  if (activeView.value === 'pulls') {
    return items.value.filter((item) => item.kind === 'pull_request')
  }

  if (activeView.value === 'issues') {
    return items.value.filter((item) => item.kind === 'issue')
  }

  if (activeView.value === 'actions') {
    return items.value.filter((item) => item.kind === 'action')
  }

  if (activeView.value === 'repositories') {
    return items.value
  }

  return items.value
})

const selectedItem = computed(() => {
  return filteredItems.value.find((item) => item.id === selectedId.value) ?? filteredItems.value[0]
})

const activeViewLabel = computed(() => {
  return views.value.find((view) => view.key === activeView.value)?.label ?? ''
})

function setView(view: ViewKey): void {
  activeView.value = view
  selectedId.value = filteredItems.value[0]?.id
}

function countForView(view: ViewKey): number {
  if (view === 'pulls') return items.value.filter((item) => item.kind === 'pull_request').length
  if (view === 'issues') return items.value.filter((item) => item.kind === 'issue').length
  if (view === 'actions') return items.value.filter((item) => item.kind === 'action').length
  return items.value.length
}

function stateVariant(
  state: GitHubWorkspaceItem['state']
): 'default' | 'success' | 'destructive' | 'info' {
  if (state === 'failed') return 'destructive'
  if (state === 'success' || state === 'merged') return 'success'
  if (state === 'open' || state === 'unread') return 'info'
  return 'default'
}

function formatTime(value: string): string {
  return d(new Date(value), 'short')
}

onMounted(async () => {
  items.value = await client.listNotifications()
  selectedId.value = items.value[0]?.id
})
</script>

<template>
  <div class="workspace">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand__mark">OMG</div>
        <div>
          <div class="brand__name">Oh My GitHub</div>
          <div class="brand__meta">{{ t('app.localWorkspace') }}</div>
        </div>
      </div>

      <button class="command-button" type="button">
        <span>{{ t('commands.searchGitHub') }}</span>
        <kbd>⌘K</kbd>
      </button>

      <nav class="nav">
        <button
          v-for="view in views"
          :key="view.key"
          class="sidebar-item"
          :class="{ 'is-active': activeView === view.key }"
          type="button"
          @click="setView(view.key)"
        >
          <span>{{ view.label }}</span>
          <span>{{ countForView(view.key) }}</span>
        </button>
      </nav>

      <div class="sidebar__footer">
        <span>{{ appMeta.name }}</span>
        <span>v{{ appMeta.version }}</span>
      </div>
    </aside>

    <main class="list-pane">
      <header class="pane-header">
        <div>
          <h1>{{ activeViewLabel }}</h1>
          <p>{{ t('home.subtitle') }}</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw class="size-4" />
          {{ t('actions.refresh') }}
        </Button>
      </header>

      <div class="item-list">
        <button
          v-for="item in filteredItems"
          :key="item.id"
          class="item-row"
          :class="{ 'is-selected': selectedItem?.id === item.id }"
          type="button"
          @click="selectedId = item.id"
        >
          <div class="item-row__topline">
            <span class="item-row__repo">{{ item.repository }}</span>
            <span class="item-row__time">{{ formatTime(item.updatedAt) }}</span>
          </div>
          <div class="item-row__title">{{ item.title }}</div>
          <div class="item-row__meta">
            <Badge :variant="stateVariant(item.state)">{{ item.state }}</Badge>
            <span v-if="item.number">#{{ item.number }}</span>
            <span>@{{ item.author.login }}</span>
          </div>
        </button>
      </div>
    </main>

    <section class="detail-pane">
      <Card v-if="selectedItem" class="detail-card">
        <div class="detail-card__header">
          <Badge :variant="stateVariant(selectedItem.state)">{{ selectedItem.kind }}</Badge>
          <span>{{ selectedItem.repository }}</span>
        </div>
        <h2>{{ selectedItem.title }}</h2>
        <p>{{ selectedItem.summary }}</p>

        <dl class="detail-grid">
          <div>
            <dt>{{ t('item.author') }}</dt>
            <dd>@{{ selectedItem.author.login }}</dd>
          </div>
          <div>
            <dt>{{ t('item.updated') }}</dt>
            <dd>{{ formatTime(selectedItem.updatedAt) }}</dd>
          </div>
          <div>
            <dt>{{ t('item.state') }}</dt>
            <dd>{{ selectedItem.state }}</dd>
          </div>
          <div v-if="selectedItem.number">
            <dt>{{ t('item.number') }}</dt>
            <dd>#{{ selectedItem.number }}</dd>
          </div>
        </dl>

        <div class="labels">
          <Badge v-for="label in selectedItem.labels" :key="label">{{ label }}</Badge>
        </div>

        <div class="actions">
          <Button variant="primary">{{ t('actions.openWorkspace') }}</Button>
          <Button variant="secondary">{{ t('actions.markDone') }}</Button>
        </div>
      </Card>
    </section>
  </div>
</template>
