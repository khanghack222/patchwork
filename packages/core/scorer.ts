// patchwork — SemVer classifier + risk scorer

import type { DepInfo, AnalysisResult, BreakingChange } from './types'

export function classifySemver(current: string, latest: string): DepInfo['semverClass'] {
  if (!current || !latest) return 'unknown'

  const [cMaj, cMin] = current.split('.').map(Number)
  const [lMaj, lMin] = latest.split('.').map(Number)

  if (isNaN(cMaj) || isNaN(lMaj)) return 'unknown'
  if (lMaj > cMaj) return 'major'
  if (lMin > cMin) return 'minor'
  return 'patch'
}

export function computeRiskScore(
  dep: DepInfo,
  breakingChanges: BreakingChange[],
  changelog: { date?: string }[]
): { score: number; level: AnalysisResult['riskLevel'] } {
  let score = 0

  // Base score from semver class
  switch (dep.semverClass) {
    case 'major': score += 40; break
    case 'minor': score += 10; break
    case 'patch': score += 0; break
    default: score += 5
  }

  // Breaking changes penalty
  score += Math.min(breakingChanges.length * 10, 40)

  // Age penalty: if latest release is >6 months old, add penalty
  // (indicates dep might be abandoned or user is very behind)
  const latestDate = changelog[0]?.date
  if (latestDate) {
    const age = Date.now() - new Date(latestDate).getTime()
    const months = age / (30 * 24 * 60 * 60 * 1000)
    if (months > 12) score += 10
    else if (months > 6) score += 5
  }

  score = Math.min(score, 100)

  const level: AnalysisResult['riskLevel'] =
    score >= 51 ? 'high' : score >= 16 ? 'medium' : 'low'

  return { score, level }
}
