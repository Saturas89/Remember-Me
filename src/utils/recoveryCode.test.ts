// @vitest-environment node
//
// Unit tests for REQ-017 recovery-code crypto helpers.
// Test IDs R-01 .. R-10 from Master-Spec §12.2.
//
// Runs in Node (default since v22) so that crypto.subtle (PBKDF2 / AES-GCM)
// is the platform-native implementation – jsdom does not expose subtle.

import { describe, it, expect } from 'vitest'
import {
  generateRecoveryCode,
  formatRecoveryCode,
  normalizeRecoveryCode,
  deriveVaultKey,
  encryptText,
  decryptText,
} from './recoveryCode'
import { SyncError } from './privateSyncProvider'

describe('generateRecoveryCode', () => {
  it('R-01: liefert genau 24 Zeichen', () => {
    expect(generateRecoveryCode()).toHaveLength(24)
  })

  it('R-02: nutzt nur [A-Za-z0-9] (Base62)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode()
      expect(code).toMatch(/^[A-Za-z0-9]{24}$/)
    }
  })

  it('R-03: 1000 Aufrufe → 1000 verschiedene Werte', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generateRecoveryCode())
    expect(seen.size).toBe(1000)
  })
})

describe('formatRecoveryCode / normalizeRecoveryCode', () => {
  it('R-04: formatiert 24-Zeichen-Code in 6×4-Gruppen mit Bindestrich', () => {
    expect(formatRecoveryCode('ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(
      'ABCD-EFGH-IJKL-MNOP-QRST-UVWX',
    )
  })

  it('R-05: normalisiert Eingabe zu reinem 24-Zeichen-String', () => {
    expect(normalizeRecoveryCode('ABCD-EFGH-IJKL-MNOP-QRST-UVWX')).toBe(
      'ABCDEFGHIJKLMNOPQRSTUVWX',
    )
    expect(normalizeRecoveryCode('  ABCD-EFGH  ')).toBe('ABCDEFGH')
  })
})

describe('deriveVaultKey + encrypt/decryptText', () => {
  it('R-06: liefert AES-GCM CryptoKey', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-1')
    expect(key.algorithm.name).toBe('AES-GCM')
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256)
  })

  it('R-07: encrypt → decrypt Roundtrip rekonstruiert das Plaintext', async () => {
    const key = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-1')
    const plaintext = JSON.stringify({ hello: 'world', n: 42, ä: 'ü' })
    const { ct, iv } = await encryptText(plaintext, key)
    expect(ct).not.toBe(plaintext)
    const decrypted = await decryptText(ct, iv, key)
    expect(decrypted).toBe(plaintext)
  })

  it('R-08: Falscher Key → SyncError mit code "decrypt"', async () => {
    const goodKey = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-1')
    const wrongKey = await deriveVaultKey('YZABCDEFGHIJKLMNOPQRSTUV', 'user-1')

    const { ct, iv } = await encryptText('secret', goodKey)
    let captured: unknown
    try {
      await decryptText(ct, iv, wrongKey)
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(SyncError)
    expect((captured as SyncError).code).toBe('decrypt')
  })

  it('R-09: deriveVaultKey deterministisch (gleicher code+userId → kompatible Keys)', async () => {
    const k1 = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-42')
    const k2 = await deriveVaultKey('ABCDEFGHIJKLMNOPQRSTUVWX', 'user-42')
    const { ct, iv } = await encryptText('hello-determinism', k1)
    const plain = await decryptText(ct, iv, k2)
    expect(plain).toBe('hello-determinism')
  })

  it('R-10: Verschiedene userId → verschiedener Key (decrypt schlägt fehl)', async () => {
    const code = 'ABCDEFGHIJKLMNOPQRSTUVWX'
    const keyA = await deriveVaultKey(code, 'user-A')
    const keyB = await deriveVaultKey(code, 'user-B')
    const { ct, iv } = await encryptText('cross-user', keyA)

    let captured: unknown
    try {
      await decryptText(ct, iv, keyB)
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(SyncError)
    expect((captured as SyncError).code).toBe('decrypt')
  })
})
