// patchwork — Go proxy fetcher
// Query proxy.golang.org for latest version

import type { DepInfo } from '../types'

const GO_PROXY = 'https://proxy.golang.org'

export async function fetchGoLatest(deps: DepInfo[]): Promise<DepInfo[]> {
  const results = await Promise.allSettled(
    deps.map(async (dep) => {
      // Get latest version from @latest endpoint
      const res = await fetch(`${GO_PROXY}/${dep.name}/@latest`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return dep

      const data = (await res.json()) as any
      const latest = (data.Version || '').replace(/^v/, '')

      // Infer GitHub repo from module path
      const parts = dep.name.split('/')
      let repoUrl = ''
      if (parts[0] === 'github.com' && parts.length >= 3) {
        repoUrl = `https://github.com/${parts[1]}/${parts[2]}`
      }

      return { ...dep, latest, repoUrl }
    })
  )

  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : deps[i]))
}
