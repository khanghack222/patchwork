// patchwork — Hono server for dashboard API
import { Hono } from 'hono'
import { serve } from 'bun'
import open from 'open'
import chalk from 'chalk'
import type { ScanResult } from '../core/types'

export async function startServer(result: ScanResult, port = 4567) {
  const app = new Hono()

  // API routes
  app.get('/api/scan', (c) => c.json(result))
  app.get('/api/overview', (c) =>
    c.json({
      total: result.total,
      outdated: result.outdated,
      high: result.results.filter((r) => r.riskLevel === 'high').length,
      medium: result.results.filter((r) => r.riskLevel === 'medium').length,
      low: result.results.filter((r) => r.riskLevel === 'low').length,
      scannedAt: result.scannedAt,
      ecosystem: result.ecosystem,
    })
  )
  app.get('/api/deps', (c) =>
    c.json(
      result.results.map((r) => ({
        name: r.dep.name,
        current: r.dep.current,
        latest: r.dep.latest,
        semverClass: r.dep.semverClass,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel,
        summary: r.aiSummary || '',
        breakingChanges: r.breakingChanges,
        repoUrl: r.dep.repoUrl,
      }))
    )
  )

  // Serve embedded dashboard (placeholder HTML for now)
  app.get('*', (c) =>
    c.html(dashboardHTML(port))
  )

  console.log(chalk.cyan(`\n  ⚡ Patchwork dashboard running at http://localhost:${port}\n`))
  console.log(chalk.gray('  Press Ctrl+C to stop\n'))

  serve({ fetch: app.fetch, port })

  // Open browser — catch error silently (sandbox/permission issues)
  open(`http://localhost:${port}`).catch(() => {})
}

