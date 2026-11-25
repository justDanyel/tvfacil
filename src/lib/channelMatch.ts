import type { FootballMatch } from './football'
import type { Channel } from './types'
import type { XtreamAuth } from './xtream'
import { fetchShortEpgTitles } from './xtream'

export type MatchConfidence = 'high' | 'medium' | 'low'

export interface ChannelGuess {
  channel: Channel
  score: number
  confidence: MatchConfidence
  reason: string
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

const STOP = new Set(['fc', 'cf', 'sc', 'ac', 'cd', 'rc', 'afc', 'the', 'de', 'da', 'do', 'dos', 'das', 'e', 'and', 'club'])

/** Aliases too short/ambiguous alone (e.g. "atletico" ≠ Atlético Mineiro). */
const WEAK_SOLO = new Set([
  'atletico',
  'atleti',
  'sporting',
  'united',
  'city',
  'real',
  'inter',
  'milan',
  'roma',
  'porto',
  'fener',
])

/** Extra search tokens for common club names (PT + Europe). */
const TEAM_ALIASES: Record<string, string[]> = {
  'sporting cp': ['sporting cp', 'scp', 'sporting lisbon', 'sporting lisboa'],
  'sl benfica': ['benfica'],
  benfica: ['benfica'],
  'fc porto': ['fc porto', 'fcp'],
  porto: ['fc porto', 'fcp'],
  'manchester united': ['man utd', 'man united', 'manchester utd', 'manchester united'],
  'manchester city': ['man city', 'manchester city'],
  'paris saint germain': ['psg', 'paris sg', 'paris saint germain'],
  'paris saint-germain': ['psg', 'paris sg', 'paris saint germain'],
  'bayern munich': ['bayern', 'bayern munchen', 'bayern munich'],
  'atletico madrid': ['atletico madrid', 'atleti', 'atm'],
  'inter milan': ['inter milan', 'internazionale'],
  internazionale: ['inter milan', 'internazionale'],
  liverpool: ['liverpool'],
  barcelona: ['barcelona', 'barca'],
  'real madrid': ['real madrid'],
  arsenal: ['arsenal'],
  chelsea: ['chelsea'],
  juventus: ['juventus', 'juve'],
  'ac milan': ['ac milan'],
  napoli: ['napoli'],
  'borussia dortmund': ['dortmund', 'bvb', 'borussia dortmund'],
  'as roma': ['as roma', 'roma'],
  'club brugge': ['brugge', 'bruges', 'club brugge'],
  'vfb stuttgart': ['stuttgart', 'vfb stuttgart'],
  'shakhtar donetsk': ['shakhtar', 'shakhtar donetsk'],
  fenerbahce: ['fenerbahce'],
  'slavia prague': ['slavia prague', 'slavia praha', 'slavia'],
  villarreal: ['villarreal'],
  'sabah fk': ['sabah'],
  'viking fk': ['viking'],
  feyenoord: ['feyenoord'],
  lille: ['lille'],
}

const SPORT_HINTS = [
  'sport tv',
  'sporttv',
  'eleven',
  'dazn',
  'bein',
  'canal 11',
  'canal11',
  'desporto',
  'soccer',
  'futebol',
  'football',
  'premier sport',
  'sky sport',
  'bt sport',
  'espn',
  'benfica tv',
  'porto canal',
  'sporting tv',
]

/** Preferred channel name fragments by competition (Portugal-oriented). */
const LEAGUE_BROADCASTERS: Record<string, string[]> = {
  'por.1': ['sport tv', 'sporttv', 'canal 11', 'canal11', 'liga portugal'],
  'uefa.champions': ['dazn', 'eleven', 'sport tv', 'sporttv', 'champions'],
  'uefa.europa': ['dazn', 'eleven', 'sport tv', 'sporttv', 'europa'],
  'eng.1': ['eleven', 'premier', 'dazn'],
  'esp.1': ['dazn', 'eleven', 'la liga', 'laliga'],
  'ita.1': ['dazn', 'eleven', 'serie a'],
  'ger.1': ['dazn', 'eleven', 'bundesliga', 'sport tv'],
  'fra.1': ['dazn', 'eleven', 'ligue 1'],
}

const CLUB_CHANNELS: { team: string; channelBits: string[] }[] = [
  { team: 'benfica', channelBits: ['benfica tv'] },
  { team: 'porto', channelBits: ['porto canal'] },
  { team: 'sporting', channelBits: ['sporting tv'] },
]

function teamTokens(name: string): string[] {
  const n = normalize(name)
  const aliases = TEAM_ALIASES[n] ?? []
  const parts = n.split(' ').filter((t) => t.length >= 3 && !STOP.has(t))
  const aliasParts = aliases.flatMap((a) => normalize(a).split(' '))
  return Array.from(new Set([...parts, ...aliasParts])).filter((t) => t.length >= 3)
}

function teamHitScore(hay: string, teamName: string): number {
  const n = normalize(teamName)
  const aliases = TEAM_ALIASES[n] ?? []
  let best = 0
  for (const alias of [n, ...aliases]) {
    const a = normalize(alias)
    if (a.length < 4 || !hay.includes(a)) continue
    const words = a.split(' ').filter(Boolean)
    if (words.length >= 2) {
      best = Math.max(best, 34)
      continue
    }
    // Single-word alias: skip weak/ambiguous tokens used alone
    if (WEAK_SOLO.has(a)) continue
    best = Math.max(best, a.length >= 8 ? 28 : a.length >= 6 ? 20 : 14)
  }
  const tokens = teamTokens(teamName).filter((t) => !WEAK_SOLO.has(t) || t.length >= 8)
  let hits = 0
  for (const token of tokens) {
    if (token.length >= 4 && hay.includes(token)) hits += 1
  }
  if (hits >= 2) best = Math.max(best, 30)
  else if (hits === 1 && tokens.some((t) => t.length >= 6 && hay.includes(t))) best = Math.max(best, 12)

  // "Sporting" in EPG titles usually means Sporting CP (not Sport TV / Sporting TV)
  if (
    (n.includes('sporting') || aliases.some((a) => normalize(a).includes('sporting'))) &&
    /\bsporting\b/.test(hay) &&
    !/sport\s*tv|sporting\s*tv/i.test(hay)
  ) {
    best = Math.max(best, 24)
  }
  // "Porto" alone in "x FC Porto" / "Porto -"
  if (
    (n === 'porto' || n.includes('porto')) &&
    (/\bfc porto\b/.test(hay) || /\bporto\b/.test(hay))
  ) {
    best = Math.max(best, /\bfc porto\b/.test(hay) ? 34 : 18)
  }
  return best
}

/** Score one EPG title against a fixture (live > preview). */
function scoreEpgTitle(title: string, match: FootballMatch): number {
  const hay = normalize(title)
  const homeHit = teamHitScore(hay, match.home)
  const awayHit = teamHitScore(hay, match.away)
  if (!homeHit && !awayHit) return 0

  let score = homeHit + awayHit
  if (homeHit >= 18 && awayHit >= 18) score += 55
  else if (homeHit >= 18 || awayHit >= 18) score += 8

  if (/transmissao em direto|em direto|\blive\b/i.test(title)) score += 28
  if (/antevisao|resumo|rescaldo|magazine|noticias|fora de horas|pausa/i.test(title)) score -= 35
  return score
}

export function isSportsChannel(channel: Channel): boolean {
  const hay = normalize(`${channel.name} ${channel.category ?? ''}`)
  return SPORT_HINTS.some((h) => hay.includes(h)) || /desporto|sport|futebol/i.test(channel.category ?? '')
}

function scoreAgainstText(
  text: string,
  match: FootballMatch,
  channelName: string,
  epgTitles: string[] = [],
): { score: number; reason: string; epgMatched: boolean } {
  const hay = normalize(text)
  const chName = normalize(channelName)
  let score = 0
  const reasons: string[] = []
  let epgMatched = false

  // Primary signal: match teams inside individual EPG programme titles
  let bestEpg = 0
  for (const title of epgTitles) {
    bestEpg = Math.max(bestEpg, scoreEpgTitle(title, match))
  }
  if (bestEpg > 0) {
    score += bestEpg
    // ~ both teams (18+18+55) — one team alone must not claim the channel
    epgMatched = bestEpg >= 80
    if (epgMatched) reasons.push('jogo no EPG')
    else if (bestEpg >= 30) reasons.push('equipa no EPG')
  }

  const homeHit = teamHitScore(hay, match.home)
  const awayHit = teamHitScore(hay, match.away)
  // Channel name itself (event channels), not the joined EPG blob — avoid double count
  const nameOnly = normalize(channelName)
  const nameHome = teamHitScore(nameOnly, match.home)
  const nameAway = teamHitScore(nameOnly, match.away)
  score += nameHome + nameAway
  if (nameHome >= 18 && nameAway >= 18) {
    score += 40
    reasons.push('canal de evento')
  }

  if (/\bvs\b|\bx\b|\bv\b/.test(chName) && nameHome && nameAway) {
    score += 20
  }

  // Flashscore / guide TV broadcaster → IPTV channel (strongest non-EPG signal)
  let broadcastHit = false
  for (const b of match.broadcasts ?? []) {
    const bn = normalize(b)
    if (bn.length < 3) continue
    const bnCore = bn
      .replace(/\b(por|portugal|app|streaming)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!bnCore) continue
    // "sport tv 5" must match channel family, not any Sport TV
    if (chName.includes(bnCore) || (bnCore.length >= 5 && hay.includes(bnCore))) {
      score += 70
      broadcastHit = true
      reasons.push(`Flashscore: ${b}`)
      continue
    }
    // DAZN 1 / DAZN 2 numbered
    const daznNum = bnCore.match(/^dazn\s*(\d+)$/)
    if (daznNum && new RegExp(`dazn\\s*${daznNum[1]}\\b`).test(chName)) {
      score += 70
      broadcastHit = true
      reasons.push(`Flashscore: ${b}`)
      continue
    }
    if (bnCore === 'dazn' && /\bdazn\b/.test(chName) && !/\bdazn\s*\d/.test(chName)) {
      score += 40
      broadcastHit = true
      reasons.push(`Flashscore: ${b}`)
    }
  }
  if (broadcastHit) epgMatched = true

  // Soft league hint only — never enough alone to pick Sport TV 1 for every game
  const prefs = LEAGUE_BROADCASTERS[match.leagueSlug] ?? []
  for (const pref of prefs) {
    if (chName.includes(pref)) {
      score += 4
      break
    }
  }

  if (!match.leagueSlug.startsWith('uefa.')) {
    for (const club of CLUB_CHANNELS) {
      const teamHay = normalize(`${match.home} ${match.away}`)
      if (teamHay.includes(club.team) && club.channelBits.some((b) => chName.includes(b))) {
        score += 16
        reasons.push('canal do clube')
        break
      }
    }
  } else if (/benfica\s*tv|porto\s*canal|sporting\s*tv/i.test(channelName)) {
    // Club channels almost never carry UEFA nights in Portugal
    score -= 45
  }

  // Prefer Chromium-friendly HD; demote Sport TV + (often previews / secondary)
  if (/\bhd\b|720/i.test(channelName) && !/full\s*hd|fhd|hevc|ʰᵉᵛᶜ/i.test(channelName)) score += 8
  else if (/full\s*hd|fhd|1080/i.test(channelName)) score += 1
  if (/low|ᴸᴼᵂ|hevc|ʰᵉᵛᶜ|lq|sd\b|uhd|4k/i.test(channelName)) score -= 14
  if (/sport\s*tv\s*\+/i.test(channelName)) score -= 10
  if (/[⚡⛑️]/.test(channelName)) score -= 8

  // Flashscore TV listing beats EPG heuristics when present
  if ((match.broadcasts?.length ?? 0) > 0 && !broadcastHit) {
    score = Math.min(score, 30)
    epgMatched = false
  }

  // Without EPG/broadcast evidence, keep score low so we don't invent a channel
  if (!epgMatched && !broadcastHit && nameHome + nameAway < 18) {
    score = Math.min(score, 16)
  }

  return { score, reason: reasons[0] || 'canal de desporto', epgMatched }
}

function confidenceFor(
  score: number,
  ranked: { score: number }[],
  epgMatched: boolean,
): MatchConfidence {
  const second = ranked[1]?.score ?? 0
  if (epgMatched && score >= 70 && score - second >= 8) return 'high'
  if (epgMatched && score >= 45) return 'medium'
  if (score >= 55 && score - second >= 15) return 'medium'
  return 'low'
}

/** Collapse "Sport TV 5 HD/Full HD/LOW" into one family key. */
export function channelFamilyKey(name: string): string {
  return normalize(name)
    .replace(/\+/g, ' plus ')
    .replace(/\b(full hd|fhd|hd|sd|hq|hevc|low|lq|uhd|4k)\b/g, '')
    .replace(/[ʰᵉᵛᶜ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isHardToDecodeName(name: string): boolean {
  return /full\s*hd|\bfhd\b|hevc|ʰᵉᵛᶜ|uhd|\b4k\b/i.test(name)
}

function isPreferredHdName(name: string): boolean {
  return /\bhd\b/i.test(name) && !isHardToDecodeName(name)
}

/**
 * Full HD / HEVC streams often fail in Chromium (decode error).
 * Swap to a same-family HD (or plain) sibling when available.
 */
export function preferCompatibleChannel(channel: Channel, channels: Channel[]): Channel {
  if (!isHardToDecodeName(channel.name)) return channel
  const family = channelFamilyKey(channel.name)
  if (!family) return channel
  const siblings = channels.filter(
    (c) => c.id !== channel.id && channelFamilyKey(c.name) === family,
  )
  const hd = siblings.find((c) => isPreferredHdName(c.name))
  if (hd) return hd
  const plain = siblings.find((c) => !isHardToDecodeName(c.name) && !/low|ᴸᴼᵂ|lq|sd\b/i.test(c.name))
  if (plain) return plain
  return channel
}

function rankChannels(
  match: FootballMatch,
  channels: Channel[],
  epgByChannel?: Map<string, string[]>,
): ChannelGuess[] {
  const scored = channels.map((channel) => {
    const titles = epgByChannel?.get(channel.id) ?? []
    const blob = `${channel.name} ${channel.category ?? ''}`
    const { score, reason, epgMatched } = scoreAgainstText(blob, match, channel.name, titles)
    const sportsBoost = isSportsChannel(channel) ? 1 : 0
    return { channel, score: score + sportsBoost, reason, epgMatched }
  })

  scored.sort((a, b) => b.score - a.score)

  // Keep best quality variant per channel family
  const deduped: typeof scored = []
  const seen = new Set<string>()
  for (const row of scored) {
    const key = channelFamilyKey(row.channel.name)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }

  // Only keep rows with real evidence — never a generic Sport TV fallback
  const meaningful = deduped.filter((s) => s.score >= 40 || s.epgMatched)
  const list = meaningful.slice(0, 8)

  return list.map((s) => ({
    channel: s.channel,
    score: s.score,
    confidence: confidenceFor(s.score, list, s.epgMatched),
    reason: s.reason,
  }))
}

/** Fast guess — pass EPG map when available for accurate card labels. */
export function guessChannelForMatch(
  match: FootballMatch,
  channels: Channel[],
  epgByChannel?: Map<string, string[]>,
): ChannelGuess | null {
  const ranked = rankChannels(match, channels, epgByChannel)
  return ranked[0] ?? null
}

export function findChannelsForMatch(match: FootballMatch, channels: Channel[]): Channel[] {
  return rankChannels(match, channels).map((g) => g.channel)
}

function epgPriority(name: string): number {
  // Numbered Sport TV first — these carry the live matches
  const num = name.match(/sport\s*tv\s*(\d+)/i)
  if (num) return 100 - Number(num[1])
  if (/sport\s*tv\s*\+/i.test(name)) return 40
  if (/dazn|eleven|canal\s*11|benfica tv|porto canal/i.test(name)) return 30
  return 10
}

/** Load short EPG titles for the best sports channel variants. */
export async function loadSportsEpgMap(
  channels: Channel[],
  xtream: XtreamAuth,
): Promise<Map<string, string[]>> {
  const sports = channels.filter(isSportsChannel)
  const rankedForEpg = [...sports].sort((a, b) => {
    const pa = epgPriority(a.name) * 10 + (isPreferredHdName(a.name) ? 3 : isHardToDecodeName(a.name) ? 0 : 1)
    const pb = epgPriority(b.name) * 10 + (isPreferredHdName(b.name) ? 3 : isHardToDecodeName(b.name) ? 0 : 1)
    return pb - pa
  })

  const familySeen = new Set<string>()
  const candidates: Channel[] = []
  for (const ch of rankedForEpg) {
    const key = channelFamilyKey(ch.name)
    if (familySeen.has(key)) continue
    familySeen.add(key)
    candidates.push(ch)
    if (candidates.length >= 36) break
  }

  const epgByChannel = new Map<string, string[]>()
  const chunkSize = 3
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (ch) => {
        const streamId = ch.xtreamStreamId
        if (!streamId) return
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const titles = await fetchShortEpgTitles(xtream, streamId)
            if (titles.length) {
              epgByChannel.set(ch.id, titles)
              // Share titles with every quality variant in the same family
              const family = channelFamilyKey(ch.name)
              for (const sibling of sports) {
                if (sibling.id !== ch.id && channelFamilyKey(sibling.name) === family) {
                  epgByChannel.set(sibling.id, titles)
                }
              }
              return
            }
          } catch {
            /* retry once */
          }
          await new Promise((r) => setTimeout(r, 300))
        }
      }),
    )
  }
  return epgByChannel
}

/**
 * Identify the best IPTV channel for a match.
 * Uses channel names + optional preloaded / freshly fetched Xtream EPG.
 */
export async function identifyChannelForMatch(
  match: FootballMatch,
  channels: Channel[],
  xtream?: XtreamAuth | null,
  preloadedEpg?: Map<string, string[]>,
): Promise<{ best: ChannelGuess | null; options: ChannelGuess[] }> {
  let epgByChannel = preloadedEpg
  if (!epgByChannel && xtream) {
    epgByChannel = await loadSportsEpgMap(channels, xtream)
  }
  const options = rankChannels(match, channels, epgByChannel)
  return { best: options[0] ?? null, options }
}
