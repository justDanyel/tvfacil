import type { AppSettings, Credentials } from './types'

const browserCredKey = 'tvfacil.credentials'
const browserSettingsKey = 'tvfacil.settings'

function hasApi() {
  return typeof window !== 'undefined' && !!window.tvfacil
}

export async function loadCredentials(): Promise<Credentials | null> {
  if (hasApi()) return window.tvfacil!.loadCredentials()
  try {
    const raw = localStorage.getItem(browserCredKey)
    return raw ? (JSON.parse(raw) as Credentials) : null
  } catch {
    return null
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  if (hasApi()) {
    await window.tvfacil!.saveCredentials(creds)
    return
  }
  localStorage.setItem(browserCredKey, JSON.stringify(creds))
}

export async function clearCredentials(): Promise<void> {
  if (hasApi()) {
    await window.tvfacil!.clearCredentials()
    return
  }
  localStorage.removeItem(browserCredKey)
}

const DEFAULT_SETTINGS: AppSettings = {
  lastQuality: 'maxima',
  lastVolume: 0.7,
  favorites: [],
}

function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(partial ?? {}) }
  const rawVol = merged.lastVolume as unknown
  if (typeof rawVol !== 'number') {
    if (rawVol === 'mudo') merged.lastVolume = 0
    else if (rawVol === 'baixo') merged.lastVolume = 0.35
    else if (rawVol === 'alto') merged.lastVolume = 1
    else merged.lastVolume = 0.7
  }
  return merged
}

export async function loadSettings(): Promise<AppSettings> {
  if (hasApi()) {
    const saved = await window.tvfacil!.loadSettings()
    return mergeSettings(saved as Partial<AppSettings>)
  }
  try {
    const raw = localStorage.getItem(browserSettingsKey)
    if (raw) return mergeSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (hasApi()) {
    await window.tvfacil!.saveSettings(settings)
    return
  }
  localStorage.setItem(browserSettingsKey, JSON.stringify(settings))
}

export async function pickM3uFile(): Promise<string | null> {
  if (hasApi()) return window.tvfacil!.openM3uDialog()
  return null
}

export async function readTextFile(filePath: string): Promise<string> {
  if (hasApi()) return window.tvfacil!.readTextFile(filePath)
  throw new Error('Leitura de ficheiros só está disponível na aplicação Windows.')
}
