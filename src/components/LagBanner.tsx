interface Props {
  visible: boolean
  onAccept: () => void
  onDismiss: () => void
}

export function LagBanner({ visible, onAccept, onDismiss }: Props) {
  if (!visible) return null
  return (
    <div className="lag-banner" role="status" aria-live="polite">
      <p className="lag-banner__text">
        A imagem está a falhar. Quer experimentar uma qualidade mais estável?
      </p>
      <div className="lag-banner__actions">
        <button type="button" className="btn btn--primary btn--large" onClick={onAccept}>
          Usar qualidade mais estável
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDismiss}>
          Continuar assim
        </button>
      </div>
    </div>
  )
}
