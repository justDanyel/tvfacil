import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChannelPicker } from '../components/ChannelPicker'
import { MatchCard } from '../components/MatchCard'
import {
  guessChannelForMatch,
  identifyChannelForMatch,
  loadSportsEpgMap,
  type ChannelGuess,
} from '../lib/channelMatch'
import {
  fetchFootballMatches,
  splitFootballSections,
  type FootballMatch,
} from '../lib/football'
import type { Channel } from '../lib/types'
import type { XtreamAuth } from '../lib/xtream'

interface Props {
  channels: Channel[]
  xtream?: XtreamAuth | null
  onPlay: (channel: Channel) => void
  onLogout: () => void
}

const REFRESH_MS = 60_000
const EPG_REFRESH_MS = 3 * 60_000

export function FootballScreen({ channels, xtream, onPlay, onLogout }: Props) {
  const [matches, setMatches] = useState<FootballMatch[]>([])
  const [epgByChannel, setEpgByChannel] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [picking, setPicking] = useState<{
    match: FootballMatch
    options: ChannelGuess[]
  } | null>(null)

  const loadMatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const list = await fetchFootballMatches()
      setMatches(list)
      setUpdatedAt(new Date())
      setError(null)
    } catch {
      setError('Não foi possível atualizar os jogos. Tentamos de novo dentro de um minuto.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEpg = useCallback(async () => {
    if (!xtream) {
      setEpgByChannel(new Map())
      return
    }
    try {
      const map = await loadSportsEpgMap(channels, xtream)
      setEpgByChannel(map)
    } catch {
      /* keep previous EPG cache */
    }
  }, [channels, xtream])

  useEffect(() => {
    void loadMatches(false)
    const id = window.setInterval(() => void loadMatches(true), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [loadMatches])

  useEffect(() => {
    void loadEpg()
    if (!xtream) return
    const id = window.setInterval(() => void loadEpg(), EPG_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [loadEpg, xtream])

  const { spotlight, today } = useMemo(() => splitFootballSections(matches), [matches])

  const guesses = useMemo(() => {
    const map = new Map<string, ChannelGuess | null>()
    for (const m of matches) map.set(m.id, guessChannelForMatch(m, channels, epgByChannel))
    return map
  }, [matches, channels, epgByChannel])

  const openMatch = async (match: FootballMatch) => {
    setResolving(true)
    try {
      const { best, options } = await identifyChannelForMatch(match, channels, xtream, epgByChannel)
      // Only auto-open when EPG (or clear evidence) identifies the channel
      if (best && best.confidence === 'high') {
        onPlay(best.channel)
        return
      }
      const pickerOptions =
        options.length > 0
          ? options
          : channels
              .filter((c) => /sport\s*tv|dazn|eleven|canal\s*11/i.test(c.name))
              .filter((c) => /\bhd\b/i.test(c.name) && !/full|hevc|ʰᵉᵛᶜ/i.test(c.name))
              .slice(0, 10)
              .map((channel) => ({
                channel,
                score: 0,
                confidence: 'low' as const,
                reason: 'canal de desporto',
              }))
      setPicking({ match, options: pickerOptions })
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="football-screen">
      <header className="grid-screen__header">
        <div>
          <p className="grid-screen__brand">TvFácil</p>
          <h1 className="grid-screen__title">Futebol</h1>
          <p className="grid-screen__meta">
            Jogos ao vivo e resultados · atualiza a cada minuto
            {updatedAt
              ? ` · ${updatedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
            {xtream ? ` · EPG ${epgByChannel.size} canais` : ''}
          </p>
        </div>
        <div className="football-screen__header-actions">
          <button
            type="button"
            className="btn btn--secondary btn--large"
            onClick={() => {
              void loadMatches(false)
              void loadEpg()
            }}
          >
            Atualizar
          </button>
          <button type="button" className="btn btn--ghost btn--large" onClick={onLogout}>
            Mudar conta
          </button>
        </div>
      </header>

      {error ? <p className="form-error football-screen__banner">{error}</p> : null}
      {resolving ? <p className="football-screen__resolving">A identificar o canal do jogo…</p> : null}

      {loading && matches.length === 0 ? (
        <p className="grid-screen__empty">A carregar jogos…</p>
      ) : (
        <>
          <section className="football-section" aria-labelledby="spotlight-title">
            <h2 id="spotlight-title" className="football-section__title">
              A dar agora / em 30 minutos
            </h2>
            {spotlight.length === 0 ? (
              <p className="football-section__empty">Neste momento não há jogos ao vivo nem a começar em breve.</p>
            ) : (
              <div className="match-list">
                {spotlight.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    channelGuess={guesses.get(m.id)}
                    onSelect={(match) => void openMatch(match)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="football-section" aria-labelledby="today-title">
            <h2 id="today-title" className="football-section__title">
              Todos os jogos de hoje
            </h2>
            {today.length === 0 ? (
              <p className="football-section__empty">Não há jogos previstos para hoje nestas competições.</p>
            ) : (
              <div className="match-list">
                {today.map((m) => (
                  <MatchCard
                    key={`today-${m.id}`}
                    match={m}
                    channelGuess={guesses.get(m.id)}
                    onSelect={(match) => void openMatch(match)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {picking ? (
        <ChannelPicker
          title="Escolha o canal"
          subtitle={`${picking.match.home} × ${picking.match.away}`}
          options={picking.options}
          onPick={(guess) => {
            setPicking(null)
            onPlay(guess.channel)
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </div>
  )
}
