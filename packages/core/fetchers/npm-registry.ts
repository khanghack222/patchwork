// patchwork — npm registry fetcher
// Query npm registry for latest version + repository URL

import type { DepInfo } from '../types'

const NPM_REGISTRY = 'https://registry.npmjs.org'

interface NpmPackageInfo {
  'dist-tags': { latest: string }
  repository?: { url?: string; type?: string }
}

export async function fetchNpmLatest(deps: DepInfo[]): Promise<DepInfo[]> {
  const results = await Promise.allSettled(
    deps.map(async (dep) => {
      const res = await fetch(`${NPM_REGISTRY}/${dep.name}/latest`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return dep

      const data = (await res.json()) as any
      const latest = data.version || ''
      let repoUrl = data.repository?.url || ''

      // Normalize git URLs
      repoUrl = repoUrl
        .replace(/^git\+/, '')
        .replace(/\.git$/, '')
        .replace('git://', 'https://')
        .replace('git@github.com:', 'https://github.com/')

      return { ...dep, latest, repoUrl }
    })
  )

  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : deps[i]))
}
