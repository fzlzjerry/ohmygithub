import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { ipcMain } from 'electron'

export interface LocalConfig {
  schemaVersion: 1
  github: {
    activeAccountLogin: string | null
  }
  ui: {
    locale: 'en' | 'zh'
    theme: 'auto' | 'light' | 'dark'
  }
}

export interface LocalConfigInfo {
  path: string
  config: LocalConfig
}

export type LocalConfigPatch = Partial<{
  github: Partial<LocalConfig['github']>
  ui: Partial<LocalConfig['ui']>
}>

const configPath = join(homedir(), '.oh-my-github', 'config.json')

export function initializeConfig(): LocalConfigInfo {
  const config = readConfig()
  writeConfig(config)

  return {
    path: configPath,
    config
  }
}

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', () => initializeConfig())
  ipcMain.handle('config:update', (_event, patch: LocalConfigPatch) => {
    const config = mergeConfig(readConfig(), patch)
    writeConfig(config)

    return {
      path: configPath,
      config
    }
  })
}

function readConfig(): LocalConfig {
  try {
    const raw = readFileSync(configPath, 'utf8')
    return normalizeConfig(JSON.parse(raw) as Partial<LocalConfig>)
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultConfig()
    }

    throw error
  }
}

function writeConfig(config: LocalConfig): void {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function mergeConfig(config: LocalConfig, patch: LocalConfigPatch): LocalConfig {
  return normalizeConfig({
    ...config,
    github: {
      ...config.github,
      ...patch.github
    },
    ui: {
      ...config.ui,
      ...patch.ui
    }
  })
}

function normalizeConfig(config: Partial<LocalConfig>): LocalConfig {
  return {
    schemaVersion: 1,
    github: {
      activeAccountLogin: config.github?.activeAccountLogin ?? null
    },
    ui: {
      locale: normalizeLocale(config.ui?.locale),
      theme: normalizeTheme(config.ui?.theme)
    }
  }
}

function defaultConfig(): LocalConfig {
  return {
    schemaVersion: 1,
    github: {
      activeAccountLogin: null
    },
    ui: {
      locale: 'en',
      theme: 'auto'
    }
  }
}

function normalizeLocale(value: unknown): LocalConfig['ui']['locale'] {
  return value === 'zh' ? 'zh' : 'en'
}

function normalizeTheme(value: unknown): LocalConfig['ui']['theme'] {
  if (value === 'light' || value === 'dark') {
    return value
  }

  return 'auto'
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}
