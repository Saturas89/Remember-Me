import JSZip from 'jszip'

export interface ImportCandidate {
  id: string
  platform: 'instagram'
  originalCaption: string
  timestamp: number        // Unix seconds (original post date)
  imageBlob?: Blob
  previewUrl?: string      // Object URL – caller must revoke when done
  // user-editable before import:
  selected: boolean
  description: string      // defaults to originalCaption
}

// Instagram exports sometimes double-encode UTF-8 as Latin-1.
// This restores the original characters (Ä, ö, ü, emojis …).
function fixEncoding(text: string): string {
  try {
    return decodeURIComponent(escape(text))
  } catch {
    return text
  }
}

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface RawMedia {
  uri?: string
  creation_timestamp?: number
  title?: string
}

interface RawPost {
  media?: RawMedia[]
}

async function findPostFiles(zip: JSZip): Promise<JSZip.JSZipObject[]> {
  const found: JSZip.JSZipObject[] = []
  zip.forEach((path, file) => {
    if (!file.dir && /posts_\d+\.json$/i.test(path)) {
      found.push(file)
    }
  })
  return found
}

export async function parseInstagramZip(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ImportCandidate[]> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error(
      'Die Datei konnte nicht gelesen werden. Stelle sicher, dass du eine gültige ZIP-Datei hochlädst.',
    )
  }

  const postFiles = await findPostFiles(zip)

  if (postFiles.length === 0) {
    throw new Error(
      'Keine Instagram-Posts gefunden. Bitte stelle sicher:\n' +
      '• Du hast das Format „JSON" (nicht HTML) gewählt\n' +
      '• Die ZIP-Datei wurde komplett heruntergeladen',
    )
  }

  // Fetch all post texts concurrently
  const postTexts = await Promise.all(
    postFiles.map(async (postFile) => {
      try {
        return await postFile.async('text')
      } catch {
        return null
      }
    })
  )

  let loaded = 0

  const mediaProcessingPromises: Promise<ImportCandidate>[] = []

  for (const text of postTexts) {
    if (!text) continue

    let posts: RawPost[]
    try {
      posts = JSON.parse(text) as RawPost[]
    } catch {
      continue
    }

    for (const post of posts) {
      if (!post.media?.length) continue

      // For carousel posts, each media item becomes its own entry
      for (const media of post.media) {
        const caption = media.title ? fixEncoding(media.title) : ''
        const timestamp = media.creation_timestamp ?? 0
        const dateStr = formatDate(timestamp)
        const fallbackTitle = dateStr ? `Instagram · ${dateStr}` : 'Instagram-Erinnerung'

        const p = (async () => {
          let imageBlob: Blob | undefined
          let previewUrl: string | undefined

          if (media.uri) {
            const imageFile = zip.file(media.uri)
            if (imageFile) {
              try {
                imageBlob = await imageFile.async('blob')
                previewUrl = URL.createObjectURL(imageBlob)
              } catch {
                // Image unreadable – entry still importable as text-only
              }
            }
          }

          loaded++
          onProgress?.(loaded, loaded) // we don't know total upfront

          const id = `ig-${crypto.randomUUID()}`
          return {
            id,
            platform: 'instagram' as const,
            originalCaption: caption,
            timestamp,
            imageBlob,
            previewUrl,
            selected: true,
            description: caption || fallbackTitle,
          }
        })()

        mediaProcessingPromises.push(p)
      }
    }
  }

  const candidates = await Promise.all(mediaProcessingPromises)

  if (candidates.length === 0) {
    throw new Error(
      'Im Export wurden keine Fotos oder Beiträge mit Inhalten gefunden.',
    )
  }

  // Newest first
  candidates.sort((a, b) => b.timestamp - a.timestamp)
  return candidates
}
