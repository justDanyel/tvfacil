import { useEffect, useRef, useState } from 'react'
import { LagBanner } from '../components/LagBanner'
import { QualitySelector } from '../components/QualitySelector'
import { SoundControls, normalizeStoredVolume } from '../components/SoundControls'
import { createPlayerEngine } from '../lib/playerEngine'
import { QUALITY_RANK, type Channel, type QualityId } from '../lib/types'

interface Props {
  channel: Channel
  initialQuality: QualityId
  initialVolume?: number
  onBack: () => void
  onQualityPersist: (q: QualityId) => void
  onVolumePersist: (v: number) => void
}

function pickUrl(channel: Channel, quality: QualityId): string {
  return channel.streams?.[quality] || channel.url
}

function pickFallback(channel: Channel, primary: string): string | undefined {
  if (channel.fallbackUrl && channel.fallbackUrl !== primary) return channel.fallbackUrl
  const others = Object.values(channel.streams ?? {}).filter((u) => u && u !== primary)
  return others[0]
}

function lowerQuality(current: QualityId): QualityId | null {
  const i = QUALITY_RANK.indexOf(current)
  if (i < 0 || i >= QUALITY_RANK.length - 1) return null
  return QUALITY_RANK[i + 1]
}

export function PlayerScreen({
  channel,
  initialQuality,
  initialVolume = 0.7,
  onBack,
  onQualityPersist,
  onVolumePersist,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef(createPlayerEngine())
  const [quality, setQuality] = useState<QualityId>(initialQuality)
  const [volume, setVolume] = useState(() => normalizeStoredVolume(initialVolume))
  const [muted, setMuted] = useState(false)
  const [lagging, setLagging] = useState(false)
  const [dismissedLag, setDismissedLag] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [playError, setPlayError] = useState<string | null>(null)
  const qualityReady = useRef(false)
  const volumeBeforeMute = useRef(normalizeStoredVolume(initialVolume) || 0.7)

  useEffect(() => {
    const engine = engineRef.current
    engine.onLag((v) => {
      if (v) setLagging(true)
    })
    engine.onError((msg) => setPlayError(msg))
    return () => engine.destroy()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    qualityReady.current = false
    setPlayError(null)
    setLagging(false)
    setDismissedLag(false)
    const primary = pickUrl(channel, quality)
    engineRef.current.attach(video, primary, quality, pickFallback(channel, primary))
    video.volume = volume
    video.muted = muted || volume === 0
    // Attach once per channel; quality changes handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel])

  useEffect(() => {
    if (!qualityReady.current) {
      qualityReady.current = true
      onQualityPersist(quality)
      return
    }
    engineRef.current.setQuality(quality)
    onQualityPersist(quality)
  }, [quality, onQualityPersist])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted || volume === 0
    onVolumePersist(volume)
  }, [volume, muted, onVolumePersist])

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleMute = () => {
    setMuted((wasMuted) => {
      if (wasMuted) {
        setVolume((v) => (v === 0 ? volumeBeforeMute.current || 0.7 : v))
        return false
      }
      setVolume((v) => {
        if (v > 0) volumeBeforeMute.current = v
        return v
      })
      return true
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onBack()
      } else if (e.key === 'm') {
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const toggleFullscreen = async () => {
    const root = videoRef.current?.closest('.player') as HTMLElement | null
    if (!root) return
    if (!document.fullscreenElement) {
      await root.requestFullscreen().catch(() => undefined)
    } else {
      await document.exitFullscreen().catch(() => undefined)
    }
  }

  const acceptStable = () => {
    const next = lowerQuality(quality)
    if (next) {
      setQuality(next)
      setLagging(false)
      setDismissedLag(false)
    } else {
      setDismissedLag(true)
    }
  }

  return (
    <div className={`player${fullscreen ? ' is-fs' : ''}`}>
      <header className="player__bar">
        <button type="button" className="btn btn--ghost btn--large player__back" onClick={onBack}>
          ← Lista de canais
        </button>
        <h1 className="player__title">{channel.name}</h1>
        <button type="button" className="btn btn--secondary btn--large" onClick={toggleFullscreen}>
          {fullscreen ? 'Sair do ecrã cheio' : 'Ecrã cheio'}
        </button>
      </header>

      <div className="player__stage">
        <video ref={videoRef} className="player__video" playsInline autoPlay />

        {playError ? (
          <div className="player__error" role="alert">
            <p>{playError}</p>
            <button
              type="button"
              className="btn btn--primary btn--large"
              onClick={() => {
                setPlayError(null)
                engineRef.current.retryPlay()
              }}
            >
              Reproduzir
            </button>
          </div>
        ) : null}
        <LagBanner
          visible={lagging && !dismissedLag}
          onAccept={acceptStable}
          onDismiss={() => setDismissedLag(true)}
        />
      </div>

      <div className="player__controls">
        <SoundControls
          value={volume}
          muted={muted}
          onChange={(next) => {
            setVolume(next)
            if (next > 0) {
              volumeBeforeMute.current = next
              setMuted(false)
            }
          }}
          onMuteToggle={toggleMute}
        />
        <QualitySelector
          value={quality}
          onChange={(q) => {
            setQuality(q)
            setLagging(false)
            setDismissedLag(false)
            setPlayError(null)
          }}
        />
      </div>
    </div>
  )
}
