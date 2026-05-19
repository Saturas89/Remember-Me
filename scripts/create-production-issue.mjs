#!/usr/bin/env node
// Creates a GitHub Issue when production nightly tests fail or are flaky.
// Called by the create-issue job in .github/workflows/nightly-production.yml.
//
// Input env vars:
//   PRODUCTION_RESULT    – GitHub Actions job result ('success'|'failure'|...)
//   RUN_URL              – full URL to the Actions run
//   GITHUB_RUN_ID        – numeric run ID (for PostHog correlation link)
//   POSTHOG_PROJECT_ID   – optional; enables PostHog replay link in the issue

import { execSync }                                  from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join }                                      from 'node:path'

const REPORTS_DIR              = 'production-reports'
const HARD_FAILED              = process.env.PRODUCTION_RESULT === 'failure' ||
                                 process.env.PRODUCTION_NIGHTLY_RESULT === 'failure'
const RUN_URL                  = process.env.RUN_URL         ?? '(no URL)'
const GITHUB_RUN_ID            = process.env.GITHUB_RUN_ID   ?? ''
const POSTHOG_PROJECT          = process.env.POSTHOG_PROJECT_ID ?? ''
const TEST_RUN_ID              = GITHUB_RUN_ID ? `gh-${GITHUB_RUN_ID}` : ''
const TODAY                    = new Date().toISOString().slice(0, 10)

// ── Collect failures and flaky tests from all per-browser JSON reports ────

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
    const reportPath = join(REPORTS_DIR, dir, 'production-report.json')
    if (!existsSync(reportPath)) continue
    const project = dir.replace(/^production-report-/, '')
    let data
    try { data = JSON.parse(readFileSync(reportPath, 'utf8')) } catch { continue }
    for (const s of data.suites ?? []) walkSuite(s, project)
  }
}

// ── Decide whether an issue is needed ─────────────────────────────────────

const hasFailures = HARD_FAILED || failures.length > 0
const hasFlakies  = flakies.length > 0

if (!hasFailures && !hasFlakies) {
  console.log('All production tests passed cleanly – no issue needed.')
  process.exit(0)
}

// ── Deduplicate: comment on today's issue if already open ────────────────

try {
  const openJson = execSync(
    `gh issue list --label "nightly-production" --state open --json number,title`,
    { encoding: 'utf8' },
  ).trim()
  const openIssues = JSON.parse(openJson || '[]')
  const existing = openIssues.find(i => i.title.includes(TODAY))
  if (existing) {
    const commentLines = []
    commentLines.push(`## Weiterer fehlgeschlagener Run – [#${GITHUB_RUN_ID}](${RUN_URL})`)
    commentLines.push('')
    if (failures.length > 0) {
      commentLines.push('### ❌ Fehlgeschlagene Tests')
      commentLines.push('')
      for (const f of failures) commentLines.push(`- \`[${f.project}]\` ${f.title}`)
      commentLines.push('')
    }
    if (flakies.length > 0) {
      commentLines.push('### ⚠️ Flaky Tests')
      commentLines.push('')
      for (const f of flakies) commentLines.push(`- \`[${f.project}]\` ${f.title} *(${f.retries} Retry/s)*`)
      commentLines.push('')
    }
    if (HARD_FAILED && failures.length === 0) {
      commentLines.push('Job fehlgeschlagen, aber kein JSON-Report vorhanden (Browser-Start-Fehler, Netzwerkproblem oder Timeout).')
      commentLines.push('')
    }
    writeFileSync('/tmp/production-comment-body.md', commentLines.join('\n'))
    execSync(
      `gh issue comment ${existing.number} --body-file /tmp/production-comment-body.md`,
      { stdio: 'inherit' },
    )
    console.log(`Kommentar an bestehendes Issue #${existing.number} angehängt.`)
    process.exit(0)
  }
} catch {
  // Label may not exist yet; continue to create label + issue below.
}

// ── Build issue body ──────────────────────────────────────────────────────

const lines = []
lines.push(`## Production Nightly Tests – ${TODAY}`)
lines.push('')
lines.push('### Context')
lines.push('')
lines.push(`| Key | Value |`)
lines.push(`|---|---|`)
lines.push(`| GitHub Run | [#${GITHUB_RUN_ID}](${RUN_URL}) |`)
lines.push(`| Test Run ID | \`${TEST_RUN_ID || '(lokal)'}\` |`)
lines.push(`| Traffic Type | \`e2e\` |`)
lines.push(`| Environment | production (https://www.storyhold.app) |`)
lines.push('')

if (POSTHOG_PROJECT && TEST_RUN_ID) {
  const filterJson = JSON.stringify({
    properties: [{ key: 'test_run_id', value: TEST_RUN_ID, operator: 'exact', type: 'person' }],
  })
  const replayUrl =
    `https://eu.posthog.com/project/${POSTHOG_PROJECT}/replay` +
    `?filters=${encodeURIComponent(filterJson)}`
  lines.push('### PostHog Session Recordings')
  lines.push('')
  lines.push(`[Recordings für diesen Run öffnen](${replayUrl})`)
  lines.push('')
  lines.push(`Filter: \`test_run_id = ${TEST_RUN_ID}\` · \`traffic_type = e2e\``)
  lines.push('')
}

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
    'Test-Failures. Mögliche Ursachen: Browser-Start-Fehler, Netzwerkproblem beim Erreichen ' +
    'von storyhold.app, CDN-Ausfall oder Timeout vor dem ersten Test.',
  )
  lines.push('')
}

lines.push('### Artefakte')
lines.push('')
lines.push(`Traces, Screenshots und Videos sind im [CI-Lauf](${RUN_URL}) als Artefakte \`production-report-*\` verfügbar (14 Tage aufbewahrt).`)
lines.push('')
lines.push('```')
lines.push('npx playwright show-trace trace.zip')
lines.push('```')
lines.push('')

lines.push('### Nächste Schritte')
lines.push('')
lines.push('1. PostHog-Replay öffnen und Session nachvollziehen')
lines.push('2. Trace-Artefakt herunterladen und analysieren')
lines.push('3. Einschätzen: echtes Problem in Produktion oder Timing-/Netzwerk-Flake?')
lines.push('4. Fix committen und dieses Issue schließen')

const title = hasFailures
  ? `❌ Production Nightly fehlgeschlagen – ${TODAY}`
  : `⚠️ Flaky Production Nightly – ${TODAY}`

writeFileSync('/tmp/production-issue-body.md', lines.join('\n'))

// ── Ensure label exists ───────────────────────────────────────────────────

try {
  execSync(
    `gh label create "nightly-production" ` +
    `--color "bfd4f2" ` +
    `--description "Automatisch: Production-Nightly-Ergebnis" ` +
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
  `--body-file /tmp/production-issue-body.md ` +
  `--label "nightly-production"`,
  { stdio: 'inherit' },
)
