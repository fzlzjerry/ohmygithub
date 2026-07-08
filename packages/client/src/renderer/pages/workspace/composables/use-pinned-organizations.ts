import type { MaybeRefOrGetter, Ref } from 'vue'
import { ref, toValue, watch } from 'vue'

/**
 * Pinned workspace sidebar organizations persisted to
 * ~/.oh-my-github/pins.json through the pins bridge, keyed by the
 * signed-in account login so each account keeps its own pin list.
 */
export function usePinnedOrganizations(login: MaybeRefOrGetter<string | null | undefined>): {
  pinnedOrganizationLogins: Ref<string[]>
  toggleOrganizationPin: (organizationLogin: string) => void
} {
  const pinnedOrganizationLogins = ref<string[]>([])
  let restoreToken = 0
  let persistQueue: Promise<void> = Promise.resolve()

  watch(
    () => normalizeLogin(toValue(login)),
    (normalizedLogin) => {
      pinnedOrganizationLogins.value = []
      if (!normalizedLogin) return

      void restore(normalizedLogin)
    },
    { immediate: true },
  )

  function toggleOrganizationPin(organizationLogin: string): void {
    const normalizedLogin = normalizeLogin(toValue(login))
    if (!normalizedLogin) return

    const current = pinnedOrganizationLogins.value
    const isPinned = current.includes(organizationLogin)
    pinnedOrganizationLogins.value = isPinned
      ? current.filter((item) => item !== organizationLogin)
      : [organizationLogin, ...current.filter((item) => item !== organizationLogin)]

    persist(normalizedLogin, pinnedOrganizationLogins.value)
  }

  async function restore(normalizedLogin: string): Promise<void> {
    const token = ++restoreToken

    try {
      const info = await window.ohMyGithub?.pins?.get?.()
      if (token !== restoreToken) return

      pinnedOrganizationLogins.value = info?.pins?.organizations?.[normalizedLogin] ?? []
    } catch (error) {
      console.error('Failed to restore pinned organizations', error)
    }
  }

  function persist(normalizedLogin: string, organizations: string[]): void {
    // Invalidate in-flight restores so a stale read can't clobber the toggle.
    restoreToken += 1
    persistQueue = persistQueue
      .catch(() => undefined)
      .then(async () => {
        const pinsBridge = window.ohMyGithub?.pins
        if (!pinsBridge?.setOrganizationPins) {
          throw new Error('Pins bridge is unavailable')
        }

        // Copy into a plain array: Vue's reactive proxy cannot cross the
        // IPC structured-clone boundary (DataCloneError).
        await pinsBridge.setOrganizationPins({ login: normalizedLogin, organizations: [...organizations] })
      })
      .catch((error) => {
        console.error('Failed to persist pinned organizations', error)
      })
  }

  return {
    pinnedOrganizationLogins,
    toggleOrganizationPin,
  }
}

function normalizeLogin(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}
