import { describe, it, expect } from 'vitest'
import { exportAsBackup, BACKUP_TYPE } from './export'
import type { ExportData } from './export'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBackupText(overrides: Partial<ExportData> = {}): string {
  return exportAsBackup({
    profile: { name: 'Test', createdAt: '2024-01-01T00:00:00.000Z' },
    answers: {},
    friends: [],
    friendAnswers: [],
    customQuestions: [],
    ...overrides,
  })
}

function makeJsonFile(text: string, name = 'backup.json'): File {
  return new File([text], name, { type: 'application/json' })
}

function makeZipFile(content: Uint8Array<ArrayBuffer>, name = 'archive.zip'): File {
  return new File([content], name, { type: 'application/zip' })
}

// ── Re-import the module after mocking stores ──────────────────────────────────

// NOTE: The ZIP import path calls IndexedDB (putImageById etc.) which is
// unavailable in jsdom.  We test the pure-logic branches (JSON parsing,
// format detection, error paths) here and rely on manual / integration
// testing for the ZIP media-restoration path.

describe('archiveImport – JSON path', () => {
  it('accepts a valid JSON backup file', async () => {
    // We import lazily to avoid top-level import resolution issues with mocks
    const { importFile } = await import('./archiveImport')
    const file = makeJsonFile(makeBackupText())
    const result = await importFile(file)
    expect(result.ok).toBe(true)
    expect(result.jsonText).toBeTruthy()
  })

  it('returns the original JSON text unchanged', async () => {
    const { importFile } = await import('./archiveImport')
    const original = makeBackupText()
    const result = await importFile(makeJsonFile(original))
    expect(result.jsonText).toBe(original)
  })

  it('rejects a JSON file with wrong $type', async () => {
    const { importFile } = await import('./archiveImport')
    const bad = JSON.stringify({ $type: 'not-a-backup', state: {} })
    const result = await importFile(makeJsonFile(bad))
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects malformed JSON', async () => {
    const { importFile } = await import('./archiveImport')
    const result = await importFile(makeJsonFile('{ broken json }}}'))
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('does not set stats for a JSON import', async () => {
    const { importFile } = await import('./archiveImport')
    const result = await importFile(makeJsonFile(makeBackupText()))
    expect(result.stats).toBeUndefined()
  })

  it('accepts a .json file with text/plain MIME type', async () => {
    const { importFile } = await import('./archiveImport')
    const file = new File([makeBackupText()], 'backup.json', { type: 'text/plain' })
    const result = await importFile(file)
    expect(result.ok).toBe(true)
  })
})

describe('archiveImport – ZIP detection', () => {
  it('treats a .zip file as ZIP (returns error about missing memories.json)', async () => {
    const { importFile } = await import('./archiveImport')
    // An empty / invalid ZIP – should fail with an archive-related error
    const empty = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)])
    const file = makeZipFile(empty)
    const result = await importFile(file)
    // Should fail because there is no memories.json, not because of JSON parsing
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('treats application/x-zip-compressed as ZIP', async () => {
    const { importFile } = await import('./archiveImport')
    const empty = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)])
    const file = new File([empty], 'archive.zip', { type: 'application/x-zip-compressed' })
    const result = await importFile(file)
    expect(result.ok).toBe(false) // no memories.json, but ZIP branch was taken
    expect(result.error).not.toContain('gültige Backup-Datei') // not the JSON error
  })
})

describe('archiveImport – BACKUP_TYPE contract', () => {
  it('BACKUP_TYPE constant matches what exportAsBackup embeds', () => {
    const json = JSON.parse(makeBackupText())
    expect(json.$type).toBe(BACKUP_TYPE)
  })
})
