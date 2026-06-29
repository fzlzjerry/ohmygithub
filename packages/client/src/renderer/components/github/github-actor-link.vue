<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@oh-my-github/ui'
import { createAccountWorkspaceUrl, createGitHubAvatarUrl } from './github-reference'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  login: string
  avatarUrl?: string | null
  showAvatar?: boolean
  showUsername?: boolean
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg'
  interactive?: boolean
  variant?: 'plain' | 'pill'
}>(), {
  showAvatar: true,
  showUsername: true,
  avatarSize: 'sm',
  interactive: true,
  variant: 'plain',
})

const router = useRouter()

const normalizedLogin = computed(() => props.login.trim())
const fallback = computed(() => normalizedLogin.value.slice(0, 2).toUpperCase())
const avatarSrc = computed(() => props.avatarUrl || createGitHubAvatarUrl(normalizedLogin.value))
const avatarClass = computed(() => {
  if (props.avatarSize === 'xs') return 'size-4'
  if (props.avatarSize === 'md') return 'size-7'
  if (props.avatarSize === 'lg') return 'size-9'

  return 'size-5'
})
const fallbackClass = computed(() => {
  if (props.avatarSize === 'xs') return 'text-[9px]'
  if (props.avatarSize === 'lg') return 'text-caption'

  return 'text-[10px]'
})
const linkClass = computed(() => [
  'github-actor-link group inline-flex min-w-0 items-center gap-1.5 align-middle text-foreground outline-hidden',
  props.variant === 'pill'
    ? 'github-actor-link--pill'
    : 'rounded-sm',
  props.interactive ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/30' : '',
])

function openProfile(): void {
  if (!props.interactive || !normalizedLogin.value) return

  void router.push(createAccountWorkspaceUrl(normalizedLogin.value))
}
</script>

<template>
  <button
    v-if="interactive"
    v-bind="$attrs"
    :class="linkClass"
    :data-variant="variant"
    type="button"
    @click.stop="openProfile"
  >
    <Avatar
      v-if="showAvatar"
      class="shrink-0"
      :class="avatarClass"
    >
      <AvatarImage
        :alt="normalizedLogin"
        :src="avatarSrc"
      />
      <AvatarFallback :class="fallbackClass">
        {{ fallback }}
      </AvatarFallback>
    </Avatar>
    <span
      v-if="showUsername"
      class="min-w-0 truncate font-medium"
      :class="variant === 'plain' ? 'underline-offset-4 group-hover:underline group-focus-visible:underline' : ''"
    >
      {{ normalizedLogin }}
    </span>
  </button>

  <span
    v-else
    v-bind="$attrs"
    :class="linkClass"
    :data-variant="variant"
  >
    <Avatar
      v-if="showAvatar"
      class="shrink-0"
      :class="avatarClass"
    >
      <AvatarImage
        :alt="normalizedLogin"
        :src="avatarSrc"
      />
      <AvatarFallback :class="fallbackClass">
        {{ fallback }}
      </AvatarFallback>
    </Avatar>
    <span
      v-if="showUsername"
      class="min-w-0 truncate font-medium"
    >
      {{ normalizedLogin }}
    </span>
  </span>
</template>

<style scoped>
.github-actor-link--pill {
  background-color: var(--ui-hover);
  border: 1px solid var(--border);
  border-radius: 9999px;
  color: var(--foreground);
  padding: 0.125rem 0.5rem;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
}

.github-actor-link--pill:hover,
.github-actor-link--pill:focus-visible {
  background-color: var(--ui-selected);
  border-color: var(--border);
}
</style>
