export type SourceKind = 'xtream' | 'm3u' | 'demo'

export type QualityId = 'maxima' | 'boa' | 'media' | 'poupar'

export interface Channel {
  id: string
  name: string
  logo?: string
  category?: string
  url: string
  /** Optional alternate stream URLs keyed by quality */
  streams?: Partial<Record<QualityId, string>>
  /** Backup URL if primary fails (e.g. .ts → .m3u8) */
  fallbackUrl?: string
  /** Xtream live stream id (for EPG lookup) */
  xtreamStreamId?: string
}

export interface Credentials {
  kind: SourceKind
  server?: string
  username?: string
  password?: string
  m3uUrl?: string
  m3uPath?: string
}

export interface AppSettings {
  lastQuality: string
  /** 0–1 volume level */
  lastVolume: number
  favorites: string[]
}

export const QUALITY_OPTIONS: { id: QualityId; label: string }[] = [
  { id: 'maxima', label: 'Qualidade Máxima' },
  { id: 'boa', label: 'Boa qualidade' },
  { id: 'media', label: 'Qualidade média' },
  { id: 'poupar', label: 'Poupar dados' },
]

export const QUALITY_RANK: QualityId[] = ['maxima', 'boa', 'media', 'poupar']
