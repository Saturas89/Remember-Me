import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { parseInstagramZip } from './importInstagram'

async function buildZip(files: Record<string, string | Uint8Array>): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }
  const u8 = await zip.generateAsync({ type: 'uint8array' })
  // Cast to BlobPart – Uint8Array is a valid BlobPart at runtime even though
  // the TS lib's narrower type doesn't cover the generic ArrayBufferLike.
  return new File([u8 as unknown as BlobPart], 'instagram.zip', { type: 'application/zip' })
}

function postsJson(posts: unknown[]): string {
  return JSON.stringify(posts)
}

// jsdom's URL.createObjectURL is unimplemented. Provide a stub.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:ig-mock')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { vi.restoreAllMocks() })

describe('parseInstagramZip', () => {
  it('parses a single-post export with caption + image', async () => {
    const ts = 1_700_000_000
    const zip = await buildZip({
      'your_instagram_activity/content/posts_1.json': postsJson([
        { media: [{ uri: 'media/posts/foo.jpg', creation_timestamp: ts, title: 'Hallo Welt' }] },
      ]),
      'media/posts/foo.jpg': new Uint8Array([1, 2, 3]),
    })
    const result = await parseInstagramZip(zip)
    expect(result).toHaveLength(1)
    const [c] = result
    expect(c.platform).toBe('instagram')
    expect(c.originalCaption).toBe('Hallo Welt')
    expect(c.description).toBe('Hallo Welt')
    expect(c.timestamp).toBe(ts)
    expect(c.selected).toBe(true)
    expect(c.imageBlob).toBeDefined()
    expect(c.previewUrl).toBe('blob:ig-mock')
    expect(c.id).toMatch(/^ig-\d+-[0-9a-f-]{36}$/)
  })

  it('falls back to "Instagram · <date>" when the post has no caption', async () => {
    const ts = 1_700_000_000
    const zip = await buildZip({
      'posts_1.json': postsJson([
        { media: [{ uri: 'media/posts/foo.jpg', creation_timestamp: ts }] },
      ]),
      'media/posts/foo.jpg': new Uint8Array([1, 2, 3]),
    })
    const [c] = await parseInstagramZip(zip)
    expect(c.originalCaption).toBe('')
    expect(c.description).toMatch(/^Instagram · /)
  })

  it('expands carousel posts into one candidate per media item', async () => {
    const zip = await buildZip({
      'posts_1.json': postsJson([
        {
          media: [
            { uri: 'a.jpg', creation_timestamp: 1, title: 'first' },
            { uri: 'b.jpg', creation_timestamp: 2, title: 'second' },
            { uri: 'c.jpg', creation_timestamp: 3, title: 'third' },
          ],
        },
      ]),
      'a.jpg': new Uint8Array([1]),
      'b.jpg': new Uint8Array([2]),
      'c.jpg': new Uint8Array([3]),
    })
    const result = await parseInstagramZip(zip)
    expect(result.map(r => r.originalCaption)).toEqual(['third', 'second', 'first'])
  })

  it('sorts results by timestamp descending (newest first)', async () => {
    const zip = await buildZip({
      'posts_1.json': postsJson([
        { media: [{ uri: 'a.jpg', creation_timestamp: 100, title: 'old' }] },
        { media: [{ uri: 'b.jpg', creation_timestamp: 999, title: 'new' }] },
      ]),
      'a.jpg': new Uint8Array([1]),
      'b.jpg': new Uint8Array([2]),
    })
    const result = await parseInstagramZip(zip)
    expect(result[0].timestamp).toBe(999)
    expect(result[1].timestamp).toBe(100)
  })

  it('handles entries whose referenced image is missing (text-only fallback)', async () => {
    const zip = await buildZip({
      'posts_1.json': postsJson([
        { media: [{ uri: 'missing.jpg', creation_timestamp: 1, title: 'orphan' }] },
      ]),
    })
    const [c] = await parseInstagramZip(zip)
    expect(c.imageBlob).toBeUndefined()
    expect(c.previewUrl).toBeUndefined()
    expect(c.description).toBe('orphan')
  })

  it('aggregates posts across multiple posts_*.json files', async () => {
    const zip = await buildZip({
      'posts_1.json': postsJson([
        { media: [{ uri: '', creation_timestamp: 1, title: 'from file 1' }] },
      ]),
      'posts_2.json': postsJson([
        { media: [{ uri: '', creation_timestamp: 2, title: 'from file 2' }] },
      ]),
    })
    const result = await parseInstagramZip(zip)
    expect(result.map(r => r.originalCaption).sort()).toEqual(['from file 1', 'from file 2'])
  })

  it('throws a helpful error for a non-ZIP payload', async () => {
    const fake = new File(['not a zip'], 'x.zip', { type: 'application/zip' })
    await expect(parseInstagramZip(fake)).rejects.toThrow(
      /gültige ZIP-Datei/,
    )
  })

  it('throws when the ZIP contains no posts_*.json files', async () => {
    const zip = await buildZip({ 'random.txt': 'hello' })
    await expect(parseInstagramZip(zip)).rejects.toThrow(/Keine Instagram-Posts gefunden/)
  })

  it('throws when posts_*.json exists but yields no candidates', async () => {
    const zip = await buildZip({
      'posts_1.json': postsJson([{ media: [] }]),
    })
    await expect(parseInstagramZip(zip)).rejects.toThrow(/keine Fotos oder Beiträge/)
  })

  it('ignores malformed post JSON but keeps valid files', async () => {
    const zip = await buildZip({
      'posts_1.json': '{ not json }}}',
      'posts_2.json': postsJson([
        { media: [{ uri: '', creation_timestamp: 5, title: 'ok' }] },
      ]),
    })
    const result = await parseInstagramZip(zip)
    expect(result).toHaveLength(1)
    expect(result[0].originalCaption).toBe('ok')
  })

  it('calls onProgress as items are processed', async () => {
    const zip = await buildZip({
      'posts_1.json': postsJson([
        { media: [{ uri: '', creation_timestamp: 1, title: 'a' }] },
        { media: [{ uri: '', creation_timestamp: 2, title: 'b' }] },
      ]),
    })
    const onProgress = vi.fn()
    await parseInstagramZip(zip, onProgress)
    expect(onProgress).toHaveBeenCalled()
  })
})
