<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, MessageSquare, RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { Button } from '@oh-my-github/ui'
import TelegramIcon from '@/components/icons/telegram-icon.vue'
import { getShortcutPlatform } from '@/keyboard/shortcut-accelerator'
import liquidLogo from '../../../../../../../../assets/liquid-glass-icon.png'
import shadowLogo from '../../../../../../../../assets/shadow-icon.png'

const AUTHOR_PROFILE_URL = 'https://github.com/sheepbox8646'
const TELEGRAM_URL = 'https://t.me/ohmygithub'
const FEEDBACK_URL = 'https://github.com/ohmygit-hub/ohmygithub/issues'

const { t } = useI18n()

// macOS ships the liquid-glass mark; every other platform uses the shadow mark.
// Resolved synchronously so the correct logo paints on first render.
const logo = getShortcutPlatform().isMac ? liquidLogo : shadowLogo
const year = new Date().getFullYear()

const version = ref('')
const latestVersion = ref<string | null>(null)
const hasUpdate = ref(false)
const checking = ref(false)

const checkButtonLabel = computed(() =>
  hasUpdate.value ? t('settings.about.downloadUpdate') : t('settings.about.checkForUpdate'),
)

onMounted(async () => {
  const info = await window.ohMyGithub.updates.getInfo()
  version.value = info.version
})

async function handleCheckOrDownload(): Promise<void> {
  if (checking.value) return

  // Once an update is found the button becomes "Download Update" — wired to a
  // placeholder for now.
  if (hasUpdate.value) return

  checking.value = true
  try {
    const result = await window.ohMyGithub.updates.checkForUpdate()
    latestVersion.value = result.latestVersion
    hasUpdate.value = result.hasUpdate
  } catch (error) {
    console.error('Failed to check for updates', error)
  } finally {
    checking.value = false
  }
}

function openAuthorProfile(): void {
  void window.ohMyGithub.links.openGitHubUrl(AUTHOR_PROFILE_URL)
}

function openTelegram(): void {
  void window.ohMyGithub.links.openExternalUrl(TELEGRAM_URL)
}

function openFeedback(): void {
  void window.ohMyGithub.links.openExternalUrl(FEEDBACK_URL)
}
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <img
        :src="logo"
        alt=""
        class="size-24 select-none"
        draggable="false"
      >

      <div class="flex flex-col items-center gap-1.5">
        <h2 class="select-none text-heading font-semibold text-foreground">
          Oh My GitHub
        </h2>
        <p class="select-none text-caption text-muted-foreground">
          {{ t('settings.about.currentVersion', { version }) }}
          <template v-if="hasUpdate && latestVersion">
            · {{ t('settings.about.latestVersion', { version: latestVersion }) }}
          </template>
        </p>
      </div>

      <div class="flex items-center justify-center gap-3">
        <Button
          :variant="hasUpdate ? 'default' : 'outline'"
          :loading="checking"
          @click="handleCheckOrDownload"
        >
          <component
            :is="hasUpdate ? Download : RefreshCw"
            class="size-4"
          />
          {{ checkButtonLabel }}
        </Button>

        <Button
          as="a"
          href="#"
          variant="outline"
          @click.prevent="openFeedback"
        >
          <MessageSquare class="size-4" />
          {{ t('settings.about.feedback') }}
        </Button>

        <Button
          as="a"
          href="#"
          variant="outline"
          @click.prevent="openTelegram"
        >
          <TelegramIcon class="size-4" />
          {{ t('settings.about.telegram') }}
        </Button>
      </div>
    </div>

    <footer class="flex select-none flex-col items-center gap-1 pt-6 text-caption text-muted-foreground">
      <p>{{ t('settings.about.copyright', { year }) }}</p>
      <i18n-t
        keypath="settings.about.madeBy"
        tag="p"
      >
        <template #author>
          <a
            class="cursor-pointer text-foreground underline-offset-4 hover:underline"
            @click="openAuthorProfile"
          >Acbox</a>
        </template>
      </i18n-t>
    </footer>
  </div>
</template>
