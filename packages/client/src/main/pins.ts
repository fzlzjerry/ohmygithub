import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { ipcMain } from 'electron'

export interface StoredPins {
  version: 1
  organizations: string[]
}

export interface StoredPinsInfo {
  path: string
  hasContent: boolean
  pins: StoredPins
}

export const pinsFilePath = join(homedir(), '.oh-my-github', 'pins.json')

export function registerPinsIpc(): void {
  ipcMain.handle('pins:get', () => readPinsInfo())
  ipcMain.handle('pins:update', (_event, payload: StoredPins) => {
    const pins = normalizePins(payload)
    writePins(pins)

    return {
      path: pinsFilePath,
      hasContent: hasPinsContent(pins),
      pins
    }
  })
}

function readPinsInfo(): StoredPinsInfo {
  const pins = readPins()

  return {
    path: pinsFilePath,
    hasContent: hasPinsContent(pins),
    pins
  }
}

export function readPins(): StoredPins {
  try {
    const raw = readFileSync(pinsFilePath, 'utf8')
    if (!raw.trim()) {
      const pins = defaultPins()
      writePins(pins)
      return pins
    }

    return normalizePins(JSON.parse(raw) as Partial<StoredPins>)
  } catch (error) {
    if (isMissingFileError(error)) {
      const pins = defaultPins()
      writePins(pins)
      return pins
    }

    throw error
  }
}

function writePins(pins: StoredPins): void {
  mkdirSync(dirname(pinsFilePath), { recursive: true })
  writeFileSync(pinsFilePath, `${JSON.stringify(pins, null, 2)}\n`, 'utf8')
}

export function normalizePins(value: unknown): StoredPins {
  if (!isRecord(value)) return defaultPins()

  const organizations = Array.isArray(value.organizations)
    ? dedupeLogins(
      value.organizations.filter((login): login is string => typeof login === 'string' && login.trim().length > 0)
    )
    : []

  return {
    version: 1,
    organizations
  }
}

function dedupeLogins(logins: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const login of logins) {
    if (seen.has(login)) continue
    seen.add(login)
    result.push(login)
  }

  return result
}

function defaultPins(): StoredPins {
  return {
    version: 1,
    organizations: []
  }
}

function hasPinsContent(pins: StoredPins): boolean {
  return pins.organizations.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}
