// patchwork — npm scanner
// Parse package.json to extract dependency list with current versions

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DepInfo } from '../types'

interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export async function scanNpm(dir: string): Promise<DepInfo[]> {
  const pkgPath = join(dir, 'package.json')
  const raw = await readFile(pkgPath, 'utf-8')
  const pkg: PackageJson = JSON.parse(raw)

  const deps: DepInfo[] = []
  const all = { ...pkg.dependencies, ...pkg.devDependencies }

  for (const [name, versionRange] of Object.entries(all)) {
    // Strip range operators (^, ~, >=, etc.) to get base version
    const current = versionRange.replace(/^[\^~>=<]*/, '').split(' ')[0]
    deps.push({
      name,
      current,
      latest: '', // filled by fetcher
      semverClass: 'unknown',
      ecosystem: 'npm',
    })
  }

  return deps
}
