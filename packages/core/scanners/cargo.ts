// patchwork — cargo scanner
// Parse Cargo.toml dependencies

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DepInfo } from '../types'

export async function scanCargo(dir: string): Promise<DepInfo[]> {
  const cargoPath = join(dir, 'Cargo.toml')
  const content = await readFile(cargoPath, 'utf-8')
  return parseCargo(content)
}

function parseCargo(content: string): DepInfo[] {
  const deps: DepInfo[] = []
  const sections = ['[dependencies]', '[dev-dependencies]', '[build-dependencies]']

  for (const section of sections) {
    const idx = content.indexOf(section)
    if (idx === -1) continue

    const block = content.slice(idx + section.length)
    const nextSection = block.indexOf('\n[')
    const sectionContent = nextSection === -1 ? block : block.slice(0, nextSection)

    for (const line of sectionContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue

      // Simple: name = "version"
      const simple = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/)
      if (simple) {
        deps.push({
          name: simple[1],
          current: simple[2].replace(/^[\^~>=<]*/, ''),
          latest: '',
          semverClass: 'unknown',
          ecosystem: 'cargo',
        })
        continue
      }

      // Inline table: name = { version = "..." }
      const table = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/)
      if (table) {
        deps.push({
          name: table[1],
          current: table[2].replace(/^[\^~>=<]*/, ''),
          latest: '',
          semverClass: 'unknown',
          ecosystem: 'cargo',
        })
      }
    }
  }

  return deps
}
