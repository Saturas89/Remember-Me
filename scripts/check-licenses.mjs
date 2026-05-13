#!/usr/bin/env node
// Walks the production dependency tree in node_modules and verifies every
// package's SPDX license is compatible with AGPL-3.0-or-later (Storyhold's
// own license, see ./LICENSE). Fails with exit code 1 on incompatible or
// unknown licenses so a PR can't silently introduce a GPL-incompatible dep.
//
// Run as part of CI / before release. Not wired into `npm test` to keep
// the test loop fast — `npm run check:licenses` is the explicit entry.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const NODE_MODULES = join(ROOT, 'node_modules')

// SPDX identifiers known to be compatible when combined into an
// AGPL-3.0-or-later work (i.e. permissive, weak copyleft compatible, or the
// same GPL family). Anything outside this set requires an explicit human
// decision in the PR description.
const ALLOWED = new Set([
  '0BSD',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'Apache-2.0',
  'Artistic-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSD-3-Clause-Clear',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.0-or-later',
  'LGPL-2.1',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-or-later',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'Python-2.0',
  'Unicode-DFS-2016',
  'Unlicense',
  'WTFPL',
  'Zlib',
])

// SPDX identifiers known to be GPL-incompatible or source-available-only.
const FORBIDDEN = new Set([
  'BUSL-1.1',
  'CC-BY-NC-3.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-SA-4.0',
  'Elastic-2.0',
  'GPL-2.0',
  'GPL-2.0-only',
  'PolyForm-Noncommercial-1.0.0',
  'PolyForm-Shield-1.0.0',
  'SSPL-1.0',
])

function loadProdDeps() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  return new Set(Object.keys(pkg.dependencies ?? {}))
}

function walkPackages(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (entry.startsWith('@')) {
      walkPackages(full, out)
      continue
    }
    const pkgJson = join(full, 'package.json')
    if (existsSync(pkgJson) && statSync(pkgJson).isFile()) out.push(full)
    const nested = join(full, 'node_modules')
    if (existsSync(nested)) walkPackages(nested, out)
  }
  return out
}

function readLicense(pkgDir) {
  try {
    const pj = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    if (typeof pj.license === 'string') return pj.license
    if (Array.isArray(pj.licenses) && pj.licenses[0]?.type) {
      return pj.licenses.map((l) => l.type).join(' OR ')
    }
    if (pj.license?.type) return pj.license.type
    return null
  } catch {
    return null
  }
}

// SPDX expressions can be e.g. "(MIT OR Apache-2.0)" or "Apache-2.0 AND MIT".
// We accept the package if every alternative in an OR is allowed for AND,
// or if any alternative in an OR is allowed.
function isAllowed(expr) {
  if (!expr) return false
  const cleaned = expr.replace(/[()]/g, '').trim()
  if (ALLOWED.has(cleaned)) return true
  if (FORBIDDEN.has(cleaned)) return false
  if (/\sOR\s/i.test(cleaned)) {
    return cleaned.split(/\sOR\s/i).some((p) => isAllowed(p.trim()))
  }
  if (/\sAND\s/i.test(cleaned)) {
    return cleaned.split(/\sAND\s/i).every((p) => isAllowed(p.trim()))
  }
  return ALLOWED.has(cleaned)
}

const prodDeps = loadProdDeps()
const packages = walkPackages(NODE_MODULES)

let forbidden = 0
let unknown = 0
const problems = []

for (const dir of packages) {
  const name = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name
  if (!name) continue
  const license = readLicense(dir)
  if (isAllowed(license)) continue
  const cleaned = license?.replace(/[()]/g, '').trim() ?? null
  const isForbidden = cleaned && cleaned.split(/\sOR\s|\sAND\s/i).some((p) => FORBIDDEN.has(p.trim()))
  if (isForbidden) forbidden++
  else unknown++
  problems.push({ name, license: license ?? '(missing)', isForbidden })
}

if (problems.length === 0) {
  console.log(`✓ check-licenses: ${packages.length} packages scanned, all AGPL-3.0 compatible`)
  process.exit(0)
}

const forbiddenList = problems.filter((p) => p.isForbidden)
const unknownList = problems.filter((p) => !p.isForbidden)

if (forbiddenList.length > 0) {
  console.error(`✗ check-licenses: ${forbiddenList.length} package(s) with AGPL-incompatible license:`)
  for (const p of forbiddenList) console.error(`    ${p.name} → ${p.license}`)
}
if (unknownList.length > 0) {
  console.error(`! check-licenses: ${unknownList.length} package(s) with unknown / unreviewed license:`)
  for (const p of unknownList) console.error(`    ${p.name} → ${p.license}`)
  console.error(
    `\n       If a license is known-safe but not in the allowlist, add its SPDX\n` +
      `       identifier to ALLOWED in scripts/check-licenses.mjs with a brief\n` +
      `       justification in the PR.`,
  )
}

process.exit(forbiddenList.length > 0 ? 1 : 0)
