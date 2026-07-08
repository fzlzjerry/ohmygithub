import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('quit-and-install window teardown', () => {
  it('releases the close-to-tray guard when the native updater closes windows', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8')

    // macOS installs updates through Electron's native autoUpdater, which closes
    // windows WITHOUT emitting 'before-quit' (it emits 'before-quit-for-update'
    // instead). If nothing flips isQuitting on that event, the close-to-tray
    // handler hides the window, 'window-all-closed' never fires, and the app
    // never restarts into the new version.
    expect(source).toMatch(
      /autoUpdater\.on\(\s*'before-quit-for-update'\s*,\s*\(\)\s*=>\s*\{\s*isQuitting = true/,
    )
  })
})
