<div align="center">

# 🧩 Patchwork

**AI-powered dependency changelog scanner.**
Detect breaking changes before they break you.

[![npm](https://img.shields.io/npm/v/patchwork-cli?color=blue)](https://www.npmjs.com/package/patchwork-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[English](#features) · [中文](#中文)

</div>

---

## Features

- 🔍 **Multi-ecosystem** — npm, pip, Cargo, Go modules
- 🤖 **AI-powered analysis** — Summarize changelogs with free LLMs (Groq, Gemini, OpenRouter)
- 📊 **Risk scoring** — 0-100 score per dependency based on semver, breaking changes, age
- 🎯 **Breaking change extraction** — Regex heuristic fallback when no AI key
- 🖥️ **Web dashboard** — Glass morphism dark UI with donut charts, filters, expandable rows
- ⚡ **Zero config** — Works out of the box, scans your project in seconds
- 👀 **Watch mode** — Re-scan on lockfile change

## Quick Start

```bash
# Install
bun add -g patchwork-cli
# or
npx patchwork-cli scan

# Scan current project
patchwork scan

# Scan with web dashboard
patchwork scan --dashboard

# Watch mode
patchwork watch

# Output as markdown
patchwork scan --format md
```

## Dashboard

```bash
patchwork scan --dashboard
# Opens http://localhost:4567
```

<!-- TODO: screenshot/GIF here -->

## CLI Commands

| Command | Description |
|---------|-------------|
| `patchwork scan` | Scan deps, show terminal table |
| `patchwork scan --dashboard` | Scan + open web dashboard |
| `patchwork scan --format md` | Output as Markdown report |
| `patchwork scan --format json` | Output as JSON |
| `patchwork scan --no-ai` | Skip AI, use heuristic only |
| `patchwork watch` | Watch lockfiles, re-scan on change |
| `patchwork serve` | Start dashboard from cached results |
| `patchwork init` | Create `patchwork.config.ts` |

## Configuration

```bash
patchwork init
```

Creates `patchwork.config.ts`:

```typescript
import type { PatchworkConfig } from 'patchwork-cli'

const config: PatchworkConfig = {
  ai: {
    provider: 'groq',          // groq | openrouter | gemini | custom
    // apiKey: process.env.GROQ_API_KEY,
    // model: 'llama-3.3-70b-versatile',
  },
  ecosystems: ['npm'],         // npm | pip | cargo | go
  // githubToken: process.env.GITHUB_TOKEN,
}

export default config
```

## AI Providers (all free)

| Provider | Model | Free Limit |
|----------|-------|------------|
| **Groq** | Llama 3.3 70B | 14,400 req/day |
| **Google AI Studio** | Gemini 2.5 Flash | 1,440 req/day |
| **OpenRouter** | Various `:free` models | 50 req/day |

Set any OpenAI-compatible endpoint:

```typescript
ai: {
  provider: 'custom',
  baseUrl: 'https://your-endpoint/v1',
  apiKey: process.env.YOUR_KEY,
  model: 'your-model',
}
```

## Risk Scoring

```
score = base(semver) + breaking_changes × 10 + age_penalty
```

| SemVer | Base | Level |
|--------|------|-------|
| Major | 40 | 🔴 High (51-100) |
| Minor | 10 | 🟡 Medium (16-50) |
| Patch | 0 | 🟢 Low (0-15) |

## Docker

```bash
docker build -t patchwork .
docker run -v $(pwd):/app patchwork scan
```

## How It Works

1. **Scan** — Detect lockfiles, parse current versions
2. **Check** — Query registry (npm/PyPI/crates.io/proxy.golang.org) for latest
3. **Classify** — SemVer diff → major/minor/patch
4. **Fetch** — Get GitHub Releases + CHANGELOG.md for major/minor upgrades
5. **Analyze** — Send to LLM → extract breaking changes + migration hints
6. **Score** — Risk 0-100 based on semver class, breaking count, age
7. **Report** — Terminal table, Markdown, JSON, or web dashboard

## Supported Ecosystems

| Ecosystem | Lockfile | Registry |
|-----------|----------|----------|
| npm | `package.json` | registry.npmjs.org |
| pip | `requirements.txt` / `pyproject.toml` | pypi.org |
| Cargo | `Cargo.toml` | crates.io |
| Go | `go.mod` | proxy.golang.org |

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

---

<a name="中文"></a>

## 中文

**Patchwork** 是一款 AI 驱动的依赖变更日志扫描器。自动检测项目依赖的破坏性更新，在它们破坏你的代码之前。

### 特性

- 🔍 多生态 — npm、pip、Cargo、Go
- 🤖 AI 分析 — 用免费 LLM 总结 changelog
- 📊 风险评分 — 0-100 分，基于 semver + breaking changes
- 🖥️ Web 面板 — 暗色主题，图表，筛选，展开详情
- ⚡ 零配置 — 开箱即用

```bash
bun add -g patchwork-cli
patchwork scan --dashboard
```
