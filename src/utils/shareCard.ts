export interface ShareCardOpts {
  title: string
  subtitle?: string
  items?: string[]
}

// Generates a 1080×1080 branded preview image for WhatsApp/native share.
// The caller must pre-fetch the logo as a Blob (same-origin, avoids canvas taint).
// Returns null on any failure so callers can fall back gracefully.
export async function generateShareCard(
  logoBlob: Blob,
  opts: ShareCardOpts,
): Promise<File | null> {
  try {
    const SIZE = 1080
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // ── Logo ──────────────────────────────────────────────────────────────
    const logoUrl = URL.createObjectURL(logoBlob)
    const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = logoUrl
    })
    URL.revokeObjectURL(logoUrl)

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = '#fdf6ef'
    ctx.fillRect(0, 0, SIZE, SIZE)

    // Subtle top bar
    ctx.fillStyle = '#7b3f00'
    ctx.fillRect(0, 0, SIZE, 12)

    // ── Logo (centered, top area) ─────────────────────────────────────────
    const LOGO_SIZE = 160
    const logoX = (SIZE - LOGO_SIZE) / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(logoX + LOGO_SIZE / 2, 180, LOGO_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logo, logoX, 100, LOGO_SIZE, LOGO_SIZE)
    ctx.restore()

    // ── App name ──────────────────────────────────────────────────────────
    ctx.textAlign = 'center'
    ctx.fillStyle = '#2d1a08'
    ctx.font = `bold 56px system-ui, -apple-system, sans-serif`
    ctx.fillText('Remember Me', SIZE / 2, 320)

    ctx.fillStyle = '#9e7a5a'
    ctx.font = `28px system-ui, -apple-system, sans-serif`
    ctx.fillText('Deine Lebensgeschichte für die Nachwelt', SIZE / 2, 368)

    // ── Divider ───────────────────────────────────────────────────────────
    ctx.strokeStyle = '#e8d5c0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(80, 410)
    ctx.lineTo(SIZE - 80, 410)
    ctx.stroke()

    // ── Main title ────────────────────────────────────────────────────────
    ctx.fillStyle = '#2d1a08'
    ctx.font = `bold 52px system-ui, -apple-system, sans-serif`
    const titleLines = wrapText(ctx, opts.title, SIZE - 160)
    let y = 500
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, SIZE / 2, y)
      y += 68
    }

    // ── Subtitle ──────────────────────────────────────────────────────────
    if (opts.subtitle) {
      ctx.fillStyle = '#7b5c3a'
      ctx.font = `32px system-ui, -apple-system, sans-serif`
      const subLines = wrapText(ctx, opts.subtitle, SIZE - 160)
      for (const line of subLines.slice(0, 2)) {
        ctx.fillText(line, SIZE / 2, y)
        y += 46
      }
      y += 8
    }

    // ── Items (memory titles) ─────────────────────────────────────────────
    if (opts.items && opts.items.length > 0) {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#4a3020'
      ctx.font = `30px system-ui, -apple-system, sans-serif`
      const maxItems = 4
      const shown = opts.items.slice(0, maxItems)
      y += 16
      for (const item of shown) {
        const text = truncate(`• ${item}`, 52)
        ctx.fillText(text, 80, y)
        y += 48
      }
      if (opts.items.length > maxItems) {
        ctx.fillStyle = '#9e7a5a'
        ctx.font = `26px system-ui, -apple-system, sans-serif`
        ctx.fillText(`  …und ${opts.items.length - maxItems} weitere`, 80, y)
      }
      ctx.textAlign = 'center'
    }

    // ── Domain footer ─────────────────────────────────────────────────────
    ctx.fillStyle = '#c4a882'
    ctx.font = `24px system-ui, -apple-system, sans-serif`
    ctx.fillText('rememberme.dad', SIZE / 2, SIZE - 48)

    // Bottom bar
    ctx.fillStyle = '#7b3f00'
    ctx.fillRect(0, SIZE - 12, SIZE, 12)

    // ── Export ────────────────────────────────────────────────────────────
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) return null
    return new File([blob], 'remember-me-share.png', { type: 'image/png' })
  } catch {
    return null
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
