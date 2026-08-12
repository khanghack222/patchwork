// patchwork — CLI entry point
import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import ora from 'ora'
import { resolve } from 'node:path'
import { writeFile, readFile } from 'node:fs/promises'
import { scan } from '../core/index'
import type { PatchworkConfig, ScanResult } from '../core/types'

const program = new Command()

program
  .name('patchwork')
  .description('AI-powered dependency changelog scanner. Detect breaking changes before they break you.')
  .version('0.1.0')

program
  .command('scan')
  .description('Scan dependencies for outdated packages and breaking changes')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-f, --format <type>', 'Output format: table, md, json', 'table')
  .option('--dashboard', 'Open web dashboard after scan')
  .option('--no-ai', 'Skip AI analysis, use heuristic only')
  .action(async (opts) => {
    const dir = resolve(opts.dir)
    const spinner = ora('Scanning dependencies...').start()

    const config = await loadConfig(dir)
    if (opts.noAi) {
      if (config.ai) config.ai.apiKey = ''
    }

    let result: ScanResult
    try {
      result = await scan(dir, config, (msg) => {
        spinner.text = msg
      })
      spinner.succeed(`Scan complete: ${result.outdated}/${result.total} outdated`)
    } catch (e: any) {
      spinner.fail(`Scan failed: ${e.message}`)
      process.exit(1)
    }

    // Cache result for dashboard
    const cachePath = resolve(dir, '.patchwork', 'scan-result.json')
    await writeFile(cachePath, JSON.stringify(result, null, 2)).catch(() =>
      writeFile(resolve(dir, '.patchwork-result.json'), JSON.stringify(result, null, 2))
    )

    // Output
    switch (opts.format) {
      case 'json':
        console.log(JSON.stringify(result, null, 2))
        break
      case 'md':
        console.log(renderMarkdown(result))
        break
      default:
        renderTable(result)
    }

    if (opts.dashboard) {
      const { startServer } = await import('./server')
      await startServer(result)
    }
  })

program
  .command('serve')
  .description('Start dashboard server from cached scan results')
  .option('-p, --port <port>', 'Port number', '4567')
  .action(async (opts) => {
    const dir = resolve('.')
    const cachePath = resolve(dir, '.patchwork-result.json')
    let result: ScanResult
    try {
      const raw = await readFile(cachePath, 'utf-8')
      result = JSON.parse(raw)
    } catch {
      console.log(chalk.yellow('No cached scan results. Run `patchwork scan` first.'))
      process.exit(1)
    }
    const { startServer } = await import('./server')
    await startServer(result, Number(opts.port))
  })

program
  .command('watch')
  .description('Watch for lockfile changes and re-scan automatically')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('--dashboard', 'Open web dashboard')
  .action(async (opts) => {
    const dir = resolve(opts.dir)
    const { watch: fsWatch } = await import('node:fs')
    const config = await loadConfig(dir)

    // Detect which file to watch
    const watchFiles = ['package.json', 'requirements.txt', 'pyproject.toml', 'Cargo.toml', 'go.mod']

    console.log(chalk.cyan('\n  👀 Watching for dependency changes...\n'))
    console.log(chalk.gray(`  Watching: ${watchFiles.join(', ')}`))
    console.log(chalk.gray('  Press Ctrl+C to stop\n'))

    let debounce: ReturnType<typeof setTimeout> | null = null

    const runScan = async () => {
      const spinner = ora('Re-scanning dependencies...').start()
      try {
        const result = await scan(dir, config, (msg) => { spinner.text = msg })
        spinner.succeed(`Scan complete: ${result.outdated}/${result.total} outdated`)
        renderTable(result)

        // Update cache
        const cachePath = resolve(dir, '.patchwork-result.json')
        await writeFile(cachePath, JSON.stringify(result, null, 2))
      } catch (e: any) {
        spinner.fail(`Scan failed: ${e.message}`)
      }
    }

    // Initial scan
    await runScan()

    // Watch lockfiles
    for (const file of watchFiles) {
      try {
        fsWatch(resolve(dir, file), () => {
          if (debounce) clearTimeout(debounce)
          debounce = setTimeout(runScan, 1000)
        })
      } catch {}
    }

    // Keep alive
    await new Promise(() => {})
  })

program
  .command('init')
  .description('Create patchwork.config.ts in current directory')
  .action(async () => {
    const configContent = `import type { PatchworkConfig } from 'patchwork-cli'

const config: PatchworkConfig = {
  ai: {
    provider: 'groq',
    // apiKey: process.env.GROQ_API_KEY,
    // model: 'llama-3.3-70b-versatile',
  },
  // githubToken: process.env.GITHUB_TOKEN,
  ecosystems: ['npm'],
}

export default config
`
    await writeFile('patchwork.config.ts', configContent)
    console.log(chalk.green('✓ Created patchwork.config.ts'))
  })

program.parse()

// --- helpers ---

async function loadConfig(dir: string): Promise<PatchworkConfig> {
  try {
    const configPath = resolve(dir, 'patchwork.config.ts')
    const mod = await import(configPath)
    return mod.default || {}
  } catch {
    return {}
  }
}

function renderTable(result: ScanResult) {
  if (!result.results.length) {
    console.log(chalk.green('\n✓ All dependencies are up to date!\n'))
    return
  }

  console.log(
    chalk.bold(`\n  ${result.outdated} outdated dependencies (${result.total} total)\n`)
  )

  const table = new Table({
    head: ['Package', 'Current', 'Latest', 'Type', 'Risk', 'Summary'].map((h) =>
      chalk.cyan(h)
    ),
    colWidths: [22, 10, 10, 7, 6, 40],
    wordWrap: true,
  })

  for (const r of result.results) {
    const riskIcon =
      r.riskLevel === 'high' ? chalk.red('🔴') :
      r.riskLevel === 'medium' ? chalk.yellow('🟡') :
      chalk.green('🟢')

    table.push([
      r.dep.name,
      r.dep.current,
      chalk.green(r.dep.latest),
      r.dep.semverClass,
      `${riskIcon} ${r.riskScore}`,
      (r.aiSummary || '').slice(0, 60) || '-',
    ])
  }

  console.log(table.toString())
  console.log('')
}

function renderMarkdown(result: ScanResult): string {
  const lines: string[] = [
    `# Patchwork Scan Report`,
    '',
    `**Project:** ${result.project}`,
    `**Scanned:** ${result.scannedAt}`,
    `**Outdated:** ${result.outdated}/${result.total}`,
    '',
    '## Dependencies',
    '',
    '| Package | Current | Latest | Type | Risk | Summary |',
    '|---------|---------|--------|------|------|---------|',
  ]

  for (const r of result.results) {
    const risk = r.riskLevel === 'high' ? '🔴' : r.riskLevel === 'medium' ? '🟡' : '🟢'
    lines.push(
      `| ${r.dep.name} | ${r.dep.current} | ${r.dep.latest} | ${r.dep.semverClass} | ${risk} ${r.riskScore} | ${(r.aiSummary || '-').slice(0, 80)} |`
    )
  }

  // Breaking changes detail
  const withBreaking = result.results.filter((r) => r.breakingChanges.length > 0)
  if (withBreaking.length) {
    lines.push('', '## Breaking Changes', '')
    for (const r of withBreaking) {
      lines.push(`### ${r.dep.name} (${r.dep.current} → ${r.dep.latest})`, '')
      for (const bc of r.breakingChanges) {
        lines.push(`- ${bc.description}${bc.migrationHint ? ` → *${bc.migrationHint}*` : ''}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
