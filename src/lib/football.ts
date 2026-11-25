export type MatchPhase = 'live' | 'soon' | 'scheduled' | 'finished' | 'other'

export interface FootballMatch {
  id: string
  league: string
  leagueSlug: string
  kickoff: string
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  homeScore: string | null
  awayScore: string | null
  clock?: string
  statusText: string
  phase: MatchPhase
  minutesToKickoff: number | null
  /** Broadcaster names when the feed provides them */
  broadcasts?: string[]
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  team?: {
    displayName?: string
    shortDisplayName?: string
    logo?: string
  }
}

interface EspnEvent {
  id: string
  date: string
  competitions?: Array<{
    date?: string
    startDate?: string
    status?: {
      displayClock?: string
      type?: {
        name?: string
        state?: string
        completed?: boolean
        description?: string
        shortDetail?: string
        detail?: string
      }
    }
    competitors?: EspnCompetitor[]
    broadcasts?: Array<{ names?: string[]; market?: string }>
    geoBroadcasts?: Array<{ media?: { shortName?: string }; lang?: string; region?: string }>
  }>
  status?: {
    displayClock?: string
    type?: {
      name?: string
      state?: string
      completed?: boolean
      shortDetail?: string
      description?: string
    }
  }
}

interface EspnScoreboard {
  leagues?: Array<{ name?: string; midsizeName?: string; slug?: string }>
  events?: EspnEvent[]
}

const LEAGUES: { slug: string; label: string }[] = [
  { slug: 'por.1', label: 'Liga Portugal' },
  { slug: 'uefa.champions', label: 'Champions League' },
  { slug: 'uefa.europa', label: 'Europa League' },
  { slug: 'eng.1', label: 'Premier League' },
  { slug: 'esp.1', label: 'La Liga' },
  { slug: 'ita.1', label: 'Serie A' },
  { slug: 'ger.1', label: 'Bundesliga' },
  { slug: 'fra.1', label: 'Ligue 1' },
]

const SOON_WINDOW_MS = 30 * 60 * 1000

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function mapEvent(event: EspnEvent, leagueLabel: string, leagueSlug: string, now: number): FootballMatch | null {
  const comp = event.competitions?.[0]
  if (!comp) return null
  const home = comp.competitors?.find((c) => c.homeAway === 'home')
  const away = comp.competitors?.find((c) => c.homeAway === 'away')
  if (!home?.team?.displayName || !away?.team?.displayName) return null

  const kickoff = comp.startDate || comp.date || event.date
  const kickoffMs = Date.parse(kickoff)
  if (Number.isNaN(kickoffMs)) return null

  const status = comp.status ?? event.status
  const state = status?.type?.state
  const completed = !!status?.type?.completed
  const delta = kickoffMs - now

  let phase: MatchPhase = 'other'
  let minutesToKickoff: number | null = null

  if (state === 'in') {
    phase = 'live'
  } else if (completed || state === 'post') {
    phase = 'finished'
  } else if (delta > 0 && delta <= SOON_WINDOW_MS) {
    phase = 'soon'
    minutesToKickoff = Math.max(1, Math.round(delta / 60000))
  } else if (delta > SOON_WINDOW_MS) {
    phase = 'scheduled'
    minutesToKickoff = Math.round(delta / 60000)
  } else if (delta <= 0 && delta > -3 * 60 * 60 * 1000) {
    // Kickoff passed but ESPN not yet "in"/"post"
    phase = 'live'
    minutesToKickoff = 0
  }

  const showScore = phase === 'live' || phase === 'finished'
  const clock = status?.displayClock && phase === 'live' ? status.displayClock : undefined
  const statusText =
    phase === 'live'
      ? clock && clock !== '0' && clock !== "0'"
        ? `Ao vivo · ${clock}`
        : 'Ao vivo'
      : phase === 'soon'
        ? `Começa em ${minutesToKickoff} min`
        : phase === 'finished'
          ? 'Terminado'
          : new Date(kickoffMs).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  const broadcastNames = new Set<string>()
  // ESPN scoreboard is US-centric (Paramount+, etc.) — ignore those for Portugal
  const ignoreUs = /paramount|peacock|fubo|sling|youtube\s*tv|espn\+|apple\s*tv\+|cbs|nbc|fox\s*sports|live\s*mode/i
  for (const b of comp.broadcasts ?? []) {
    for (const n of b.names ?? []) {
      if (n && !ignoreUs.test(n)) broadcastNames.add(n)
    }
  }
  for (const g of comp.geoBroadcasts ?? []) {
    const n = g.media?.shortName
    const region = (g.region || '').toLowerCase()
    if (n && (region === 'pt' || region === 'portugal') && !ignoreUs.test(n)) broadcastNames.add(n)
  }

  return {
    id: event.id,
    league: leagueLabel,
    leagueSlug,
    kickoff,
    home: home.team.displayName,
    away: away.team.displayName,
    homeLogo: home.team.logo,
    awayLogo: away.team.logo,
    homeScore: showScore ? (home.score ?? '0') : null,
    awayScore: showScore ? (away.score ?? '0') : null,
    clock,
    statusText,
    phase,
    minutesToKickoff,
    broadcasts: broadcastNames.size ? Array.from(broadcastNames) : undefined,
  }
}

async function fetchLeagueDay(slug: string, label: string, date: string, now: number): Promise<FootballMatch[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}&limit=100`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = (await res.json()) as EspnScoreboard
  const leagueName = json.leagues?.[0]?.name || label
  const out: FootballMatch[] = []
  for (const event of json.events ?? []) {
    const mapped = mapEvent(event, leagueName, slug, now)
    if (mapped) out.push(mapped)
  }
  return out
}

/** Fetch today's (and nearby) football matches across main European leagues. */
export async function fetchFootballMatches(): Promise<FootballMatch[]> {
  const now = Date.now()
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const dates = [ymd(yesterday), ymd(today), ymd(tomorrow)]
  const tasks: Promise<FootballMatch[]>[] = []
  for (const league of LEAGUES) {
    for (const date of dates) {
      tasks.push(fetchLeagueDay(league.slug, league.label, date, now))
    }
  }

  const batches = await Promise.allSettled(tasks)
  const byId = new Map<string, FootballMatch>()
  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue
    for (const match of batch.value) byId.set(match.id, match)
  }

  const list = Array.from(byId.values()).sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))

  // Portugal TV listings (Flashscore) — Sport TV / DAZN / etc.
  try {
    const { enrichMatchesWithFlashscoreTv } = await import('./broadcastLookup')
    return await enrichMatchesWithFlashscoreTv(list)
  } catch {
    return list
  }
}

export function splitFootballSections(matches: FootballMatch[]) {
  const spotlight = matches.filter((m) => m.phase === 'live' || m.phase === 'soon')
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const today = matches.filter((m) => {
    const t = Date.parse(m.kickoff)
    return t >= todayStart.getTime() && t < todayEnd.getTime()
  })

  return { spotlight, today }
}
