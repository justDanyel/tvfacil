import { useState, type FormEvent } from 'react'
import type { Credentials, SourceKind } from '../lib/types'
import { pickM3uFile } from '../lib/storage'

interface Props {
  initial?: Credentials | null
  busy?: boolean
  error?: string | null
  onConnect: (creds: Credentials) => void
}

type Mode = 'home' | 'xtream' | 'm3u'

export function WelcomeScreen({ initial, busy, error, onConnect }: Props) {
  const [mode, setMode] = useState<Mode>('home')
  const [server, setServer] = useState(initial?.server ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [m3uUrl, setM3uUrl] = useState(initial?.m3uUrl ?? '')
  const [m3uPath, setM3uPath] = useState(initial?.m3uPath ?? '')

  const submitXtream = (e: FormEvent) => {
    e.preventDefault()
    onConnect({ kind: 'xtream', server: server.trim(), username: username.trim(), password })
  }

  const submitM3u = (e: FormEvent) => {
    e.preventDefault()
    onConnect({
      kind: 'm3u',
      m3uUrl: m3uUrl.trim() || undefined,
      m3uPath: m3uPath || undefined,
    })
  }

  const chooseFile = async () => {
    const path = await pickM3uFile()
    if (path) {
      setM3uPath(path)
      setM3uUrl('')
    }
  }

  const startDemo = () => onConnect({ kind: 'demo' as SourceKind })

  return (
    <div className="welcome">
      <div className="welcome__atmosphere" aria-hidden />
      <header className="welcome__hero">
        <p className="welcome__eyebrow">Televisão no computador</p>
        <h1 className="welcome__brand">TvFácil</h1>
        <p className="welcome__tagline">
          Escolha um canal e veja em ecrã cheio — simples, claro e calmo.
        </p>
      </header>

      {mode === 'home' ? (
        <div className="welcome__choices">
          <button type="button" className="btn btn--primary btn--xl" onClick={() => setMode('xtream')}>
            Entrar com conta Xtream
          </button>
          <button type="button" className="btn btn--secondary btn--xl" onClick={() => setMode('m3u')}>
            Abrir lista M3U
          </button>
          <button type="button" className="btn btn--ghost btn--xl" onClick={startDemo} disabled={busy}>
            Ver demonstração
          </button>
        </div>
      ) : null}

      {mode === 'xtream' ? (
        <form className="welcome__form" onSubmit={submitXtream}>
          <h2 className="welcome__form-title">Conta Xtream</h2>
          <label className="field">
            <span>Servidor</span>
            <input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="http://exemplo.com:8080"
              autoComplete="url"
              required
            />
          </label>
          <label className="field">
            <span>Utilizador</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Palavra-passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="welcome__form-actions">
            <button type="submit" className="btn btn--primary btn--large" disabled={busy}>
              {busy ? 'A ligar…' : 'Entrar'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setMode('home')}>
              Voltar
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'm3u' ? (
        <form className="welcome__form" onSubmit={submitM3u}>
          <h2 className="welcome__form-title">Lista M3U</h2>
          <label className="field">
            <span>Endereço da playlist (URL)</span>
            <input
              value={m3uUrl}
              onChange={(e) => {
                setM3uUrl(e.target.value)
                if (e.target.value) setM3uPath('')
              }}
              placeholder="https://…/lista.m3u"
              autoComplete="url"
            />
          </label>
          <div className="field-or">ou</div>
          <div className="field-file">
            <button type="button" className="btn btn--secondary btn--large" onClick={chooseFile}>
              Escolher ficheiro no computador
            </button>
            {m3uPath ? <p className="field-file__path">{m3uPath}</p> : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="welcome__form-actions">
            <button
              type="submit"
              className="btn btn--primary btn--large"
              disabled={busy || (!m3uUrl.trim() && !m3uPath)}
            >
              {busy ? 'A carregar…' : 'Abrir canais'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setMode('home')}>
              Voltar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
