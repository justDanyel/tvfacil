import type { ChannelGuess } from '../lib/channelMatch'

interface Props {
  title: string
  subtitle?: string
  options: ChannelGuess[]
  onPick: (guess: ChannelGuess) => void
  onClose: () => void
}

export function ChannelPicker({ title, subtitle, options, onPick, onClose }: Props) {
  return (
    <div className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="picker__panel">
        <h2 id="picker-title" className="picker__title">
          {title}
        </h2>
        {subtitle ? <p className="picker__subtitle">{subtitle}</p> : null}

        {options.length === 0 ? (
          <p className="picker__empty">
            Não encontrámos um canal de futebol na sua lista. Escolha um canal na aba Canais.
          </p>
        ) : (
          <ul className="picker__list">
            {options.map((opt) => (
              <li key={opt.channel.id}>
                <button type="button" className="picker__item" onClick={() => onPick(opt)}>
                  <span className="picker__item-name">{opt.channel.name}</span>
                  <span className="picker__item-cat">
                    {opt.reason}
                    {opt.channel.category ? ` · ${opt.channel.category}` : ''}
                    {opt.confidence === 'high' ? ' · melhor correspondência' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn--ghost btn--large" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
