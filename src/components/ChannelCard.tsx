import type { Channel } from '../lib/types'

interface Props {
  channel: Channel
  favorite?: boolean
  onSelect: (channel: Channel) => void
  onToggleFavorite?: (channel: Channel) => void
}

export function ChannelCard({ channel, favorite, onSelect, onToggleFavorite }: Props) {
  return (
    <article className="channel-card">
      <button
        type="button"
        className="channel-card__main"
        onClick={() => onSelect(channel)}
        aria-label={`Ver ${channel.name}`}
      >
        <div className="channel-card__logo" aria-hidden>
          {channel.logo ? (
            <img
              src={channel.logo}
              alt=""
              loading="lazy"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span className="channel-card__initial">{channel.name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <span className="channel-card__name">{channel.name}</span>
        {channel.category ? (
          <span className="channel-card__cat">{channel.category}</span>
        ) : null}
      </button>
      {onToggleFavorite ? (
        <button
          type="button"
          className={`channel-card__fav${favorite ? ' is-on' : ''}`}
          onClick={() => onToggleFavorite(channel)}
          aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={!!favorite}
        >
          {favorite ? '★' : '☆'}
        </button>
      ) : null}
    </article>
  )
}
