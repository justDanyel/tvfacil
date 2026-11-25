import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
  shell,
  session,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const CREDENTIALS_FILE = 'tvfacil-credentials.bin'
const SETTINGS_FILE = 'tvfacil-settings.json'

type SourceKind = 'xtream' | 'm3u' | 'demo'

interface StoredCredentials {
  kind: SourceKind
  server?: string
  username?: string
  password?: string
  m3uUrl?: string
  m3uPath?: string
}

interface AppSettings {
  lastQuality: string
  lastVolume: number | string
  favorites: string[]
}

function userDataPath(name: string) {
  return path.join(app.getPath('userData'), name)
}

function readSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(userDataPath(SETTINGS_FILE), 'utf8')
    return JSON.parse(raw) as AppSettings
  } catch {
    return { lastQuality: 'maxima', lastVolume: 0.7, favorites: [] }
  }
}

function writeSettings(settings: AppSettings) {
  fs.writeFileSync(userDataPath(SETTINGS_FILE), JSON.stringify(settings, null, 2), 'utf8')
}

function saveCredentials(creds: StoredCredentials) {
  const json = JSON.stringify(creds)
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    fs.writeFileSync(userDataPath(CREDENTIALS_FILE), encrypted)
  } else {
    // Dev fallback when OS keyring is unavailable — still not written to logs
    const payload = Buffer.from(json, 'utf8').toString('base64')
    fs.writeFileSync(userDataPath(CREDENTIALS_FILE + '.b64'), payload, 'utf8')
  }
}

function loadCredentials(): StoredCredentials | null {
  try {
    const encPath = userDataPath(CREDENTIALS_FILE)
    if (fs.existsSync(encPath) && safeStorage.isEncryptionAvailable()) {
      const buf = fs.readFileSync(encPath)
      const json = safeStorage.decryptString(buf)
      return JSON.parse(json) as StoredCredentials
    }
    const b64Path = userDataPath(CREDENTIALS_FILE + '.b64')
    if (fs.existsSync(b64Path)) {
      const payload = fs.readFileSync(b64Path, 'utf8')
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as StoredCredentials
    }
  } catch {
    // Never log credential contents
  }
  return null
}

function clearCredentials() {
  for (const name of [CREDENTIALS_FILE, CREDENTIALS_FILE + '.b64']) {
    const p = userDataPath(name)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

/**
 * IPTV panels/CDNs often block browser Origins and omit CORS headers.
 * Mimic a normal IPTV client and relax CORS for media/playlist requests.
 */
function installIptvNetworkHooks() {
  const ses = session.defaultSession
  const iptvUa = 'VLC/3.0.21 LibVLC/3.0.21'

  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...(details.responseHeaders ?? {}) }
    const set = (name: string, value: string) => {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
      headers[key ?? name] = [value]
    }
    set('Access-Control-Allow-Origin', '*')
    set('Access-Control-Allow-Headers', '*')
    set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
    // Avoid credentialed CORS mismatches on redirects
    const cookieKey = Object.keys(headers).find((k) => k.toLowerCase() === 'access-control-allow-credentials')
    if (cookieKey) delete headers[cookieKey]
    callback({ responseHeaders: headers })
  })

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    const url = details.url.toLowerCase()
    const isStream =
      url.includes('/live/') ||
      url.includes('/hlsr/') ||
      url.includes('.m3u8') ||
      url.includes('.ts') ||
      url.includes('mpegts')

    if (isStream) {
      headers['User-Agent'] = iptvUa
      delete headers['Origin']
      delete headers['Referer']
      delete headers['origin']
      delete headers['referer']
    } else if (url.includes('flashscore.ninja') || url.includes('flashscore.com')) {
      headers['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      headers['X-Fsign'] = 'SW9D1eZo'
    } else if (!headers['User-Agent']) {
      headers['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
    callback({ requestHeaders: headers })
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'TvFácil',
    backgroundColor: '#e8f2f7',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Required to play arbitrary user-configured IPTV origins.
      webSecurity: false,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (isDev && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  installIptvNetworkHooks()

  ipcMain.handle('credentials:load', () => loadCredentials())
  ipcMain.handle('credentials:save', (_e, creds: StoredCredentials) => {
    saveCredentials(creds)
    return { ok: true }
  })
  ipcMain.handle('credentials:clear', () => {
    clearCredentials()
    return { ok: true }
  })

  ipcMain.handle('settings:load', () => readSettings())
  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    writeSettings(settings)
    return { ok: true }
  })

  ipcMain.handle('dialog:openM3u', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolher ficheiro M3U',
      filters: [
        { name: 'Playlists M3U', extensions: ['m3u', 'm3u8'] },
        { name: 'Todos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('fs:readText', async (_e, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') throw new Error('Caminho inválido')
    return fs.readFileSync(filePath, 'utf8')
  })

  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    if (typeof url === 'string' && /^https?:/i.test(url)) {
      await shell.openExternal(url)
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
