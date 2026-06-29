<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
} from '@oh-my-github/ui'
import {
  BookOpen,
  Building2,
  ExternalLink,
  LinkIcon,
  MapPin,
  UserRound,
  Users,
} from 'lucide-vue-next'
import { useAccountProfileQuery } from '../../composables/github/use-accounts'

const props = defineProps<{
  tab: WorkspaceTab
}>()

const { t } = useI18n()

const login = computed(() => props.tab.owner ?? props.tab.title)
const hasLogin = computed(() => login.value.trim().length > 0)
const profileQuery = useAccountProfileQuery(login, hasLogin)
const profile = computed(() => profileQuery.data.value ?? null)
const isLoading = computed(() => hasLogin.value && profileQuery.isLoading.value && !profile.value)
const hasError = computed(() => Boolean(profileQuery.error.value))
const displayName = computed(() => profile.value?.name?.trim() || profile.value?.login || login.value)
const fallback = computed(() => login.value.slice(0, 2).toUpperCase())
const stats = computed(() => {
  const currentProfile = profile.value
  if (!currentProfile) return []

  return [
    {
      id: 'followers',
      icon: Users,
      label: t('account.profile.followers'),
      value: formatNumber(currentProfile.followers),
    },
    {
      id: 'following',
      icon: UserRound,
      label: t('account.profile.following'),
      value: formatNumber(currentProfile.following),
    },
    {
      id: 'publicRepos',
      icon: BookOpen,
      label: t('account.profile.publicRepos'),
      value: formatNumber(currentProfile.publicRepos),
    },
  ]
})
const details = computed(() => {
  const currentProfile = profile.value
  if (!currentProfile) return []

  return [
    {
      id: 'company',
      icon: Building2,
      label: t('account.profile.company'),
      value: currentProfile.company,
      href: null,
    },
    {
      id: 'location',
      icon: MapPin,
      label: t('account.profile.location'),
      value: currentProfile.location,
      href: null,
    },
    {
      id: 'blog',
      icon: LinkIcon,
      label: t('account.profile.blog'),
      value: currentProfile.blog,
      href: normalizeExternalUrl(currentProfile.blog),
    },
  ].filter((item) => Boolean(item.value))
})

function retry(): void {
  void profileQuery.refetch()
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function normalizeExternalUrl(value: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
</script>

<template>
  <section class="min-h-full bg-background">
    <div class="mx-auto grid w-full max-w-5xl gap-5 px-6 py-6">
      <div
        v-if="isLoading"
        class="grid gap-4"
      >
        <div class="flex min-w-0 items-center gap-4">
          <Skeleton class="size-16 rounded-full" />
          <div class="grid min-w-0 gap-2">
            <Skeleton class="h-6 w-48 rounded-md" />
            <Skeleton class="h-4 w-32 rounded-md" />
          </div>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <Skeleton
            v-for="index in 3"
            :key="index"
            class="h-20 rounded-lg"
          />
        </div>
      </div>

      <Empty
        v-else-if="!hasLogin || hasError || !profile"
        class="min-h-[24rem] border border-border bg-card"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t(hasError ? 'account.error.title' : 'account.empty.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t(hasError ? 'account.error.description' : 'account.empty.description') }}
          </EmptyDescription>
          <Button
            v-if="hasError"
            class="justify-self-center"
            size="sm"
            type="button"
            variant="outline"
            @click="retry"
          >
            {{ t('account.error.retry') }}
          </Button>
        </EmptyHeader>
      </Empty>

      <template v-else>
        <header class="grid gap-4 border-b border-border pb-5">
          <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar class="size-16 shrink-0">
              <AvatarImage
                :alt="profile.login"
                :src="profile.avatarUrl"
              />
              <AvatarFallback class="text-label">
                {{ fallback }}
              </AvatarFallback>
            </Avatar>

            <div class="grid min-w-0 flex-1 gap-1">
              <div class="select-none text-body font-medium text-muted-foreground">
                {{ t('account.eyebrow') }}
              </div>
              <h1 class="truncate text-heading font-semibold text-foreground">
                {{ displayName }}
              </h1>
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body text-muted-foreground">
                <span class="truncate">@{{ profile.login }}</span>
                <span aria-hidden="true">·</span>
                <span class="truncate">{{ t('account.profile.type', { type: profile.type }) }}</span>
              </div>
            </div>

            <Button
              v-if="profile.url"
              as="a"
              :href="profile.url"
              rel="noreferrer"
              size="sm"
              target="_blank"
              variant="outline"
            >
              <ExternalLink class="size-3.5" />
              <span>{{ t('account.profile.githubProfile') }}</span>
            </Button>
          </div>

          <p
            v-if="profile.bio"
            class="max-w-3xl text-label text-muted-foreground"
          >
            {{ profile.bio }}
          </p>
        </header>

        <div class="grid gap-2 sm:grid-cols-3">
          <div
            v-for="item in stats"
            :key="item.id"
            class="grid gap-2 rounded-lg border border-border bg-card p-3"
          >
            <div class="flex min-w-0 select-none items-center gap-2 text-body font-medium text-muted-foreground">
              <component
                :is="item.icon"
                class="size-4 shrink-0"
              />
              <span class="truncate">{{ item.label }}</span>
            </div>
            <div class="truncate text-control font-semibold text-foreground">
              {{ item.value }}
            </div>
          </div>
        </div>

        <div
          v-if="details.length > 0"
          class="grid gap-2 rounded-lg border border-border bg-card p-3"
        >
          <div
            v-for="item in details"
            :key="item.id"
            class="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-body"
          >
            <component
              :is="item.icon"
              class="mt-0.5 size-3.5 text-muted-foreground"
            />
            <a
              v-if="item.href"
              class="min-w-0 truncate font-medium text-foreground underline-offset-4 outline-hidden hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/30"
              :href="item.href"
              rel="noreferrer"
              target="_blank"
            >
              {{ item.value }}
            </a>
            <span
              v-else
              class="min-w-0 truncate font-medium text-foreground"
            >
              {{ item.value }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
