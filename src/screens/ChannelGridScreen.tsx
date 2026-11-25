import { useMemo, useState } from 'react'
import { ChannelCard } from '../components/ChannelCard'
import type { Channel } from '../lib/types'

interface Props {
  channels: Channel[]
  favorites: string[]
  sourceLabel: string
  onPlay: (channel: Channel) => void
  onToggleFavorite: (channel: Channel) => void
  onLogout: () => void
}

export function ChannelGridScreen({
  channels,
  favorites,
  sourceLabel,
  onPlay,
  onToggleFavorite,
  onLogout,
}: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [onlyFavs, setOnlyFavs] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const c of channels) if (c.category) set.add(c.category)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'))
  }, [channels])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return channels.filter((c) => {
      if (onlyFavs && !favorites.includes(c.id)) return false
      if (category !== 'all' && c.category !== category) return false
      if (q && !c.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [channels, favorites, onlyFavs, category, query])

  const clearFilters = () => {
    setQuery('')
    setCategory('all')
    setOnlyFavs(false)
  }

  const hasFilter = onlyFavs || category !== 'all' || query.trim().length > 0

  return (
    <div className="grid-screen">
      <header className="grid-screen__header">
        <div>
          <p className="grid-screen__brand">TvFácil</p>
          <h1 className="grid-screen__title">Escolha um canal</h1>
          <p className="grid-screen__meta">
            {sourceLabel} · {filtered.length} de {channels.length} canais
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--large" onClick={onLogout}>
          Mudar conta
        </button>
      </header>

      <div className="grid-screen__toolbar">
        <label className="search-field">
          <span className="search-field__label">Procurar</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escreva o nome do canal…"
            autoComplete="off"
          />
        </label>

        <div className="nav-section">
          <p className="nav-section__label">Ver</p>
          <div className="chip-row" role="group" aria-label="Ver canais">
            <button
              type="button"
              className={`chip chip--lg${category === 'all' && !onlyFavs ? ' is-active' : ''}`}
              onClick={() => {
                setCategory('all')
                setOnlyFavs(false)
              }}
            >
              Todos
            </button>
            <button
              type="button"
              className={`chip chip--lg${onlyFavs ? ' is-active' : ''}`}
              onClick={() => {
                setOnlyFavs(true)
                setCategory('all')
              }}
            >
              ★ Favoritos
            </button>
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="nav-section">
            <p className="nav-section__label">Categorias</p>
            <div className="chip-row" role="group" aria-label="Categorias">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`chip chip--lg${category === cat && !onlyFavs ? ' is-active' : ''}`}
                  onClick={() => {
                    setOnlyFavs(false)
                    setCategory(cat)
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {hasFilter ? (
          <button type="button" className="btn btn--ghost" onClick={clearFilters}>
            Limpar filtros
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="grid-screen__empty">
          <p>Não encontrámos canais com este filtro.</p>
          <button type="button" className="btn btn--primary btn--large" onClick={clearFilters}>
            Ver todos os canais
          </button>
        </div>
      ) : (
        <div className="channel-grid">
          {filtered.map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              favorite={favorites.includes(ch.id)}
              onSelect={onPlay}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}
