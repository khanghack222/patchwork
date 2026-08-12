// patchwork — go scanner
// Parse go.mod require blocks

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DepInfo } from '../types'

export async function scanGo(dir: string): Promise<DepInfo[]> {
  const goModPath = join(dir, 'go.mod')
  const content = await readFile(goModPath, 'utf-8')
  return parseGoMod(content)
}

function parseGoMod(content: string): DepInfo[] {
  const deps: DepInfo[] = []

  // Match require blocks: require ( ... )
  const blockRegex = /require\s*\(([\s\S]*?)\)/g
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(content)) !== null) {
    for (const line of match[1].split('\n')) {
      const dep = parseRequireLine(line)
      if (dep) deps.push(dep)
    }
  }

  // Match single require: require module/path v1.2.3
  const singleRegex = /^require\s+(\S+)\s+(v[\d.]+\S*)/gm
  while ((match = singleRegex.exec(content)) !== null) {
    deps.push({
      name: match[1],
      current: match[2].replace(/^v/, ''),
      latest: '',
      semverClass: 'unknown',
      ecosystem: 'go',
    })
  }

  return deps
}

function parseRequireLine(line: string): DepInfo | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('//')) return null

  // Format: module/path v1.2.3
  const match = trimmed.match(/^(\S+)\s+(v[\d.]+\S*)/)
  if (!match) return null

  // Skip indirect deps
  if (trimmed.includes('// indirect')) return null

  return {
    name: match[1],
    current: match[2].replace(/^v/, ''),
    latest: '',
    semverClass: 'unknown',
    ecosystem: 'go',
  }
}
