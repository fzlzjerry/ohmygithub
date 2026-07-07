import { ref } from 'vue'

const LEGACY_STORAGE_KEY = 'oh-my-github:workspace-pinned-organizations:v1'
const STORAGE_VERSION = 1

export function usePinnedOrganizations() {
  const pinnedOrganizationLogins = ref<string[]>([])
  let hasLocalChanges = false
  let persistQueue: Promise<void> = Promise.resolve()

  void restorePins()

  function toggleOrganizationPin(login: string): void {
    const isPinned = pinnedOrganizationLogins.value.includes(login)
    pinnedOrganizationLogins.value = isPinned
      ? pinnedOrganizationLogins.value.filter((item) => item !== login)
      : [login, ...pinnedOrganizationLogins.value.filter((item) => item !== login)]

    persist()
  }

  async function restorePins(): Promise<void> {
    try {
      const pinsBridge = window.ohMyGithub?.pins
      const info = await pinsBridge?.get?.()

      if (info?.hasContent) {
        applyRestoredLogins(coerceStoredLogins(info.pins))
        return
      }

      const legacyLogins = readLegacyStoredLogins()
      if (legacyLogins.length > 0) {
        applyRestoredLogins(legacyLogins)
        try {
          await persistPins(legacyLogins)
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        } catch (error) {
          console.error('Failed to migrate pinned organizations', error)
        }
        return
      }

      applyRestoredLogins(coerceStoredLogins(info?.pins))
    } catch {
      applyRestoredLogins(readLegacyStoredLogins())
    }
  }

  function applyRestoredLogins(logins: string[]): void {
    if (hasLocalChanges) return

    pinnedOrganizationLogins.value = logins
  }

  function persist(): void {
    hasLocalChanges = true
    const logins = [...pinnedOrganizationLogins.value]

    persistQueue = persistQueue
      .catch(() => undefined)
      .then(() => persistPins(logins))
      .catch((error) => {
        console.error('Failed to persist pinned organizations', error)
      })
  }

  return {
    pinnedOrganizationLogins,
    toggleOrganizationPin,
  }
}

async function persistPins(logins: string[]): Promise<void> {
  const pinsBridge = window.ohMyGithub?.pins
  if (!pinsBridge) {
    throw new Error('Pins bridge is not available')
  }

  await pinsBridge.update({ version: STORAGE_VERSION, organizations: logins })
}

function readLegacyStoredLogins(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((login): login is string => typeof login === 'string' && login.trim().length > 0)
  } catch {
    return []
  }
}

function coerceStoredLogins(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []

  const organizations = (value as { organizations?: unknown }).organizations
  if (!Array.isArray(organizations)) return []

  return organizations.filter((login): login is string => typeof login === 'string' && login.trim().length > 0)
}
