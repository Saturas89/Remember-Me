// @vitest-environment node
//
// Guard-tests for the strict opt-in contract of online sharing.
//
// The whole architecture depends on one promise: nothing in the offline code
// path imports @supabase/supabase-js, loads the client, or touches the
// network. These tests verify that statically by scanning the relevant
// source files. If someone later adds a `import { ... } from './supabaseClient'`
// in a non-lazy module, this test fails and the reviewer is forced to think
// about whether the feature is really still opt-in.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(__dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('online sharing opt-in guard', () => {
  const files = walk(SRC)

  it('no module outside sharingService.ts statically imports supabaseClient', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (f.endsWith(`utils/supabaseClient.ts`)) continue
      if (f.endsWith(`utils/sharingService.ts`)) continue
      const src = readFileSync(f, 'utf8')
      // Static import:  import ... from '.../supabaseClient'
      if (/import[^;]+from\s+['"][^'"]*supabaseClient['"]/m.test(src)) {
        offenders.push(f)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no module outside the lazy sharing chunk statically imports @supabase/supabase-js', () => {
    const allowedSet = new Set([
      'utils/supabaseClient.ts',
      'utils/sharingService.ts',
    ])
    const offenders: string[] = []
    for (const f of files) {
      const rel = f.slice(SRC.length + 1).replace(/\\/g, '/')
      if (allowedSet.has(rel)) continue
      const src = readFileSync(f, 'utf8')
      if (/import[^;]+from\s+['"]@supabase\/supabase-js['"]/m.test(src)) {
        offenders.push(rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('useOnlineSync imports sharingService only via dynamic import()', () => {
    const src = readFileSync(join(SRC, 'hooks/useOnlineSync.ts'), 'utf8')
    // Top-level: only a type-only import is allowed (erased at build time).
    const staticImport = /^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]*sharingService['"]/m
    const typeOnlyImport = /^\s*import\s+type\b/m
    const staticLines = src
      .split('\n')
      .filter(line => /from\s+['"][^'"]*sharingService['"]/.test(line))
      .filter(line => !/^\s*import\s+type\b/.test(line))
      .filter(line => !/^\s*type\s+\w+\s*=/.test(line))
    expect(staticLines).toEqual([])
    // And there MUST be at least one dynamic import() call.
    expect(/await\s+import\(['"][^'"]*sharingService['"]\)/.test(src)).toBe(true)
    // Sanity: the file uses type-only imports or `typeof import(...)` for
    // the service type – both are erased and don't add runtime deps.
    expect(typeOnlyImport.test(src) || /typeof\s+import\(['"][^'"]*sharingService['"]\)/.test(src)).toBe(true)
    // Avoid an "unused variable" lint complaint
    void staticImport
  })

  it('App.tsx never statically imports sharingService or supabaseClient', () => {
    const src = readFileSync(join(SRC, 'App.tsx'), 'utf8')
    expect(/from\s+['"][^'"]*sharingService['"]/.test(src)).toBe(false)
    expect(/from\s+['"][^'"]*supabaseClient['"]/.test(src)).toBe(false)
  })

  it('useOnlineSync is a no-op when onlineSharing is undefined or disabled', () => {
    // This is a source-shape assertion: the hook's effect body must bail out
    // before doing anything if onlineSharing?.enabled is falsy.
    const src = readFileSync(join(SRC, 'hooks/useOnlineSync.ts'), 'utf8')
    // The guard MUST appear before the first dynamic import().
    const guardIdx = src.search(/if\s*\(\s*!\s*onlineSharing\?\.enabled\s*\)/)
    const dynImportIdx = src.search(/await\s+import\(['"][^'"]*sharingService['"]\)/)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(dynImportIdx).toBeGreaterThan(guardIdx)
  })
})
