import { QUALITY_OPTIONS, type QualityId } from '../lib/types'

interface Props {
  value: QualityId
  onChange: (q: QualityId) => void
}

export function QualitySelector({ value, onChange }: Props) {
  return (
    <fieldset className="quality-selector">
      <legend className="quality-selector__legend">Qualidade</legend>
      <div className="quality-selector__options">
        {QUALITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`quality-selector__btn${value === opt.id ? ' is-active' : ''}`}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
