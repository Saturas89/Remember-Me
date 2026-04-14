/**
 * Generates PWA icons from logo.jpeg.
 * Run once: node scripts/generate-icons.mjs
 * Requires: sharp (dev dependency)
 *
 * Strategy: resize the logo to fill the square (fit:cover), then blend
 * the outer edges into the logo's own cream background colour using a
 * feathered radial-gradient overlay.  This hides the circular border
 * without a hard cut that would itself look circular.
 *
 * Circle boundary measured via pixel sampling (1167×1042 source):
 *   outer shadow starts: y≈50  (top), x≈70  (left)
 *   inner circle solid:  y≈65  (top), x≈80  (left)
 *   Background colour inside circle: approx. rgb(243, 226, 189)
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const publicDir  = join(__dirname, '..', 'public')
const sourceImage = join(publicDir, 'logo.jpeg')

// Cream colour sampled from inside the circle (centre column y ≈ 100)
const BG = { r: 243, g: 226, b: 189 }
const bgCss = `rgb(${BG.r},${BG.g},${BG.b})`

async function generate () {
  const { width: imgW, height: imgH } = await sharp(sourceImage).metadata()

  // With fit:cover at any square size S the scale factor is S/imgH
  // (imgH < imgW so height binds).
  // The circle's inner boundary maps to:
  //   top  = 65  * (S/imgH)        ≈ 0.0624 * S
  //   left = (70 - (imgW-imgH)/2 * (S/imgH)) ≈ very close to 0
  // → effective radii as a fraction of S/2:
  //   ry_frac = (S/2 - top) / (S/2)  = 1 - 0.0624*2 = 0.875
  //   rx_frac = very close to 1 (left boundary is almost at icon edge)
  // We choose a slight inset to keep the gradient centred on the shadow zone.
  const RX_FRAC = 0.92   // horizontal ellipse radius as fraction of S/2
  const RY_FRAC = 0.87   // vertical   ellipse radius as fraction of S/2
  // Gaussian feather radius (in pixels at size 512 → scales proportionally)
  const FEATHER_FRAC = 0.04  // 4 % of icon size

  const sizes = [
    { file: 'pwa-512x512.png',      size: 512 },
    { file: 'pwa-192x192.png',      size: 192 },
    { file: 'apple-touch-icon.png', size: 180 },
  ]

  for (const { file, size } of sizes) {
    const half    = size / 2
    const rx      = Math.round(half * RX_FRAC)
    const ry      = Math.round(half * RY_FRAC)
    const feather = Math.max(2, Math.round(size * FEATHER_FRAC))

    // 1) Fill the square with the logo using cover (crops the wider dimension)
    const coverBuf = await sharp(sourceImage)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()

    // 2) Feathered ellipse mask: white inside → show logo, blurred edge → fade
    //    A Gaussian-blurred white ellipse on transparent background.
    const maskSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<defs>` +
      `<filter id="f" x="-20%" y="-20%" width="140%" height="140%">` +
      `<feGaussianBlur stdDeviation="${feather}"/>` +
      `</filter>` +
      `</defs>` +
      `<ellipse cx="${half}" cy="${half}" rx="${rx}" ry="${ry}" ` +
      `fill="white" filter="url(#f)"/>` +
      `</svg>`
    )

    // 3) Apply mask to the cover image (dest-in: keep logo where mask is opaque)
    const maskedLogo = await sharp(coverBuf)
      .ensureAlpha()
      .composite([{ input: maskSvg, blend: 'dest-in' }])
      .png()
      .toBuffer()

    // 4) Place on the matching cream background → corners become cream
    await sharp({
      create: { width: size, height: size, channels: 4,
                background: { ...BG, alpha: 255 } }
    })
      .composite([{ input: maskedLogo, blend: 'over' }])
      .png()
      .toFile(join(publicDir, file))

    console.log(`✓ ${file} (${size}×${size})`)
  }

  console.log('\nAll icons generated in public/')
}

generate().catch(err => { console.error(err); process.exit(1) })
