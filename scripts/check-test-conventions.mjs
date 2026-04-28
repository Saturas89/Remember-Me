#!/usr/bin/env node
// Static guard for our two Vitest conventions. Runs as part of `npm test`.
// Background: docs/testing-conventions.md (REQ-016 post-mortem).
//
//   Rule 1 (no-behavior-hook-mock):
//     A *.test.tsx / *.test.ts file may not `vi.mock('…/hooks/useFoo')` a
//     behavior hook. Browser-API adapters in ADAPTER_ALLOWLIST may be
//     mocked without justification; everything else needs an inline
//     `// HOOK-MOCK-OK: <reason>` comment within 2 lines above the call.
//
//   Rule 2 (interactive-test-must-click):
//     A *.test.tsx file that selects interactive elements via
//     getByTestId(...) or getByRole('checkbox' | 'switch') must
//     somewhere also issue a click (.click(, fireEvent.click,
//     userEvent.click). Opt-out via `// CLICK-CHECK-OK: <reason>`
//     anywhere in the file.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

const ADAPTER_ALLOWLIST = new Set([
  'useImageStore',
  'useAudioStore',
  'useVideoStore',
  'useAudioRecorder',
  'useServiceWorker',
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.test\.(t|j)sx?$/.test(entry)) out.push(p)
  }
  return out
}

function check(file) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const violations = []

  // ── Rule 1: behavior hooks must not be silently mocked ────────────
  const hookMockRe = /vi\.mock\(\s*['"][^'"]*\/hooks\/(use[A-Z]\w*)['"]/g
  let m
  while ((m = hookMockRe.exec(text))) {
    const hookName = m[1]
    if (ADAPTER_ALLOWLIST.has(hookName)) continue

    const lineIdx = text.slice(0, m.index).split('\n').length - 1
    const window = lines.slice(Math.max(0, lineIdx - 2), lineIdx + 1).join('\n')
    if (/HOOK-MOCK-OK:/.test(window)) continue

    violations.push({
      rule: 'no-behavior-hook-mock',
      line: lineIdx + 1,
      msg: `vi.mock('…/hooks/${hookName}') without // HOOK-MOCK-OK: <reason>. Behavior hooks should run for real in component tests so the component+hook contract is actually exercised. If the hook is a low-level adapter, add it to ADAPTER_ALLOWLIST in scripts/check-test-conventions.mjs.`,
    })
  }

  // ── Rule 2: interactive .tsx tests must click ─────────────────────
  if (file.endsWith('.tsx')) {
    const usesInteractiveSelector =
      /getByTestId\(/.test(text) ||
      /getByRole\(\s*['"](?:checkbox|switch)['"]/.test(text)
    const hasClick =
      /\.click\(/.test(text) ||
      /fireEvent\.click/.test(text) ||
      /userEvent\.click/.test(text)
    const optOut = /CLICK-CHECK-OK:/.test(text)

    if (usesInteractiveSelector && !hasClick && !optOut) {
      violations.push({
        rule: 'interactive-test-must-click',
        line: 1,
        msg: 'File selects interactive elements (getByTestId / getByRole checkbox|switch) but never clicks. Rendering tests are not enough — exercise at least one click and assert a follow-up state. Opt out with // CLICK-CHECK-OK: <reason>.',
      })
    }
  }

  return violations
}

const files = walk(SRC)
const errors = []
for (const f of files) {
  for (const v of check(f)) {
    errors.push({ file: relative(ROOT, f), ...v })
  }
}

if (errors.length === 0) {
  console.log(`✓ test-conventions: ${files.length} test files clean`)
  process.exit(0)
}

console.error('✗ test-conventions: violations found\n')
for (const e of errors) {
  console.error(`  ${e.file}:${e.line}  [${e.rule}]`)
  console.error(`    ${e.msg}\n`)
}
process.exit(1)