function dashboardHTML(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Patchwork — Dependency Scanner</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Inter', system-ui, sans-serif; }
    body { background: #0a0e1a; color: #e2e8f0; }
    .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 16px; }
    .risk-high { color: #f87171; }
    .risk-medium { color: #fbbf24; }
    .risk-low { color: #4ade80; }
    .risk-badge-high { background: rgba(248,113,113,0.15); color: #f87171; }
    .risk-badge-medium { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .risk-badge-low { background: rgba(74,222,128,0.15); color: #4ade80; }
    .glow-high { box-shadow: 0 0 20px rgba(248,113,113,0.2); }
    .glow-medium { box-shadow: 0 0 20px rgba(251,191,36,0.15); }
    .stat-card { transition: transform 0.2s, box-shadow 0.2s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
    .fade-in { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .progress-bar { height: 6px; border-radius: 3px; background: #1e293b; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease-out; }
    .expand-btn { cursor: pointer; transition: transform 0.2s; }
    .expand-btn:hover { transform: scale(1.1); }
    .breaking-detail { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
    .breaking-detail.open { max-height: 500px; }
    .donut-ring { fill: none; stroke-width: 3; }
    .filter-btn { transition: all 0.2s; }
    .filter-btn.active { background: rgba(99,102,241,0.2); border-color: #6366f1; }
  </style>
</head>
<body class="min-h-screen p-6 md:p-10">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <header class="flex items-center justify-between mb-10 fade-in">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <span class="text-4xl">🧩</span> Patchwork
        </h1>
        <p class="text-slate-500 mt-1 text-sm">AI-powered dependency changelog scanner</p>
      </div>
      <div id="scan-time" class="text-xs text-slate-500"></div>
    </header>

    <!-- Stats Row -->
    <div id="stats" class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"></div>

    <!-- Risk Distribution -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="glass p-6 fade-in">
        <h3 class="text-sm font-medium text-slate-400 mb-4">Risk Distribution</h3>
        <div class="flex items-center justify-center">
          <svg id="donut" width="140" height="140" viewBox="0 0 42 42"></svg>
        </div>
        <div id="donut-legend" class="mt-4 space-y-2 text-xs"></div>
      </div>
      <div class="glass p-6 col-span-2 fade-in">
        <h3 class="text-sm font-medium text-slate-400 mb-4">Upgrade Urgency</h3>
        <div id="urgency-bars" class="space-y-3"></div>
      </div>
    </div>

    <!-- Filter -->
    <div class="flex items-center gap-2 mb-4 fade-in">
      <span class="text-xs text-slate-500">Filter:</span>
      <button class="filter-btn active text-xs px-3 py-1 rounded-full border border-slate-700" data-filter="all">All</button>
      <button class="filter-btn text-xs px-3 py-1 rounded-full border border-slate-700" data-filter="high">🔴 High</button>
      <button class="filter-btn text-xs px-3 py-1 rounded-full border border-slate-700" data-filter="medium">🟡 Medium</button>
      <button class="filter-btn text-xs px-3 py-1 rounded-full border border-slate-700" data-filter="low">🟢 Low</button>
    </div>

    <!-- Deps Table -->
    <div class="glass overflow-hidden fade-in">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-slate-400 border-b border-slate-700/50 bg-slate-800/30">
            <th class="px-6 py-3 font-medium">Package</th>
            <th class="px-4 py-3 font-medium">Current</th>
            <th class="px-4 py-3 font-medium">Latest</th>
            <th class="px-4 py-3 font-medium">Type</th>
            <th class="px-4 py-3 font-medium">Risk</th>
            <th class="px-6 py-3 font-medium">AI Summary</th>
            <th class="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody id="deps-body"></tbody>
      </table>
    </div>

    <!-- Footer -->
    <footer class="mt-10 text-center text-xs text-slate-600">
      patchwork v0.1.0 · <a href="https://github.com/user/patchwork" class="text-indigo-400 hover:underline">GitHub</a>
    </footer>
  </div>

  <script>
    let allDeps = []

    async function load() {
      const overview = await fetch('/api/overview').then(r => r.json())
      const deps = await fetch('/api/deps').then(r => r.json())
      allDeps = deps

      document.getElementById('scan-time').textContent = 'Scanned ' + new Date(overview.scannedAt).toLocaleString()

      // Stats
      document.getElementById('stats').innerHTML = [
        stat('Total Deps', overview.total, '📦', ''),
        stat('Outdated', overview.outdated, '⬆️', 'text-amber-400'),
        stat('High Risk', overview.high, '🔴', 'text-red-400'),
        stat('Medium Risk', overview.medium, '🟡', 'text-amber-300'),
        stat('Low Risk', overview.low, '🟢', 'text-green-400'),
      ].join('')

      // Donut chart
      renderDonut(overview.high, overview.medium, overview.low)

      // Urgency bars (top 5 risky)
      const top5 = deps.filter(d => d.riskScore > 0).slice(0, 5)
      document.getElementById('urgency-bars').innerHTML = top5.map(d => \`
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="font-medium">\${d.name}</span>
            <span class="risk-\${d.riskLevel}">\${d.riskScore}/100</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:\${d.riskScore}%;background:\${d.riskLevel==='high'?'#f87171':d.riskLevel==='medium'?'#fbbf24':'#4ade80'}"></div>
          </div>
        </div>
      \`).join('')

      renderDeps(deps)
      setupFilters()
    }

    function renderDeps(deps) {
      document.getElementById('deps-body').innerHTML = deps.map((d, i) => \`
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors" data-level="\${d.riskLevel}">
          <td class="px-6 py-3 font-medium">
            \${d.repoUrl ? \`<a href="\${d.repoUrl}" target="_blank" class="text-blue-400 hover:text-blue-300 hover:underline">\${d.name}</a>\` : d.name}
          </td>
          <td class="px-4 py-3 text-slate-400 font-mono text-xs">\${d.current}</td>
          <td class="px-4 py-3 text-green-400 font-mono text-xs">\${d.latest}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded text-xs \${d.semverClass==='major'?'bg-red-500/10 text-red-300':d.semverClass==='minor'?'bg-amber-500/10 text-amber-300':'bg-slate-500/10 text-slate-300'}">\${d.semverClass}</span>
          </td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded text-xs font-semibold risk-badge-\${d.riskLevel}">\${d.riskScore}</span>
          </td>
          <td class="px-6 py-3 text-slate-300 text-xs max-w-[300px] truncate">\${d.summary || '—'}</td>
          <td class="px-4 py-3">
            \${d.breakingChanges.length ? \`<button class="expand-btn text-lg" onclick="toggle(\${i})">▶</button>\` : ''}
          </td>
        </tr>
        \${d.breakingChanges.length ? \`
        <tr class="bg-slate-900/50" data-level="\${d.riskLevel}">
          <td colspan="7" class="px-6">
            <div id="detail-\${i}" class="breaking-detail">
              <div class="py-3 space-y-1">
                <div class="text-xs font-semibold text-slate-400 mb-2">Breaking Changes:</div>
                \${d.breakingChanges.map(bc => \`
                  <div class="flex items-start gap-2 text-xs">
                    <span class="text-red-400 mt-0.5">•</span>
                    <span class="text-slate-300">\${bc.description}\${bc.migrationHint ? \` <span class="text-indigo-400">→ \${bc.migrationHint}</span>\` : ''}</span>
                  </div>
                \`).join('')}
              </div>
            </div>
          </td>
        </tr>\` : ''}
      \`).join('')
    }

    function toggle(i) {
      const el = document.getElementById('detail-' + i)
      el.classList.toggle('open')
    }

    function setupFilters() {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          const f = btn.dataset.filter
          const filtered = f === 'all' ? allDeps : allDeps.filter(d => d.riskLevel === f)
          renderDeps(filtered)
        })
      })
    }

    function renderDonut(high, medium, low) {
      const total = high + medium + low || 1
      const r = 15.9, cx = 21, cy = 21, circumference = 2 * Math.PI * r
      let offset = 0
      const segments = [
        { value: high, color: '#f87171', label: 'High' },
        { value: medium, color: '#fbbf24', label: 'Medium' },
        { value: low, color: '#4ade80', label: 'Low' },
      ]

      let svg = \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" fill="none" stroke="#1e293b" stroke-width="4"/>\`
      segments.forEach(seg => {
        const pct = seg.value / total
        const dash = pct * circumference
        svg += \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" class="donut-ring" stroke="\${seg.color}" stroke-dasharray="\${dash} \${circumference - dash}" stroke-dashoffset="-\${offset}" transform="rotate(-90 \${cx} \${cy})"/>\`
        offset += dash
      })
      svg += \`<text x="\${cx}" y="\${cy}" text-anchor="middle" dy="0.35em" fill="#e2e8f0" font-size="6" font-weight="bold">\${total}</text>\`
      document.getElementById('donut').innerHTML = svg

      document.getElementById('donut-legend').innerHTML = segments.map(s =>
        \`<div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:\${s.color}"></span><span class="text-slate-300">\${s.label}: \${s.value}</span></div>\`
      ).join('')
    }

    function stat(label, value, icon, colorClass) {
      return \`<div class="glass p-4 stat-card fade-in">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-lg">\${icon}</span>
          <span class="text-xs text-slate-400">\${label}</span>
        </div>
        <div class="text-2xl font-bold \${colorClass}">\${value}</div>
      </div>\`
    }

    load()
  </script>
</body>
</html>`
}
