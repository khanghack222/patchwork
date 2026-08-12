// patchwork — core types

export interface DepInfo {
  name: string
  current: string
  latest: string
  semverClass: 'major' | 'minor' | 'patch' | 'prerelease' | 'unknown'
  ecosystem: Ecosystem
  repoUrl?: string
}

export interface ChangelogEntry {
  version: string
  date?: string
  body: string
  url?: string
}

export interface BreakingChange {
  description: string
  migrationHint?: string
}

export interface AnalysisResult {
  dep: DepInfo
  changelog: ChangelogEntry[]
  breakingChanges: BreakingChange[]
  aiSummary?: string
  riskScore: number
  riskLevel: 'high' | 'medium' | 'low'
}

export interface ScanResult {
  project: string
  scannedAt: string
  ecosystem: Ecosystem
  total: number
  outdated: number
  results: AnalysisResult[]
}

export type Ecosystem = 'npm' | 'pip' | 'cargo' | 'go' | 'composer'

export interface PatchworkConfig {
  ai?: {
    provider: 'groq' | 'openrouter' | 'gemini' | 'custom'
    apiKey?: string
    baseUrl?: string
    model?: string
  }
  ecosystems?: Ecosystem[]
  githubToken?: string
  cache?: {
    dir?: string
    ttl?: number // hours
  }
}
