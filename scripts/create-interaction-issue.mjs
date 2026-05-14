#!/usr/bin/env node
// Creates a GitHub Issue when interaction tests fail or are flaky.
// Called by the create-issue job in .github/workflows/interaction-tests.yml.
//
// Input env vars:
//   INTERACTION_RESULT  – GitHub Actions job result ('success'|'failure'|...)
//   RUN_URL             – full URL to the Actions run
//
// Input files:
//   interaction-reports/<artifact-name>/interaction-report.json
//     (one per browser project, downloaded from artifacts)

import { execSync }                                  from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join }                                      from 'node:path'

const REPORTS_DIR = 'interaction-reports'
const HARD_FAILED = process.env.INTERACTION_RESULT === 'failure'
const RUN_URL     = process.env.RUN_URL ?? '(no URL)'
const TODAY       = new Date().toISOString().slice(0, 10)

// ── Collect failures and flaky tests from all per-project JSON reports ────

const failures = []
const flakies  = []

function walkSuite(suite, project, breadcrumb = []) {
  const path = suite.title ? [...breadcrumb, suite.title] : breadcrumb
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const title = [...path, spec.title].join(' › ')
      if (test.status === 'unexpected') {
        failures.push({ project, title })
      } else if (test.status === 'flaky') {
        flakies.push({ project, title, retries: (test.results?.length ?? 1) - 1 })
      }
    }
  }
  for (const s of suite.suites ?? []) walkSuite(s, project, path)
}

if (existsSync(REPORTS_DIR)) {
  for (const dir of readdirSync(REPORTS_DIR)) {
    const reportPath = join(REPORTS_DIR, dir, 'interaction-report.json')
    if (!existsSync(reportPath)) continue
    const project = dir.replace(/^interaction-report-/, '')
    let data
    try { data = JSON.parse(readFileSync(reportPath, 'utf8')) } catch { continue }
    for (const s of data.suites ?? []) walkSuite(s, project)
  }
}

// ── Decide whether an issue is needed ─────────────────────────────────────

const hasFailures = HARD_FAILED || failures.length > 0
const hasFlakies  = flakies.length > 0

if (!hasFailures && !hasFlakies) {
  console.log('All interaction tests passed cleanly – no issue needed.')
  process.exit(0)
}

// ── Deduplicate: skip if today's issue is already open ───────────────────

try {
  const open = execSync(
    `gh issue list --label "interaction-tests" --state open --json title --jq '.[].title'`,
    { encoding: 'utf8' },
  ).trim()
  if (open.includes(TODAY)) {
    console.log(`Open issue for ${TODAY} already exists – skipping.`)
    process.exit(0)
  }
} catch {
  // Label may not exist yet; continue to create label + issue below.
}

// ── Build issue body ──────────────────────────────────────────────────────

const lines = []
lines.push(`## Interaction Tests – ${TODAY}`)
lines.push('')
lines.push(`**CI-Lauf:** ${RUN_URL}`)
lines.push('')

if (failures.length > 0) {
  lines.push('### ❌ Fehlgeschlagene Tests')
  lines.push('')
  for (const f of failures) lines.push(`- \`[${f.project}]\` ${f.title}`)
  lines.push('')
}

if (flakies.length > 0) {
  lines.push('### ⚠️ Flaky Tests (erst nach Retry bestanden)')
  lines.push('')
  for (const f of flakies) lines.push(`- \`[${f.project}]\` ${f.title} *(${f.retries} Retry/s)*`)
  lines.push('')
}

if (HARD_FAILED && failures.length === 0) {
  lines.push('### ⚠️ Hinweis')
  lines.push('')
  lines.push(
    'Mindestens ein Job ist fehlgeschlagen, das JSON-Report enthält aber keine expliziten ' +
    'Test-Failures. Mögliche Ursache: Build-Fehler, Browser-Start-Fehler oder Timeout vor ' +
    'dem ersten Test.',
  )
  lines.push('')
}

lines.push('### Nächste Schritte')
lines.push('')
lines.push('1. Trace-Artefakte im CI-Lauf herunterladen: `npx playwright show-trace <trace.zip>`')
lines.push('2. Ursache identifizieren: Timing-Problem, App-Regression oder Testfehler')
lines.push('3. Fix committen und dieses Issue schließen')

const title = hasFailures
  ? `❌ Interaction Tests fehlgeschlagen – ${TODAY}`
  : `⚠️ Flaky Interaction Tests – ${TODAY}`

writeFileSync('/tmp/interaction-issue-body.md', lines.join('\n'))

// ── Ensure label exists ───────────────────────────────────────────────────

try {
  execSync(
    `gh label create "interaction-tests" ` +
    `--color "e4e669" ` +
    `--description "Automatisch: Interaction-Test-Ergebnis" ` +
    `--force`,
    { stdio: 'pipe' },
  )
} catch {
  // Already exists or insufficient permissions – ignore.
}

// ── Create issue ──────────────────────────────────────────────────────────

execSync(
  `gh issue create ` +
  `--title ${JSON.stringify(title)} ` +
  `--body-file /tmp/interaction-issue-body.md ` +
  `--label "interaction-tests"`,
  { stdio: 'inherit' },
)
