import type { ChannelGuess } from '../lib/channelMatch'
import type { FootballMatch } from '../lib/football'

interface Props {
  match: FootballMatch
  channelGuess?: ChannelGuess | null
  onSelect: (match: FootballMatch) => void
}

export function MatchCard({ match, channelGuess, onSelect }: Props) {
  const live = match.phase === 'live'
  const soon = match.phase === 'soon'

  return (
    <button
      type="button"
      className={`match-card${live ? ' is-live' : ''}${soon ? ' is-soon' : ''}`}
      onClick={() => onSelect(match)}
    >
      <div className="match-card__meta">
        <span className="match-card__league">{match.league}</span>
        <span className={`match-card__status${live ? ' is-live' : ''}`}>{match.statusText}</span>
      </div>

      <div className="match-card__teams">
        <div className="match-card__side">
          {match.homeLogo ? (
            <img src={match.homeLogo} alt="" className="match-card__logo" loading="lazy" />
          ) : (
            <span className="match-card__logo-fallback" aria-hidden>
              {match.home.slice(0, 1)}
            </span>
          )}
          <span className="match-card__name">{match.home}</span>
          {match.homeScore != null ? <span className="match-card__score">{match.homeScore}</span> : null}
        </div>
        <div className="match-card__side">
          {match.awayLogo ? (
            <img src={match.awayLogo} alt="" className="match-card__logo" loading="lazy" />
          ) : (
            <span className="match-card__logo-fallback" aria-hidden>
              {match.away.slice(0, 1)}
            </span>
          )}
          <span className="match-card__name">{match.away}</span>
          {match.awayScore != null ? <span className="match-card__score">{match.awayScore}</span> : null}
        </div>
      </div>

      {channelGuess && channelGuess.confidence !== 'low' ? (
        <p className="match-card__channel">
          Canal: <strong>{channelGuess.channel.name}</strong>
          {channelGuess.confidence === 'high' ? ' · identificado' : ''}
        </p>
      ) : match.broadcasts && match.broadcasts.length > 0 ? (
        <p className="match-card__channel">
          Na TV:{' '}
          <strong>
            {match.broadcasts
              .filter((b) => !/\/\s*app|paramount|peacock|live\s*mode/i.test(b))
              .slice(0, 3)
              .join(' · ') || match.broadcasts[0]}
          </strong>
          <span className="match-card__channel-hint"> · toque para abrir na lista</span>
        </p>
      ) : (
        <p className="match-card__channel match-card__channel--missing">
          Canal a confirmar — toque para escolher
        </p>
      )}

      <span className="match-card__action">
        {live || soon ? 'Ver em direto' : 'Abrir canal'}
      </span>
    </button>
  )
}
