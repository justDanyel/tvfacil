import Hls from 'hls.js'
import mpegts from 'mpegts.js'
import type { Player as MpegtsPlayer } from 'mpegts.js'
import type { QualityId } from './types'

export type LagListener = (lagging: boolean) => void
export type ErrorListener = (message: string | null) => void

export interface PlayerHandle {
  attach(video: HTMLVideoElement, url: string, quality: QualityId, fallbackUrl?: string): void
  setQuality(quality: QualityId): void
  destroy(): void
  onLag(cb: LagListener): void
  onError(cb: ErrorListener): void
  retryPlay(): void
}

function looksLikeHls(url: string) {
  return /\.m3u8(\?|$)/i.test(url) || /[?&]type=m3u8\b/i.test(url) || /\/hls\//i.test(url)
}

function looksLikeTs(url: string) {
  if (looksLikeHls(url)) return false
  return (
    /\.ts(\?|$)/i.test(url) ||
    /\/mpegts/i.test(url) ||
    /\/live\/[^/]+\/[^/]+\/\d+(\?|$)/i.test(url)
  )
}

const PROFILE: Record<
  QualityId,
  { maxBuffer: number; abrBandWidthFactor: number; abrBandWidthUpFactor: number }
> = {
  maxima: { maxBuffer: 60, abrBandWidthFactor: 0.95, abrBandWidthUpFactor: 0.8 },
  boa: { maxBuffer: 40, abrBandWidthFactor: 0.8, abrBandWidthUpFactor: 0.7 },
  media: { maxBuffer: 30, abrBandWidthFactor: 0.55, abrBandWidthUpFactor: 0.5 },
  poupar: { maxBuffer: 20, abrBandWidthFactor: 0.35, abrBandWidthUpFactor: 0.35 },
}

