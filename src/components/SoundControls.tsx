interface Props {
  value: number
  muted?: boolean
  onChange: (volume: number) => void
  onMuteToggle?: () => void
}

function clampVolume(n: number) {
  if (Number.isNaN(n)) return 0.7
  return Math.min(1, Math.max(0, n))
}

export function SoundControls({ value, muted = false, onChange, onMuteToggle }: Props) {
  const safe = clampVolume(value)
  const percent = Math.round(safe * 100)
  const effective = muted || safe === 0 ? 0 : safe

  return (
    <div className="sound-controls">
      <div className="sound-controls__header">
        <p className="sound-controls__legend" id="sound-label">
          Som
        </p>
        <p className="sound-controls__value" aria-live="polite">
          {muted || safe === 0 ? 'Sem som' : `${percent}%`}
        </p>
      </div>

      <div className="sound-controls__row">
        {onMuteToggle ? (
          <button
            type="button"
            className={`sound-controls__mute${muted || safe === 0 ? ' is-on' : ''}`}
            onClick={onMuteToggle}
            aria-pressed={muted || safe === 0}
            aria-label={muted || safe === 0 ? 'Ligar o som' : 'Desligar o som'}
          >
            {muted || safe === 0 ? 'Sem som' : 'Com som'}
          </button>
        ) : null}

        <div className="sound-controls__slider-wrap">
          <span className="sound-controls__end" aria-hidden>
            Baixo
          </span>
          <input
            className="sound-controls__slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(effective * 100)}
            onChange={(e) => {
              const next = Number(e.target.value) / 100
              onChange(next)
            }}
            aria-labelledby="sound-label"
            aria-valuetext={muted || safe === 0 ? 'Sem som' : `${percent} por cento`}
          />
          <span className="sound-controls__end" aria-hidden>
            Alto
          </span>
        </div>
      </div>
    </div>
  )
}

export function normalizeStoredVolume(raw: unknown): number {
  if (typeof raw === 'number') return clampVolume(raw)
  if (raw === 'mudo') return 0
  if (raw === 'baixo') return 0.35
  if (raw === 'alto') return 1
  if (raw === 'medio') return 0.7
  return 0.7
}
