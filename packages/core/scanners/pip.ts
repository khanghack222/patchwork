// patchwork — pip scanner
// Parse requirements.txt and pyproject.toml

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DepInfo } from '../types'

export async function scanPip(dir: string): Promise<DepInfo[]> {
  // Try pyproject.toml first, then requirements.txt
  const deps: DepInfo[] = []

  try {
    const pyproject = await readFile(join(dir, 'pyproject.toml'), 'utf-8')
    deps.push(...parsePyproject(pyproject))
    if (deps.length) return deps
  } catch {}

  try {
    const requirements = await readFile(join(dir, 'requirements.txt'), 'utf-8')
    deps.push(...parseRequirements(requirements))
  } catch {}

  return deps
}

function parseRequirements(content: string): DepInfo[] {
  const deps: DepInfo[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue

    // Formats: package==1.0.0, package>=1.0.0, package~=1.0.0
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*([=~!><]+)\s*([^\s,;#]+)/)
    if (match) {
      deps.push({
        name: match[1],
        current: match[3],
        latest: '',
        semverClass: 'unknown',
        ecosystem: 'pip',
      })
    }
  }
  return deps
}

function parsePyproject(content: string): DepInfo[] {
  const deps: DepInfo[] = []

  // Simple TOML parsing for [project] dependencies array
  const depsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/)
  if (!depsMatch) return deps

  const depsBlock = depsMatch[1]
  const lines = depsBlock.match(/"[^"]+"|'[^']+'/g) || []

  for (const raw of lines) {
    const entry = raw.replace(/^["']|["']$/g, '')
    const match = entry.match(/^([a-zA-Z0-9_.-]+)\s*([=~!><]+)\s*([^\s,;]+)/)
    if (match) {
      deps.push({
        name: match[1],
        current: match[3],
        latest: '',
        semverClass: 'unknown',
        ecosystem: 'pip',
      })
    }
  }

  return deps
}
