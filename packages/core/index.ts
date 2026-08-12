// patchwork — main scan orchestrator

import { scanNpm } from './scanners/npm'
import { scanPip } from './scanners/pip'
import { scanCargo } from './scanners/cargo'
import { scanGo } from './scanners/go'
import { fetchNpmLatest } from './fetchers/npm-registry'
import { fetchPypiLatest } from './fetchers/pypi'
import { fetchCratesLatest } from './fetchers/crates'
import { fetchGoLatest } from './fetchers/go-proxy'
import { fetchGitHubReleases, fetchChangelogMd } from './fetchers/github-releases'
import { classifySemver, computeRiskScore } from './scorer'
import { analyzeChangelog } from './analyzer'
import type { AnalysisResult, DepInfo, Ecosystem, PatchworkConfig, ScanResult } from './types'

async function detectEcosystem(dir: string): Promise<Ecosystem> {
  const { access } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const checks: [string, Ecosystem][] = [
    ['package.json', 'npm'],
    ['Cargo.toml', 'cargo'],
    ['go.mod', 'go'],
    ['pyproject.toml', 'pip'],
    ['requirements.txt', 'pip'],
  ]
  for (const [file, eco] of checks) {
    try { await access(join(dir, file)); return eco } catch {}
  }
  return 'npm'
}

async function scanDeps(dir: string, ecosystem: Ecosystem): Promise<DepInfo[]> {
  switch (ecosystem) {
    case 'npm': return scanNpm(dir)
    case 'pip': return scanPip(dir)
    case 'cargo': return scanCargo(dir)
    case 'go': return scanGo(dir)
    default: return scanNpm(dir)
  }
}

async function fetchLatest(deps: DepInfo[], ecosystem: Ecosystem): Promise<DepInfo[]> {
  switch (ecosystem) {
    case 'npm': return fetchNpmLatest(deps)
    case 'pip': return fetchPypiLatest(deps)
    case 'cargo': return fetchCratesLatest(deps)
    case 'go': return fetchGoLatest(deps)
    default: return fetchNpmLatest(deps)
  }
}

export async function scan(
  dir: string,
  config?: PatchworkConfig,
  onProgress?: (msg: string) => void
): Promise<ScanResult> {
  const log = onProgress || (() => {})

  // 1. Detect or use configured ecosystem
  const ecosystem = config?.ecosystems?.[0] || await detectEcosystem(dir)
  log(`Detected ecosystem: ${ecosystem}`)

  // 2. Scan lockfile
  log(`Scanning ${ecosystem} dependencies...`)
  let deps = await scanDeps(dir, ecosystem)
  log(`Found ${deps.length} dependencies`)

  // 3. Fetch latest versions
  log(`Checking ${ecosystem} registry for updates...`)
  deps = await fetchLatest(deps, ecosystem)

  // 4. Filter outdated only
  const outdated = deps.filter((d) => d.latest && d.current !== d.latest)
  log(`${outdated.length} outdated dependencies`)

  // 5. Classify + analyze each
  const results: AnalysisResult[] = []
  const ghToken = config?.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN

  for (const dep of outdated) {
    dep.semverClass = classifySemver(dep.current, dep.latest)

    // Only fetch changelog for major/minor upgrades
    let changelog: Awaited<ReturnType<typeof fetchGitHubReleases>> = []
    let changelogText = ''

    if (dep.semverClass === 'major' || dep.semverClass === 'minor') {
      if (dep.repoUrl) {
        log(`  Fetching changelog for ${dep.name}...`)
        changelog = await fetchGitHubReleases(
          dep.repoUrl, dep.current, dep.latest, ghToken
        )
        changelogText = changelog.map((c) => c.body).join('\n\n')

        if (!changelogText) {
          changelogText = await fetchChangelogMd(dep.repoUrl, ghToken)
        }
      }
    }

    // AI analysis
    let aiResult = { breakingChanges: [] as any[], summary: '' }
    if (changelogText && (dep.semverClass === 'major' || dep.semverClass === 'minor')) {
      aiResult = await analyzeChangelog(
        dep.name, dep.current, dep.latest, changelogText, config?.ai
      )
    }

    const { score, level } = computeRiskScore(dep, aiResult.breakingChanges, changelog)

    results.push({
      dep,
      changelog,
      breakingChanges: aiResult.breakingChanges,
      aiSummary: aiResult.summary,
      riskScore: score,
      riskLevel: level,
    })
  }

  // Sort by risk score descending
  results.sort((a, b) => b.riskScore - a.riskScore)

  return {
    project: dir,
    scannedAt: new Date().toISOString(),
    ecosystem,
    total: deps.length,
    outdated: outdated.length,
    results,
  }
}

export { type ScanResult, type AnalysisResult, type PatchworkConfig } from './types'
