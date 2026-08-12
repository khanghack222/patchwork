// patchwork — AI analyzer
// Send changelog to LLM, extract breaking changes + summary

import type { BreakingChange, PatchworkConfig } from './types'

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

interface AIResponse {
  breakingChanges: BreakingChange[]
  summary: string
}

const SYSTEM_PROMPT = `You are a dependency upgrade analyst. Given a changelog or release notes for a package upgrade, extract:
1. Breaking changes (list each with a short description and migration hint if available)
2. A one-sentence summary of the upgrade risk

Respond in JSON format:
{
  "breakingChanges": [{"description": "...", "migrationHint": "..."}],
  "summary": "..."
}

If there are no breaking changes, return an empty array. Be concise.`

export async function analyzeChangelog(
  packageName: string,
  fromVersion: string,
  toVersion: string,
  changelogText: string,
  config?: PatchworkConfig['ai']
): Promise<AIResponse> {
  if (!changelogText.trim()) {
    return { breakingChanges: [], summary: 'No changelog available' }
  }

  const baseUrl = config?.baseUrl || DEFAULT_BASE_URL
  const model = config?.model || DEFAULT_MODEL
  const apiKey = config?.apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || ''

  if (!apiKey) {
    // No AI key — extract breaking changes heuristically
    return heuristicAnalysis(changelogText)
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Package: ${packageName}\nUpgrade: ${fromVersion} → ${toVersion}\n\nChangelog:\n${changelogText.slice(0, 3000)}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) return heuristicAnalysis(changelogText)

    const data = (await res.json()) as any
    const content = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(content) as AIResponse
    return {
      breakingChanges: parsed.breakingChanges || [],
      summary: parsed.summary || '',
    }
  } catch {
    return heuristicAnalysis(changelogText)
  }
}

// Fallback: simple keyword extraction when no AI available
function heuristicAnalysis(text: string): AIResponse {
  const breakingPatterns = [
    /break(?:ing)?[\s-]*change[s]?[:\s]*(.+)/gi,
    /BREAKING[:\s]*(.+)/g,
    /⚠️\s*(.+)/g,
    /removed[:\s]*(.+)/gi,
    /deprecated[:\s]*(.+)/gi,
  ]

  const breakingChanges: BreakingChange[] = []
  for (const pattern of breakingPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const desc = match[1].trim().slice(0, 120)
      if (desc && !breakingChanges.some((b) => b.description === desc)) {
        breakingChanges.push({ description: desc })
      }
    }
  }

  return {
    breakingChanges: breakingChanges.slice(0, 10),
    summary: breakingChanges.length
      ? `${breakingChanges.length} potential breaking change(s) detected via keyword scan`
      : 'No breaking changes detected (heuristic scan, no AI)',
  }
}
