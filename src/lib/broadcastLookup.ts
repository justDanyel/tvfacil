import type { FootballMatch } from './football'

/** Flashscore public feed key used by their web client. */
const FSIGN = 'SW9D1eZo'
const FEED_BASE = 'https://global.flashscore.ninja/2/x/feed'

export interface BroadcastInfo {
  /** Clean names for IPTV matching, e.g. "Sport TV 5", "DAZN 1" */
  channels: string[]
  /** Raw Flashscore labels */
  raw: string[]
  source: 'flashscore'
}

interface FsMatch {
  id: string
  home: string
  away: string
  kickoffSec: number
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Map common Flashscore abbreviations to ESPN-style names. */
const NAME_ALIASES: Record<string, string[]> = {
  'atl madrid': ['atletico madrid', 'atletico'],
  'man utd': ['manchester united', 'manchester utd'],
  'manchester utd': ['manchester united'],
  'man city': ['manchester city'],
  inter: ['internazionale', 'inter milan'],
  'bodo glimt': ['bodo/glimt', 'bodoe glimt'],
  'rb leipzig': ['leipzig'],
  'slavia prague': ['slavia praha', 'slavia'],
  'sporting cp': ['sporting'],
  'fc porto': ['porto'],
  'as roma': ['roma'],
  'bayern': ['bayern munich', 'bayern munchen'],
  'psg': ['paris saint germain', 'paris sg'],
  'sabah fc': ['sabah fk', 'sabah'],
  viking: ['viking fk'],
}

function teamTokens(name: string): string[] {
  const n = normalize(name)
  const extras = NAME_ALIASES[n] ?? []
  const parts = n.split(' ').filter((t) => t.length >= 3)
  return Array.from(new Set([n, ...extras, ...parts]))
}

function teamsLikelySame(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const ta = teamTokens(a)
  const tb = new Set(teamTokens(b))
  let hits = 0
  for (const t of ta) {
    if (t.length < 4) continue
    if (tb.has(t) || [...tb].some((x) => x.includes(t) || t.includes(x))) hits += 1
  }
  return hits >= 1 && (na.split(' ')[0] === nb.split(' ')[0] || hits >= 2 || ta.some((t) => t.length >= 7 && tb.has(t)))
}

function isYouthOrWomen(name: string): boolean {
  return /\b(u1\d|u2\d|u23|youth|women|\bW\b|feminino|femininas)\b/i.test(name)
}

function feedUrl(path: string): string {
  // Vite dev proxy avoids CORS when testing in a normal browser tab
  if (typeof window !== 'undefined' && window.location.port === '5199') {
    return `/fs-feed/${path}`
  }
  return `${FEED_BASE}/${path}`
}

async function fetchFeed(path: string): Promise<string> {
  try {
    const res = await fetch(feedUrl(path), {
      headers: {
        'X-Fsign': FSIGN,
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

/** Parse Flashscore day feed into senior football matches. */
export function parseFlashscoreDayFeed(raw: string): FsMatch[] {
  if (!raw) return []
  const out: FsMatch[] = []
  const parts = raw.split(/~AA÷/)
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i]
    const id = block.slice(0, 8)
    if (!/^[A-Za-z0-9]{8}$/.test(id)) continue
    const home = block.match(/AE÷([^¬]+)/)?.[1]
    const away = block.match(/AF÷([^¬]+)/)?.[1]
    const kick = block.match(/AD÷(\d+)/)?.[1]
    if (!home || !away || !kick) continue
    if (isYouthOrWomen(home) || isYouthOrWomen(away)) continue
    out.push({ id, home, away, kickoffSec: Number(kick) })
  }
  return out
}

function cleanBroadcasterName(raw: string): string | null {
  let n = raw.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  // Drop generic app-only rows when a numbered channel exists
  if (/^dazn\s*\/\s*app$/i.test(n)) return null
  if (/^dazn portugal$/i.test(n)) return 'DAZN'
  n = n.replace(/\s+/g, ' ').trim()
  return n || null
}

/** TV / streaming labels for one Flashscore match (Portugal market). */
export async function fetchFlashscoreTv(matchId: string): Promise<BroadcastInfo | null> {
  const raw = await fetchFeed(`df_dos_1_${matchId}_`)
  if (!raw) return null
  const m = raw.match(/AL÷(\{[\s\S]*?\})¬/)
  if (!m) return null
  try {
    const json = JSON.parse(m[1]) as Record<string, Array<{ BN?: string }>>
    const rows = Object.values(json).flat()
    const rawNames = rows.map((r) => r.BN).filter((x): x is string => !!x)
    const channels = Array.from(
      new Set(rawNames.map(cleanBroadcasterName).filter((x): x is string => !!x)),
    )
    if (!channels.length) return null
    return { channels, raw: rawNames, source: 'flashscore' }
  } catch {
    return null
  }
}

let dayCache: { at: number; matches: FsMatch[] } | null = null
const tvCache = new Map<string, BroadcastInfo | null>()

async function loadFlashscoreDays(): Promise<FsMatch[]> {
  const now = Date.now()
  if (dayCache && now - dayCache.at < 5 * 60_000) return dayCache.matches

  // day offsets: yesterday / today / tomorrow (Flashscore uses middle segment)
  const paths = ['f_1_-1_8_pt_1', 'f_1_0_8_pt_1', 'f_1_1_8_pt_1']
  const texts = await Promise.all(paths.map((p) => fetchFeed(p)))
  const byId = new Map<string, FsMatch>()
  for (const text of texts) {
    for (const row of parseFlashscoreDayFeed(text)) byId.set(row.id, row)
  }
  const matches = Array.from(byId.values())
  dayCache = { at: now, matches }
  return matches
}

function findFlashscoreMatch(match: FootballMatch, pool: FsMatch[]): FsMatch | null {
  const kick = Date.parse(match.kickoff)
  let best: FsMatch | null = null
  let bestScore = 0
  for (const fs of pool) {
    const homeOk = teamsLikelySame(match.home, fs.home) || teamsLikelySame(match.home, fs.away)
    const awayOk = teamsLikelySame(match.away, fs.away) || teamsLikelySame(match.away, fs.home)
    if (!homeOk || !awayOk) continue
    // Prefer correct home/away orientation
    let score = 10
    if (teamsLikelySame(match.home, fs.home) && teamsLikelySame(match.away, fs.away)) score += 8
    if (!Number.isNaN(kick)) {
      const deltaH = Math.abs(fs.kickoffSec * 1000 - kick) / 3_600_000
      if (deltaH <= 3) score += 6
      else if (deltaH <= 12) score += 2
      else score -= 4
    }
    if (score > bestScore) {
      bestScore = score
      best = fs
    }
  }
  return bestScore >= 16 ? best : null
}

/**
 * Enrich ESPN fixtures with Portugal TV listings from Flashscore.
 * Merges into `match.broadcasts` (IPTV-friendly names).
 */
export async function enrichMatchesWithFlashscoreTv(
  matches: FootballMatch[],
): Promise<FootballMatch[]> {
  if (matches.length === 0) return matches
  const pool = await loadFlashscoreDays()
  if (pool.length === 0) return matches

  const targets = matches.filter(
    (m) => m.phase === 'live' || m.phase === 'soon' || m.phase === 'scheduled',
  )

  const enriched = await Promise.all(
    matches.map(async (match) => {
      if (!targets.includes(match)) return match
      const fs = findFlashscoreMatch(match, pool)
      if (!fs) return match

      let info = tvCache.get(fs.id)
      if (info === undefined) {
        info = await fetchFlashscoreTv(fs.id)
        tvCache.set(fs.id, info)
      }
      if (!info?.channels.length) return match

      const merged = Array.from(new Set([...(match.broadcasts ?? []), ...info.channels]))
      return { ...match, broadcasts: merged }
    }),
  )

  return enriched
}
