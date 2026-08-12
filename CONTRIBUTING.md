# Contributing to Patchwork

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone
git clone https://github.com/YOUR_USER/patchwork.git
cd patchwork

# Install (requires Bun)
bun install

# Run
bun run scan
bun run serve
```

## Project Structure

```
packages/
├── core/           # Business logic (scanners, fetchers, analyzer, scorer)
│   ├── scanners/   # Lockfile parsers (npm, pip, cargo, go)
│   ├── fetchers/   # Registry + changelog fetchers
│   ├── analyzer.ts # AI analysis + heuristic fallback
│   ├── scorer.ts   # Risk scoring
│   └── types.ts    # Shared types
├── cli/            # CLI entry + Hono dashboard server
│   ├── index.ts    # Commands: scan, watch, serve, init
│   └── server.ts   # Dashboard API + embedded HTML
```

## Adding a New Ecosystem

1. Create `packages/core/scanners/<ecosystem>.ts` — parse lockfile
2. Create `packages/core/fetchers/<ecosystem>.ts` — query registry for latest version
3. Register in `packages/core/index.ts` (`scanDeps` + `fetchLatest` switches)
4. Add to `Ecosystem` type in `packages/core/types.ts`
5. Test with a real project

## Pull Request Guidelines

- Keep PRs focused on a single change
- Add tests for new scanners/fetchers
- Run `bun run scan` on a real project to verify
- Follow existing code style (no Prettier config — just match the surrounding code)

## Issues

Found a bug? Open an issue with:
- OS + Bun version
- The command you ran
- Expected vs actual output
- Relevant lockfile snippet (if applicable)
