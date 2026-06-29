<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Copy, Github } from 'lucide-vue-next'
import { Alert, AlertDescription, Button, Card, CardContent, Input, Spinner } from '@oh-my-github/ui'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const authState = ref<AuthState>()
const deviceSessionId = ref('')
const deviceCode = ref('')
const verificationUri = ref('')
const errorMessage = ref('')
const token = ref('')
const showTokenForm = ref(false)
const isAuthLoaded = ref(false)
const oauthStatus = ref<'idle' | 'opening' | 'waiting' | 'success'>('idle')
const tokenStatus = ref<'idle' | 'saving'>('idle')

const isOAuthLoading = computed(() => oauthStatus.value === 'opening' || oauthStatus.value === 'waiting')
const isTokenSaving = computed(() => tokenStatus.value === 'saving')
const hasAuthBridge = computed(() => Boolean(window.ohMyGithub?.auth))
const canUseOAuth = computed(() => Boolean(authState.value?.hasGitHubClientId))

onMounted(async () => {
  authState.value = await window.ohMyGithub?.auth?.get?.()
  if (!authState.value) {
    errorMessage.value = t('auth.electronRequired')
  }
  isAuthLoaded.value = true
})

async function loginWithGitHub(): Promise<void> {
  if (!window.ohMyGithub?.auth || !canUseOAuth.value || isOAuthLoading.value) {
    return
  }

  errorMessage.value = ''
  deviceSessionId.value = ''
  deviceCode.value = ''
  verificationUri.value = ''
  oauthStatus.value = 'opening'

  try {
    const result = await window.ohMyGithub.auth.startDeviceFlow((details) => {
      deviceSessionId.value = details.sessionId
      deviceCode.value = details.userCode
      verificationUri.value = details.verificationUri
      oauthStatus.value = 'waiting'
    })
    authState.value = result.auth
    oauthStatus.value = 'success'
    await router.replace(resolveRedirectPath())
  } catch (error) {
    oauthStatus.value = 'idle'
    errorMessage.value = resolveErrorMessage(error)
  }
}

async function copyCodeAndOpenGitHub(): Promise<void> {
  if (!window.ohMyGithub?.auth || !deviceSessionId.value) {
    return
  }

  errorMessage.value = ''

  try {
    await window.ohMyGithub.auth.copyCodeAndOpenDeviceFlow(deviceSessionId.value)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
}

async function savePersonalToken(): Promise<void> {
  if (!window.ohMyGithub?.auth || isTokenSaving.value) {
    return
  }

  errorMessage.value = ''
  tokenStatus.value = 'saving'

  try {
    authState.value = await window.ohMyGithub.auth.savePersonalToken(token.value)
    token.value = ''
    await router.replace(resolveRedirectPath())
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  } finally {
    tokenStatus.value = 'idle'
  }
}

function toggleTokenForm(): void {
  showTokenForm.value = !showTokenForm.value
  errorMessage.value = ''
}

function resolveRedirectPath(): string {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect && redirect !== '/auth') {
    return redirect
  }

  return '/'
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }

  return t('auth.errors.unknown')
}
</script>

<template>
  <main class="grid min-h-full place-items-center bg-background px-6 py-12">
    <Card class="w-full max-w-sm">
      <CardContent class="grid gap-4">
        <div class="grid gap-2 text-center">
          <h1 class="select-none text-title font-semibold text-foreground">{{ t('auth.title') }}</h1>
          <p class="select-none text-body text-muted-foreground">{{ t('auth.subtitle') }}</p>
        </div>

        <Button
          v-if="!showTokenForm"
          :disabled="!canUseOAuth"
          :loading="isOAuthLoading"
          block
          loading-mode="manual"
          size="lg"
          type="button"
          @click="loginWithGitHub"
        >
          <Spinner v-if="isOAuthLoading" />
          <Github v-else class="size-4" />
          {{ t('auth.loginWithGitHub') }}
        </Button>

        <p
          v-if="!showTokenForm && isAuthLoaded && hasAuthBridge && !canUseOAuth"
          class="text-center text-body text-muted-foreground"
        >
          {{ t('auth.missingClientId') }}
        </p>

        <div
          v-if="!showTokenForm && deviceCode"
          class="grid gap-2 rounded-lg border border-border bg-card p-4 text-center"
        >
          <p class="select-none text-body text-muted-foreground">{{ t('auth.browserOpened') }}</p>
          <div class="select-text rounded-md bg-accent px-3 py-2 text-title font-semibold text-foreground">
            {{ deviceCode }}
          </div>
          <Button
            block
            type="button"
            variant="secondary"
            @click="copyCodeAndOpenGitHub"
          >
            <Copy class="size-4" />
            {{ t('auth.copyCodeAndOpenGitHub') }}
          </Button>
          <p class="text-body text-muted-foreground">
            {{ t('auth.waitingForAuthorization') }}
            <span v-if="verificationUri">{{ verificationUri }}</span>
          </p>
        </div>

        <form
          v-if="showTokenForm"
          class="grid gap-3"
          @submit.prevent="savePersonalToken"
        >
          <Input
            v-model="token"
            autocomplete="off"
            :placeholder="t('auth.tokenPlaceholder')"
            type="password"
          />
          <Button
            :disabled="!token.trim()"
            :loading="isTokenSaving"
            block
            type="submit"
            variant="secondary"
          >
            {{ t('auth.saveToken') }}
          </Button>
        </form>

        <Button
          class="justify-self-center"
          size="text"
          type="button"
          variant="link"
          @click="toggleTokenForm"
        >
          {{ showTokenForm ? t('auth.useOAuth') : t('auth.usePersonalToken') }}
        </Button>

        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  </main>
</template>
