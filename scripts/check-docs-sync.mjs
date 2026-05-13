#!/usr/bin/env node
// Enforces that docs/README.md stays in sync with package.json#version
// and the newest docs/CHANGELOG.md release date. Runs as part of `npm test`.
//
// Why: We've shipped versions where the dev-facing overview doc still pointed
// at the release from weeks earlier, leaving readers confused about what's
// actually in production. This check is the cheap automation that closes that
// gap.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DOC_PATH = 'docs/README.md'

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = pkg.version
if (!version) fail('package.json is missing a "version" field.')

const changelog = readFileSync(join(ROOT, 'docs/CHANGELOG.md'), 'utf8')

// Parse the most recent "## [x.y.z] – YYYY-MM-DD" heading.
const latestEntry = changelog.match(/^## \[([\d.]+)\] – (\d{4}-\d{2}-\d{2})/m)
if (!latestEntry) {
  fail('docs/CHANGELOG.md has no parseable "## [x.y.z] – YYYY-MM-DD" heading.')
}
const newestChangelogDate = latestEntry[2]

const content = readFileSync(join(ROOT, DOC_PATH), 'utf8')

// Match a header line like "**Version:** 2.6.0".
const versionMatch = content.match(/\*\*Version:\*\*\s+([\d.]+)/)
if (!versionMatch) {
  fail(`${DOC_PATH} does not contain a "**Version:** x.y.z" header line.`)
}
if (versionMatch[1] !== version) {
  fail(
    `${DOC_PATH} declares **Version:** ${versionMatch[1]} but ` +
      `package.json is at ${version}. Update the header.`,
  )
}

const dateMatch = content.match(/\*\*Letzte Aktualisierung:\*\*\s+(\d{4}-\d{2}-\d{2})/)
if (!dateMatch) {
  fail(
    `${DOC_PATH} does not contain a "**Letzte Aktualisierung:** YYYY-MM-DD" ` +
      `header line.`,
  )
}
if (dateMatch[1] < newestChangelogDate) {
  fail(
    `${DOC_PATH} declares a date of ${dateMatch[1]}, but the newest ` +
      `CHANGELOG entry is ${newestChangelogDate}. Bump the date so readers ` +
      `know the doc reflects the latest release.`,
  )
}

console.log(
  `✓ docs-sync: ${DOC_PATH} mentions v${version} with date ≥ ${newestChangelogDate}`,
)

function fail(msg) {
  console.error(`✗ check-docs-sync: ${msg}`)
  console.error(
    `\n       Policy: every version bump must update the header of ` +
      `${DOC_PATH}.\n` +
      `       See CLAUDE.md → "Doc-Sync-Pflicht".`,
  )
  process.exit(1)
}