export function createPlayerEngine(): PlayerHandle {
  let video: HTMLVideoElement | null = null
  let hls: Hls | null = null
  let tsPlayer: MpegtsPlayer | null = null
  let currentUrl = ''
  let fallbackUrl: string | undefined
  let triedFallback = false
  let currentQuality: QualityId = 'maxima'
  let lagCb: LagListener | null = null
  let errorCb: ErrorListener | null = null
  let waitingSince: number | null = null
  let stallCount = 0
  let lagTimer: ReturnType<typeof setTimeout> | null = null
  let playWatch: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  const notifyLag = (lagging: boolean) => {
    lagCb?.(lagging)
  }

  const notifyError = (message: string | null) => {
    errorCb?.(message)
  }

  const hasPicture = () =>
    !!video &&
    !video.error &&
    (video.readyState >= 2 || video.videoWidth > 0 || video.currentTime > 0.2)

  const tryPlay = () => {
    if (!video) return
    void video.play()
      .then(() => {
        notifyError(null)
      })
      .catch(() => {
        // Autoplay blocked or still buffering — ask for a tap, don't claim the source is offline
        if (hasPicture() || (video && video.readyState >= 2)) {
          notifyError('Toque em «Reproduzir» para começar.')
        }
      })
  }

  const armPlayWatch = () => {
    if (playWatch) clearTimeout(playWatch)
    playWatch = setTimeout(() => {
      if (!video || destroyed) return
      if (hasPicture()) {
        if (video.paused) {
          notifyError('Toque em «Reproduzir» para começar.')
          return
        }
        notifyError(null)
        return
      }
      if (!triedFallback && fallbackUrl && fallbackUrl !== currentUrl) {
        triedFallback = true
        load(fallbackUrl, currentQuality, true)
        return
      }
      notifyError('Não foi possível abrir este canal. Tente «Reproduzir» ou outro canal.')
    }, 18000)
  }

  const onWaiting = () => {
    waitingSince = Date.now()
    if (lagTimer) clearTimeout(lagTimer)
    lagTimer = setTimeout(() => {
      if (waitingSince) {
        stallCount += 1
        if (stallCount >= 3 || Date.now() - waitingSince > 6000) {
          notifyLag(true)
        }
      }
    }, 3500)
  }

  const onPlaying = () => {
    waitingSince = null
    if (lagTimer) {
      clearTimeout(lagTimer)
      lagTimer = null
    }
    if (playWatch) {
      clearTimeout(playWatch)
      playWatch = null
    }
    notifyError(null)
  }

  const onVideoError = () => {
    const code = video?.error?.code
    // MEDIA_ERR_DECODE — Full HD/HEVC often breaks in Chromium
    if (code === 3) {
      tryFallback('Esta qualidade falhou no decode. A tentar outra fonte…')
      return
    }
    tryFallback('Este canal não abriu. A fonte pode estar offline.')
  }

  const detachListeners = () => {
    if (!video) return
    video.removeEventListener('waiting', onWaiting)
    video.removeEventListener('playing', onPlaying)
    video.removeEventListener('canplay', onPlaying)
    video.removeEventListener('loadeddata', tryPlay)
    video.removeEventListener('error', onVideoError)
  }

  const destroyPlayers = () => {
    if (hls) {
      hls.destroy()
      hls = null
    }
    if (tsPlayer) {
      try {
        tsPlayer.pause()
        tsPlayer.unload()
        tsPlayer.detachMediaElement()
        tsPlayer.destroy()
      } catch {
        /* ignore */
      }
      tsPlayer = null
    }
    if (video) {
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch {
        /* ignore */
      }
    }
  }

  const tryFallback = (reason: string) => {
    if (destroyed) return
    if (!triedFallback && fallbackUrl && fallbackUrl !== currentUrl) {
      triedFallback = true
      load(fallbackUrl, currentQuality, true)
      return
    }
    if (hasPicture()) {
      notifyLag(true)
      return
    }
    notifyError(reason)
    notifyLag(true)
  }

  const loadHls = (url: string, q: QualityId) => {
    if (!video) return
    const profile = PROFILE[q]
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: profile.maxBuffer,
      maxMaxBufferLength: profile.maxBuffer + 30,
      maxBufferHole: 1.5,
      abrBandWidthFactor: profile.abrBandWidthFactor,
      abrBandWidthUpFactor: profile.abrBandWidthUpFactor,
      startLevel: q === 'poupar' ? 0 : q === 'media' ? 1 : -1,
      xhrSetup(xhr) {
        xhr.withCredentials = false
      },
    })
    hls.loadSource(url)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      tryPlay()
    })
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) {
        if (data.details === 'bufferStalledError') notifyLag(true)
        return
      }
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls?.startLoad()
        notifyLag(true)
        window.setTimeout(() => {
          if (!hasPicture()) tryFallback('Este canal não abriu. A fonte pode estar offline.')
        }, 4000)
        return
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls?.recoverMediaError()
        notifyLag(true)
        window.setTimeout(() => {
          if (destroyed) return
          if (video?.error || (video && video.currentTime < 0.2 && !hasPicture())) {
            tryFallback('Esta qualidade falhou no decode. A tentar outra fonte…')
          }
        }, 4500)
        return
      }
      tryFallback('Este canal não abriu. A fonte pode estar offline.')
    })
  }

  const loadMpegTs = (url: string) => {
    if (!video) return
    tsPlayer = mpegts.createPlayer(
      {
        type: 'mse',
        isLive: true,
        url,
        cors: true,
        withCredentials: false,
      },
      {
        enableWorker: false,
        enableStashBuffer: true,
        stashInitialSize: 384,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 8,
        liveBufferLatencyMinRemain: 2,
        autoCleanupSourceBuffer: true,
      },
    )
    tsPlayer.attachMediaElement(video)
    tsPlayer.load()
    tsPlayer.on(mpegts.Events.ERROR, () => {
      tryFallback('Este canal não abriu. A fonte pode estar offline.')
    })
    void Promise.resolve(tsPlayer.play()).catch(() => {
      if (!hasPicture()) notifyError('Toque em «Reproduzir» para começar.')
    })
  }

  const load = (url: string, q: QualityId, isFallback = false) => {
    if (!video) return
    destroyPlayers()
    currentUrl = url
    currentQuality = q
    if (!isFallback) triedFallback = false
    stallCount = 0
    notifyLag(false)
    notifyError(null)
    armPlayWatch()

    if (looksLikeHls(url) && Hls.isSupported()) {
      loadHls(url, q)
      return
    }

    if (looksLikeHls(url) && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      tryPlay()
      return
    }

    if ((looksLikeTs(url) || !looksLikeHls(url)) && mpegts.isSupported()) {
      try {
        loadMpegTs(url)
        return
      } catch {
        // Fall through
      }
    }

    video.src = url
    tryPlay()
  }

  return {
    attach(el, url, q, fallback) {
      destroyed = false
      detachListeners()
      video = el
      fallbackUrl = fallback
      triedFallback = false
      video.addEventListener('waiting', onWaiting)
      video.addEventListener('playing', onPlaying)
      video.addEventListener('canplay', onPlaying)
      video.addEventListener('loadeddata', tryPlay)
      video.addEventListener('error', onVideoError)
      load(url, q)
    },
    setQuality(q) {
      currentQuality = q
      if (hls && hls.levels.length > 1) {
        const levels = hls.levels
        const idx =
          q === 'maxima'
            ? levels.length - 1
            : q === 'boa'
              ? Math.max(0, levels.length - 2)
              : q === 'media'
                ? Math.floor(levels.length / 2)
                : 0
        hls.currentLevel = idx
        hls.nextLevel = idx
        notifyLag(false)
        stallCount = 0
        return
      }
      if (currentUrl) load(currentUrl, q)
    },
    destroy() {
      destroyed = true
      detachListeners()
      destroyPlayers()
      if (lagTimer) clearTimeout(lagTimer)
      if (playWatch) clearTimeout(playWatch)
      video = null
    },
    onLag(cb) {
      lagCb = cb
    },
    onError(cb) {
      errorCb = cb
    },
    retryPlay() {
      triedFallback = false
      if (currentUrl) {
        load(currentUrl, currentQuality)
        return
      }
      tryPlay()
    },
  }
}
