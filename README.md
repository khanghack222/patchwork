<div align="center">

# 🧩 Patchwork

**AI-powered dependency changelog scanner.**\
Detect breaking changes before they break you.

[![npm version](https://img.shields.io/npm/v/patchwork-cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/patchwork-cli)
[![CI](https://github.com/khanghack222/patchwork/actions/workflows/ci.yml/badge.svg)](https://github.com/khanghack222/patchwork/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<br>

<img src="https://raw.githubusercontent.com/khanghack222/patchwork/master/assets/demo.gif" alt="Patchwork Demo" width="720">

<br>

**Dependabot opens PRs. Patchwork tells you _what actually broke_.**

[Getting Started](#getting-started) · [Dashboard](#dashboard) · [Configuration](#configuration) · [中文](#中文)

</div>

---

## Why Patchwork?

You have 80+ dependencies. Renovate/Dependabot opens 15 PRs this week. Do you read every changelog? No. You merge blindly and pray.

**Patchwork** scans your deps, fetches changelogs from GitHub Releases, sends them through a free LLM, and tells you:
- Which upgrades have **breaking changes**
- What the **migration path** looks like
- A **risk score** (0-100) so you know what to upgrade first

All in one command. Zero cost (uses free LLMs).

## Getting Started

```bash
# Install globally
bun add -g patchwork-cli
# or use npx
npx patchwork-cli scan

# Scan current project
patchwork scan

# Scan + open web dashboard
patchwork scan --dashboard

# Watch mode (re-scan on lockfile change)
patchwork watch
```

## Dashboard

```bash
patchwork scan --dashboard
```

Opens a local web dashboard at `http://localhost:4567` with:
- 📊 Risk distribution donut chart
- 🎯 Top 5 urgency bars
- 🔍 Filterable dependency table
- 📖 Expandable breaking change details

<!-- TODO: Add actual screenshot -->

## CLI Output

```
  8 outdated dependencies (9 total)

┌──────────────────────┬─────────┬─────────┬───────┬──────┬────────────────────────────────────────┐
│ Package              │ Current │ Latest  │ Type  │ Risk │ Summary                                │
├──────────────────────┼─────────┼─────────┼───────┼──────┼────────────────────────────────────────┤
│ commander            │ 13.1.0  │ 15.0.0  │ major │ 🔴 62│ 2 breaking: removed .opts() shorthand  │
│ chalk                │ 5.3.0   │ 6.0.0   │ major │ 🔴 51│ ESM-only, dropped Node 14 support      │
│ hono                 │ 4.7.0   │ 4.9.2   │ minor │ 🟡 20│ No breaking changes detected            │
│ ora                  │ 8.1.0   │ 8.2.1   │ patch │ 🟢 0 │ Bug fixes only                         │
└──────────────────────┴─────────┴─────────┴───────┴──────┴────────────────────────────────────────┘
```

## Supported Ecosystems

| Ecosystem | Lockfile | Registry |
|:---------:|:--------:|:--------:|
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" width="20"> npm | `package.json` | registry.npmjs.org |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" width="20"> pip | `requirements.txt` / `pyproject.toml` | pypi.org |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg" width="20"> Cargo | `Cargo.toml` | crates.io |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg" width="20"> Go | `go.mod` | proxy.golang.org |

Patchwork auto-detects the ecosystem from your project root.

## Commands

| Command | Description |
|---------|-------------|
| `patchwork scan` | Scan deps, show terminal table |
| `patchwork scan --dashboard` | Scan + open web dashboard |
| `patchwork scan --format md` | Output as Markdown report |
| `patchwork scan --format json` | Output as JSON |
| `patchwork scan --no-ai` | Skip AI, use heuristic only |
| `patchwork watch` | Watch lockfiles, re-scan on change |
| `patchwork serve` | Start dashboard from cached results |
| `patchwork init` | Create config file |

## Configuration

```bash
patchwork init
```

```typescript
// patchwork.config.ts
import type { PatchworkConfig } from 'patchwork-cli'

const config: PatchworkConfig = {
  ai: {
    provider: 'groq',           // groq | openrouter | gemini | custom
    // apiKey: process.env.GROQ_API_KEY,
    // model: 'llama-3.3-70b-versatile',
  },
  ecosystems: ['npm'],          // npm | pip | cargo | go
  // githubToken: process.env.GITHUB_TOKEN,
}

export default config
```

## AI Providers (all free tier)

| Provider | Model | Free Limit |
|:--------:|:-----:|:----------:|
| [Groq](https://groq.com) | Llama 3.3 70B | 14,400 req/day |
| [Google AI Studio](https://aistudio.google.com) | Gemini 2.5 Flash | 1,440 req/day |
| [OpenRouter](https://openrouter.ai) | Various `:free` | 50 req/day |

Or bring your own OpenAI-compatible endpoint:

```typescript
ai: {
  provider: 'custom',
  baseUrl: 'https://api.your-provider.com/v1',
  apiKey: process.env.YOUR_KEY,
  model: 'your-model',
}
```

## How It Works

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌────────┐
│  Scan   │───▶│  Check  │───▶│ Classify │───▶│  Fetch  │───▶│ Analyze  │───▶│ Score  │
│lockfile │    │registry │    │ semver   │    │changelog│    │  AI/LLM  │    │ 0-100  │
└─────────┘    └─────────┘    └──────────┘    └─────────┘    └──────────┘    └────────┘
```

1. **Scan** — Parse lockfile for current versions
2. **Check** — Query package registry for latest versions
3. **Classify** — SemVer diff → major / minor / patch
4. **Fetch** — Get GitHub Releases + CHANGELOG.md
5. **Analyze** — LLM extracts breaking changes + migration hints
6. **Score** — Risk 0-100 based on semver, breaking count, staleness

## Risk Scoring

```
risk = base(semver) + breaking_count × 10 + age_penalty
```

| SemVer | Base Score | Typical Level |
|:------:|:----------:|:-------------:|
| Major | 40 | 🔴 High (51-100) |
| Minor | 10 | 🟡 Medium (16-50) |
| Patch | 0 | 🟢 Low (0-15) |

## Docker

```bash
docker build -t patchwork .
docker run -v $(pwd):/app -w /app patchwork scan
```

## Comparison

| Feature | Patchwork | Dependabot | Renovate | npm-check |
|:--------|:---------:|:----------:|:--------:|:---------:|
| AI changelog summary | ✅ | ❌ | ❌ | ❌ |
| Risk scoring | ✅ | ❌ | ❌ | ❌ |
| Web dashboard | ✅ | ❌ | ❌ | ❌ |
| Multi-ecosystem | ✅ 4 | ✅ | ✅ | npm only |
| Self-hosted | ✅ | ❌ SaaS | ✅ | ✅ |
| Zero config | ✅ | ✅ | ❌ | ✅ |
| Free LLM | ✅ | — | — | — |
| One command | ✅ | ❌ | ❌ | ✅ |

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

---

<a name="中文"></a>

<div align="center">

## 中文

</div>

**Patchwork** 是一款 AI 驱动的依赖变更日志扫描器。

Dependabot 只开 PR，Patchwork 告诉你**到底哪里破坏了兼容性**。

### 特性

- 🔍 多语言生态 — npm、pip、Cargo、Go
- 🤖 AI 分析 — 用免费 LLM（Groq/Gemini）总结 changelog
- 📊 风险评分 — 0-100 分，基于 semver + breaking changes + 版本年龄
- 🖥️ Web 面板 — 暗色主题毛玻璃 UI、图表、筛选、展开详情
- ⚡ 零配置 — 一个命令开箱即用
- 👀 监听模式 — lockfile 变化自动重扫

```bash
bun add -g patchwork-cli
patchwork scan --dashboard
```

### 为什么不用 Dependabot？

| | Patchwork | Dependabot |
|--|:-:|:-:|
| 告诉你破坏性变更内容 | ✅ | ❌ |
| 风险评分排序 | ✅ | ❌ |
| 可视化面板 | ✅ | ❌ |
| 本地运行 | ✅ | ❌ |
| 免费 AI 分析 | ✅ | — |
