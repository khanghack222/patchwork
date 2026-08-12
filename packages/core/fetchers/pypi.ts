// patchwork — PyPI fetcher
// Query PyPI for latest version + project URL

import type { DepInfo } from '../types'

const PYPI_API = 'https://pypi.org/pypi'

export async function fetchPypiLatest(deps: DepInfo[]): Promise<DepInfo[]> {
  const results = await Promise.allSettled(
    deps.map(async (dep) => {
      const res = await fetch(`${PYPI_API}/${dep.name}/json`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return dep

      const data = (await res.json()) as any
      const latest = data.info?.version || ''
      const repoUrl = data.info?.project_urls?.Repository
        || data.info?.project_urls?.Source
        || data.info?.home_page
        || ''

      return { ...dep, latest, repoUrl }
    })
  )

  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : deps[i]))
}
