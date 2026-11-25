import { contextBridge, ipcRenderer } from 'electron'

export type SourceKind = 'xtream' | 'm3u' | 'demo'

export interface StoredCredentials {
  kind: SourceKind
  server?: string
  username?: string
  password?: string
  m3uUrl?: string
  m3uPath?: string
}

export interface AppSettings {
  lastQuality: string
  lastVolume: number | string
  favorites: string[]
}

const api = {
  loadCredentials: (): Promise<StoredCredentials | null> =>
    ipcRenderer.invoke('credentials:load'),
  saveCredentials: (creds: StoredCredentials): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('credentials:save', creds),
  clearCredentials: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('credentials:clear'),
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('settings:save', settings),
  openM3uDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openM3u'),
  readTextFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readText', filePath),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),
}

contextBridge.exposeInMainWorld('tvfacil', api)

export type TvFacilApi = typeof api
