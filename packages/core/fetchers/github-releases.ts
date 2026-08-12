// patchwork — GitHub releases fetcher
// Fetch release notes from GitHub for a given repo + version range

import type { ChangelogEntry } from '../types'

const GITHUB_API = 'https://api.github.com'

export async function fetchGitHubReleases(
  repoUrl: string,
  fromVersion: string,
  toVersion: string,
  token?: string
): Promise<ChangelogEntry[]> {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/)
  if (!match) return []

  const repo = match[1]
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'patchwork-cli',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${GITHUB_API}/repos/${repo}/releases?per_page=20`, {
    headers,
  })
  if (!res.ok) return []

  const releases = (await res.json()) as any[]

  // Filter releases between fromVersion and toVersion
  const fromClean = fromVersion.replace(/^v/, '')
  const toClean = toVersion.replace(/^v/, '')

  const relevant = releases.filter((r) => {
    const tag = (r.tag_name || '').replace(/^v/, '')
    return tag > fromClean && tag <= toClean
  })

  return relevant.map((r) => ({
    version: r.tag_name,
    date: r.published_at?.split('T')[0],
    body: r.body || '',
    url: r.html_url,
  }))
}

// Fallback: try to fetch CHANGELOG.md from repo
export async function fetchChangelogMd(
  repoUrl: string,
  token?: string
): Promise<string> {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/)
  if (!match) return ''

  const repo = match[1]
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw+json',
    'User-Agent': 'patchwork-cli',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  for (const file of ['CHANGELOG.md', 'CHANGES.md', 'HISTORY.md']) {
    const res = await fetch(
      `${GITHUB_API}/repos/${repo}/contents/${file}`,
      { headers }
    )
    if (res.ok) {
      const text = await res.text()
      // Truncate to ~4000 chars to stay within LLM context
      return text.slice(0, 4000)
    }
  }
  return ''
}
