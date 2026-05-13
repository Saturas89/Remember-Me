#!/usr/bin/env node
// Reads playwright-report/report.json (produced by the json reporter in
// playwright.config.ts) and writes a human-readable summary of every test
// that retried at least once. Output goes to $GITHUB_STEP_SUMMARY if set,
// otherwise stdout. Exits 0 unconditionally — this is purely informational,
// the actual test pass/fail is governed by the playwright run itself.

import { readFileSync, appendFileSync, existsSync } from 'node:fs'

const REPORT = 'playwright-report/report.json'
const projectArg = process.argv[2] ?? '(unknown project)'

if (!existsSync(REPORT)) {
  emit(`## Flake summary — ${projectArg}\n\n_No JSON report found at \`${REPORT}\` — playwright likely never ran._\n`)
  process.exit(0)
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'))

/**
 * Each `test` in playwright's JSON report has a `results: []` array. One entry
 * per attempt — so `results.length > 1` means the test had to retry.
 */
const flakes = []
function walk(suite) {
  for (const child of suite.suites ?? []) walk(child)
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const attempts = test.results?.length ?? 0
      if (attempts > 1) {
        flakes.push({
          file: spec.file,
          title: spec.title,
          attempts,
          status: test.status,
        })
      }
    }
  }
}
for (const s of report.suites ?? []) walk(s)

let out = `## Flake summary — ${projectArg}\n\n`
if (flakes.length === 0) {
  out += `_No retried tests in this run._\n`
} else {
  out += `${flakes.length} test(s) needed at least one retry:\n\n`
  for (const f of flakes) {
    out += `- **${f.title}** — ${f.attempts - 1} retry/retries (final: \`${f.status}\`) — \`${f.file}\`\n`
  }
}
emit(out)

function emit(text) {
  const target = process.env.GITHUB_STEP_SUMMARY
  if (target) appendFileSync(target, text + '\n')
  else process.stdout.write(text + '\n')
}
