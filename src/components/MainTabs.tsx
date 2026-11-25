export type MainTab = 'channels' | 'football'

interface Props {
  value: MainTab
  onChange: (tab: MainTab) => void
}

export function MainTabs({ value, onChange }: Props) {
  return (
    <nav className="main-tabs" aria-label="Secções principais">
      <button
        type="button"
        className={`main-tabs__btn${value === 'channels' ? ' is-active' : ''}`}
        onClick={() => onChange('channels')}
        aria-current={value === 'channels' ? 'page' : undefined}
      >
        Canais
      </button>
      <button
        type="button"
        className={`main-tabs__btn${value === 'football' ? ' is-active' : ''}`}
        onClick={() => onChange('football')}
        aria-current={value === 'football' ? 'page' : undefined}
      >
        Futebol
      </button>
    </nav>
  )
}
