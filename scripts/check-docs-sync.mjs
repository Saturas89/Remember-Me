#!/usr/bin/env node
// Enforces that docs/INDEX.md and docs/PROJECT.md stay in sync with
// package.json#version and the newest docs/CHANGELOG.md release date.
// Runs as part of `npm test`.
//
// Why: We've shipped versions where the dev-facing docs still pointed at the
// release from weeks earlier, leaving readers confused about what's actually
// in production. This check is the cheap automation that closes that gap.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

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

checkDoc('docs/INDEX.md')
checkDoc('docs/PROJECT.md')

console.log(
  `✓ docs-sync: INDEX.md and PROJECT.md mention v${version} with date ≥ ${newestChangelogDate}`,
)

function checkDoc(relativePath) {
  const content = readFileSync(join(ROOT, relativePath), 'utf8')

  // Match a header line like "**Version:** 2.6.0" (with or without trailing
  // markdown like " | **Stand:** …" or two trailing spaces).
  const versionMatch = content.match(/\*\*Version:\*\*\s+([\d.]+)/)
  if (!versionMatch) {
    fail(`${relativePath} does not contain a "**Version:** x.y.z" header line.`)
  }
  if (versionMatch[1] !== version) {
    fail(
      `${relativePath} declares **Version:** ${versionMatch[1]} but ` +
        `package.json is at ${version}. Update the header.`,
    )
  }

  // Match a date in the document header. We accept either
  //   **Stand:** YYYY-MM-DD     (INDEX.md style)
  // or
  //   **Letzte Aktualisierung:** YYYY-MM-DD   (PROJECT.md style).
  const dateMatch =
    content.match(/\*\*Stand:\*\*\s+(\d{4}-\d{2}-\d{2})/) ||
    content.match(/\*\*Letzte Aktualisierung:\*\*\s+(\d{4}-\d{2}-\d{2})/)
  if (!dateMatch) {
    fail(
      `${relativePath} does not contain a "**Stand:** YYYY-MM-DD" or ` +
        `"**Letzte Aktualisierung:** YYYY-MM-DD" header line.`,
    )
  }
  if (dateMatch[1] < newestChangelogDate) {
    fail(
      `${relativePath} declares a date of ${dateMatch[1]}, but the newest ` +
        `CHANGELOG entry is ${newestChangelogDate}. Bump the date so readers ` +
        `know the doc reflects the latest release.`,
    )
  }
}

function fail(msg) {
  console.error(`✗ check-docs-sync: ${msg}`)
  console.error(
    `\n       Policy: every version bump must update the header of ` +
      `docs/INDEX.md and docs/PROJECT.md.\n` +
      `       See CLAUDE.md → "Doc-Sync-Pflicht".`,
  )
  process.exit(1)
}
