import type { Channel } from './types'

/**
 * Parse a classic M3U / ExtM3U playlist into live channels.
 * Recognizes #EXTINF with tvg-logo, tvg-id, group-title.
 */
export function parseM3u(content: string): Channel[] {
  const lines = content.split(/\r?\n/)
  const channels: Channel[] = []
  let pending: { name: string; logo?: string; category?: string } | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',')
      const meta = comma >= 0 ? line.slice(0, comma) : line
      const name = comma >= 0 ? line.slice(comma + 1).trim() : 'Canal'
      const logo = attr(meta, 'tvg-logo') || attr(meta, 'logo')
      const category = attr(meta, 'group-title')
      pending = { name, logo: logo || undefined, category: category || undefined }
      continue
    }

    if (line.startsWith('#')) continue

    if (pending) {
      channels.push({
        id: `m3u-${channels.length}-${hash(line)}`,
        name: pending.name || `Canal ${channels.length + 1}`,
        logo: pending.logo,
        category: pending.category,
        url: line,
      })
      pending = null
    }
  }

  return channels
}

function attr(line: string, key: string): string | undefined {
  const re = new RegExp(`${key}="([^"]*)"`, 'i')
  const m = line.match(re)
  return m?.[1]
}

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

export async function fetchM3uFromUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Não foi possível carregar a playlist (${res.status}).`)
  return res.text()
}
