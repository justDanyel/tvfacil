import { useCallback, useEffect, useState } from 'react'
import { MainTabs, type MainTab } from './components/MainTabs'
import { normalizeStoredVolume } from './components/SoundControls'
import { fetchM3uFromUrl, parseM3u } from './lib/m3u'
import { MOCK_CHANNELS } from './lib/mockChannels'
import {
  clearCredentials,
  loadCredentials,
  loadSettings,
  readTextFile,
  saveCredentials,
  saveSettings,
} from './lib/storage'
import type { AppSettings, Channel, Credentials, QualityId } from './lib/types'
import { preferCompatibleChannel } from './lib/channelMatch'
import { fetchXtreamLiveChannels } from './lib/xtream'
import { ChannelGridScreen } from './screens/ChannelGridScreen'
import { FootballScreen } from './screens/FootballScreen'
import { PlayerScreen } from './screens/PlayerScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

const DEFAULT_SETTINGS: AppSettings = {
  lastQuality: 'maxima',
  lastVolume: 0.7,
  favorites: [],
}

type Route = 'boot' | 'welcome' | 'home' | 'player'

function sourceLabel(creds: Credentials): string {
  if (creds.kind === 'demo') return 'Demonstração'
  if (creds.kind === 'xtream') return 'Conta Xtream'
  return 'Lista M3U'
}

export default function App() {
  const [route, setRoute] = useState<Route>('boot')
  const [mainTab, setMainTab] = useState<MainTab>('channels')
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [active, setActive] = useState<Channel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [savedCreds, savedSettings] = await Promise.race([
          Promise.all([loadCredentials(), loadSettings()]),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000),
          ),
        ])
        if (cancelled) return
        setSettings({
          ...DEFAULT_SETTINGS,
          ...savedSettings,
          lastVolume: normalizeStoredVolume(savedSettings.lastVolume),
        })
        if (savedCreds) {
          setCreds(savedCreds)
          try {
            const list = await Promise.race([
              loadChannels(savedCreds),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 45000),
              ),
            ])
            if (cancelled) return
            setChannels(list)
            setRoute('home')
            return
          } catch {
            // Fall through to welcome if saved source fails
          }
        }
      } catch {
        // Storage/IPC hang — still show welcome
      }
      if (!cancelled) setRoute('welcome')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistSettings = useCallback(async (next: AppSettings) => {
    setSettings(next)
    await saveSettings(next)
  }, [])

  const onConnect = async (next: Credentials) => {
    setBusy(true)
    setError(null)
    try {
      const list = await loadChannels(next)
      await saveCredentials(next)
      setCreds(next)
      setChannels(list)
      setMainTab('channels')
      setRoute('home')
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Não foi possível ligar. Verifique os dados e tente de novo.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    await clearCredentials()
    setCreds(null)
    setChannels([])
    setActive(null)
    setError(null)
    setMainTab('channels')
    setRoute('welcome')
  }

  const onToggleFavorite = (channel: Channel) => {
    const has = settings.favorites.includes(channel.id)
    const favorites = has
      ? settings.favorites.filter((id) => id !== channel.id)
      : [...settings.favorites, channel.id]
    void persistSettings({ ...settings, favorites })
  }

  const onQualityPersist = useCallback((q: QualityId) => {
    setSettings((prev) => {
      if (prev.lastQuality === q) return prev
      const next = { ...prev, lastQuality: q }
      void saveSettings(next)
      return next
    })
  }, [])

  const onVolumePersist = useCallback((v: number) => {
    setSettings((prev) => {
      if (prev.lastVolume === v) return prev
      const next = { ...prev, lastVolume: v }
      void saveSettings(next)
      return next
    })
  }, [])

  const playChannel = (ch: Channel) => {
    // Full HD / HEVC often fails to decode in Electron — prefer HD sibling
    setActive(preferCompatibleChannel(ch, channels))
    setRoute('player')
  }

  if (route === 'boot') {
    return (
      <div className="boot">
        <p className="boot__brand">TvFácil</p>
        <p>A preparar…</p>
      </div>
    )
  }

  if (route === 'welcome') {
    return (
      <WelcomeScreen initial={creds} busy={busy} error={error} onConnect={onConnect} />
    )
  }

  if (route === 'player' && active) {
    return (
      <PlayerScreen
        channel={active}
        initialQuality={(settings.lastQuality as QualityId) || 'maxima'}
        initialVolume={normalizeStoredVolume(settings.lastVolume)}
        onBack={() => {
          setActive(null)
          setRoute('home')
        }}
        onQualityPersist={onQualityPersist}
        onVolumePersist={onVolumePersist}
      />
    )
  }

  return (
    <div className="home-shell">
      <MainTabs value={mainTab} onChange={setMainTab} />
      {mainTab === 'football' ? (
        <FootballScreen
          channels={channels}
          xtream={
            creds?.kind === 'xtream' && creds.server && creds.username && creds.password
              ? { server: creds.server, username: creds.username, password: creds.password }
              : null
          }
          onPlay={playChannel}
          onLogout={onLogout}
        />
      ) : (
        <ChannelGridScreen
          channels={channels}
          favorites={settings.favorites}
          sourceLabel={creds ? sourceLabel(creds) : ''}
          onPlay={playChannel}
          onToggleFavorite={onToggleFavorite}
          onLogout={onLogout}
        />
      )}
    </div>
  )
}

async function loadChannels(creds: Credentials): Promise<Channel[]> {
  if (creds.kind === 'demo') return MOCK_CHANNELS

  if (creds.kind === 'xtream') {
    if (!creds.server || !creds.username || !creds.password) {
      throw new Error('Preencha servidor, utilizador e palavra-passe.')
    }
    return fetchXtreamLiveChannels({
      server: creds.server,
      username: creds.username,
      password: creds.password,
    })
  }

  if (creds.kind === 'm3u') {
    let text = ''
    if (creds.m3uPath) {
      text = await readTextFile(creds.m3uPath)
    } else if (creds.m3uUrl) {
      text = await fetchM3uFromUrl(creds.m3uUrl)
    } else {
      throw new Error('Indique um URL ou um ficheiro M3U.')
    }
    const list = parseM3u(text)
    if (list.length === 0) throw new Error('A playlist não tem canais reconhecidos.')
    return list
  }

  throw new Error('Tipo de fonte desconhecido.')
}
