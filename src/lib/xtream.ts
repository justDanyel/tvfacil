import type { Channel } from './types'

export interface XtreamAuth {
  server: string
  username: string
  password: string
}

function normalizeServer(server: string): string {
  let s = server.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  return s
}

function streamUrl(
  base: string,
  username: string,
  password: string,
  id: string,
  extension: string,
): string {
  const ext = extension.replace(/^\./, '') || 'ts'
  return `${base}/live/${username}/${password}/${id}.${ext}`
}

/**
 * Xtream Codes player API — live categories + streams.
 * Falls back with a clear error if the panel is unreachable.
 */
export async function fetchXtreamLiveChannels(auth: XtreamAuth): Promise<Channel[]> {
  const base = normalizeServer(auth.server)
  const user = encodeURIComponent(auth.username)
  const pass = encodeURIComponent(auth.password)

  const authUrl = `${base}/player_api.php?username=${user}&password=${pass}`
  let authRes: Response
  try {
    authRes = await fetch(authUrl, { signal: AbortSignal.timeout(20000) })
  } catch {
    throw new Error('Não foi possível contactar o servidor. Verifique o endereço e a internet.')
  }
  if (!authRes.ok) {
    throw new Error('O servidor não respondeu. Verifique o endereço.')
  }
  const authJson = (await authRes.json()) as {
    user_info?: { auth?: number | string; status?: string }
  }
  const ok =
    authJson?.user_info?.auth === 1 ||
    authJson?.user_info?.auth === '1' ||
    authJson?.user_info?.status === 'Active'
  if (!ok) {
    throw new Error('Utilizador ou palavra-passe incorrectos.')
  }

  const catRes = await fetch(
    `${base}/player_api.php?username=${user}&password=${pass}&action=get_live_categories`,
    { signal: AbortSignal.timeout(20000) },
  )
  const categories = catRes.ok
    ? ((await catRes.json()) as Array<{ category_id: string; category_name: string }>)
    : []
  const catMap = new Map(categories.map((c) => [String(c.category_id), c.category_name]))

  const liveRes = await fetch(
    `${base}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`,
    { signal: AbortSignal.timeout(45000) },
  )
  if (!liveRes.ok) throw new Error('Não foi possível obter a lista de canais.')
  const streams = (await liveRes.json()) as Array<{
    stream_id: number | string
    name: string
    stream_icon?: string
    category_id?: string | number
    container_extension?: string
  }>

  if (!Array.isArray(streams)) {
    throw new Error('Resposta inesperada do servidor.')
  }

  return streams.map((s) => {
    const id = String(s.stream_id)
    const ext = (s.container_extension || 'ts').toLowerCase()
    // HLS (.m3u8) is far more reliable in Electron/Chromium than raw MPEG-TS.
    const hlsUrl = streamUrl(base, auth.username, auth.password, id, 'm3u8')
    const tsUrl = streamUrl(base, auth.username, auth.password, id, ext === 'm3u8' ? 'ts' : ext)
    const primary = hlsUrl
    const fallback = tsUrl !== hlsUrl ? tsUrl : undefined
    return {
      id: `xt-${id}`,
      name: s.name || `Canal ${id}`,
      logo: s.stream_icon || undefined,
      category: s.category_id != null ? catMap.get(String(s.category_id)) : undefined,
      url: primary,
      fallbackUrl: fallback,
      xtreamStreamId: id,
      streams: {
        maxima: primary,
        boa: primary,
        media: primary,
        poupar: primary,
      },
    } satisfies Channel
  })
}

function decodeEpgField(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  try {
    const compact = t.replace(/\s/g, '')
    if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length % 4 === 0) {
      const binary = atob(compact)
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
      const decoded = new TextDecoder('utf-8').decode(bytes)
      if (/[A-Za-zÀ-ÿ]/.test(decoded)) return decoded.trim()
    }
  } catch {
    /* keep raw */
  }
  return t
}

/** Current/next programme titles for a live stream (Xtream short EPG). */
export async function fetchShortEpgTitles(auth: XtreamAuth, streamId: string): Promise<string[]> {
  const base = normalizeServer(auth.server)
  const user = encodeURIComponent(auth.username)
  const pass = encodeURIComponent(auth.password)
  const url = `${base}/player_api.php?username=${user}&password=${pass}&action=get_short_epg&stream_id=${encodeURIComponent(streamId)}&limit=6`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return []
  const text = await res.text()
  if (!text || text.trimStart().startsWith('<')) return []
  let json: { epg_listings?: Array<{ title?: string; description?: string }> }
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    return []
  }
  const titles: string[] = []
  for (const row of json.epg_listings ?? []) {
    const raw = row.title || row.description
    if (!raw) continue
    const decoded = decodeEpgField(raw)
    if (decoded) titles.push(decoded)
  }
  return titles
}
