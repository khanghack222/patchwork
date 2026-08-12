// patchwork — crates.io fetcher
// Query crates.io for latest version + repo URL

import type { DepInfo } from '../types'

const CRATES_API = 'https://crates.io/api/v1/crates'

export async function fetchCratesLatest(deps: DepInfo[]): Promise<DepInfo[]> {
  const results = await Promise.allSettled(
    deps.map(async (dep) => {
      const res = await fetch(`${CRATES_API}/${dep.name}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'patchwork-cli/0.1' },
      })
      if (!res.ok) return dep

      const data = (await res.json()) as any
      const latest = data.crate?.newest_version || ''
      const repoUrl = data.crate?.repository || ''

      return { ...dep, latest, repoUrl }
    })
  )

  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : deps[i]))
}
