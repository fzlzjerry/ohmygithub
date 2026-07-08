import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePinnedOrganizations } from './use-pinned-organizations'

/* Electron serializes IPC arguments with the structured clone algorithm,
   which rejects Vue reactive proxies (DataCloneError). The fake bridge
   clones every payload the same way so a proxy leaking across the
   boundary fails the test instead of failing silently in the app. */
function createPinsBridge(initial: Record<string, string[]> = {}) {
  const stored = { version: 1 as const, organizations: initial, repositoryPins: {} }
  const updates: Array<{ login: string; organizations: string[] }> = []

  return {
    updates,
    get: vi.fn(async () => structuredClone({ path: 'pins.json', hasContent: false, pins: stored })),
    setOrganizationPins: vi.fn(async (payload: { login: string; organizations: string[] }) => {
      const cloned = structuredClone(payload)
      updates.push(cloned)
      stored.organizations = { ...stored.organizations, [cloned.login]: cloned.organizations }
      return structuredClone({ path: 'pins.json', hasContent: true, pins: stored })
    })
  }
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('usePinnedOrganizations', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores pins for the lowercased account login', async () => {
    const bridge = createPinsBridge({ acbox: ['vuejs'] })
    vi.stubGlobal('window', { ohMyGithub: { pins: bridge } })

    const { pinnedOrganizationLogins } = usePinnedOrganizations(() => 'Acbox')
    await flushAsync()

    expect(pinnedOrganizationLogins.value).toEqual(['vuejs'])
  })

  it('persists toggled pins through the structured-clone boundary', async () => {
    const bridge = createPinsBridge()
    vi.stubGlobal('window', { ohMyGithub: { pins: bridge } })

    const { pinnedOrganizationLogins, toggleOrganizationPin } = usePinnedOrganizations(() => 'Acbox')
    await flushAsync()

    toggleOrganizationPin('vuejs')
    toggleOrganizationPin('electron')
    await flushAsync()

    expect(pinnedOrganizationLogins.value).toEqual(['electron', 'vuejs'])
    expect(bridge.updates).toEqual([
      { login: 'acbox', organizations: ['vuejs'] },
      { login: 'acbox', organizations: ['electron', 'vuejs'] }
    ])
  })

  it('ignores toggles without a signed-in account', async () => {
    const bridge = createPinsBridge()
    vi.stubGlobal('window', { ohMyGithub: { pins: bridge } })

    const { pinnedOrganizationLogins, toggleOrganizationPin } = usePinnedOrganizations(() => null)
    await flushAsync()

    toggleOrganizationPin('vuejs')
    await flushAsync()

    expect(pinnedOrganizationLogins.value).toEqual([])
    expect(bridge.setOrganizationPins).not.toHaveBeenCalled()
  })
})
