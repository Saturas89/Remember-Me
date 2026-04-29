#!/usr/bin/env node
// Enforces that every version in package.json has a matching entry in
// docs/CHANGELOG.md *and* src/data/releaseNotes.ts. Runs as part of `npm test`.
//
// Why both files? CHANGELOG.md is the dev-facing log; releaseNotes.ts is the
// user-facing "What's new?" modal. We've shipped features without updating one
// or the other before — the next user opens the app and sees nothing new.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = pkg.version
if (!version) fail('package.json is missing a "version" field.')

const changelog = readFileSync(join(ROOT, 'docs/CHANGELOG.md'), 'utf8')
const releaseNotes = readFileSync(
  join(ROOT, 'src/data/releaseNotes.ts'),
  'utf8',
)

const changelogHeading = new RegExp(`^## \\[${escape(version)}\\] – `, 'm')
if (!changelogHeading.test(changelog)) {
  fail(
    `docs/CHANGELOG.md has no "## [${version}] – YYYY-MM-DD" section.\n` +
      `       Add a section for this version describing what shipped.`,
  )
}

const releaseNotesEntry = new RegExp(`version:\\s*['"]${escape(version)}['"]`)
if (!releaseNotesEntry.test(releaseNotes)) {
  fail(
    `src/data/releaseNotes.ts has no entry for version '${version}'.\n` +
      `       Add a ReleaseNote with at least one user-friendly highlight so the\n` +
      `       in-app "Was ist neu?" modal shows the change.`,
  )
}

console.log(`✓ changelog: v${version} present in CHANGELOG.md and releaseNotes.ts`)

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fail(msg) {
  console.error(`✗ check-changelog: ${msg}`)
  console.error(
    `\n       Policy: every version bump must update both files.\n` +
      `       See CLAUDE.md → "Changelog-Pflicht".`,
  )
  process.exit(1)
}
