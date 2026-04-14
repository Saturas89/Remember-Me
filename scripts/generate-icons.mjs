/**
 * Generates PWA icons from an SVG source.
 * Run once: node scripts/generate-icons.mjs
 * Requires: sharp (dev dependency)
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

/**
 * App icon SVG (512×512 viewBox).
 *
 * Design: Sepia-theme logo shape (heart + figure) rendered in white on dark background.
 * The figure elements (head, body, book) appear as dark cutouts inside the white heart,
 * mirroring the full logo design used in the sepia theme of the app.
 *
 * Heart math (original path is 48×44 viewBox, heart spans x:2–46, y:6.1–41):
 *   scale = 7.5
 *   center: tx = 256 − 24×7.5 = 76, ty = 256 − 23.55×7.5 ≈ 75
 *   Result: heart fills x 91–421 (330 px wide, 64% of 512) ✓
 */
const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Background gradient: dark navy to near-black -->
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%"   stop-color="#1e2647"/>
      <stop offset="100%" stop-color="#0c1120"/>
    </linearGradient>

    <!-- Soft radial glow behind the heart -->
    <radialGradient id="glow" cx="50%" cy="48%" r="42%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>

  <!-- Soft radial glow -->
  <ellipse cx="256" cy="238" rx="210" ry="168" fill="url(#glow)"/>

  <!-- Full sepia logo design in white: heart + figure (cutout elements in background colour) -->
  <g transform="translate(76, 75) scale(7.5)">

    <!-- White heart -->
    <path
      d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
      fill="#ffffff"
    />

    <!-- Sparkles (dark, visible on white heart) -->
    <path d="M34,8 L34.55,9.45 L36,10 L34.55,10.55 L34,12 L33.45,10.55 L32,10 L33.45,9.45 Z" fill="#13193a" opacity="0.55"/>
    <path d="M13,11 L13.4,12.1 L14.5,12.5 L13.4,12.9 L13,14 L12.6,12.9 L11.5,12.5 L12.6,12.1 Z" fill="#13193a" opacity="0.45"/>
    <path d="M30,7 L30.25,7.75 L31,8 L30.25,8.25 L30,9 L29.75,8.25 L29,8 L29.75,7.75 Z" fill="#13193a" opacity="0.35"/>

    <!-- Head -->
    <circle cx="24" cy="14.5" r="3" fill="#13193a"/>

    <!-- Body connector -->
    <path d="M21.5,17.5 C21.5,19.5 22.5,21.5 24,22 C25.5,21.5 26.5,19.5 26.5,17.5 Z" fill="#13193a"/>

    <!-- Book – left page -->
    <path d="M24,22 C22,21.5 15,22 11,26 L11,30 C15,31 21,31.5 24,32 Z" fill="#13193a"/>
    <!-- Book – right page -->
    <path d="M24,22 C26,21.5 33,22 37,26 L37,30 C33,31 27,31.5 24,32 Z" fill="#13193a"/>
    <!-- Book spine (white line between the two dark pages) -->
    <line x1="24" y1="22" x2="24" y2="32" stroke="white" stroke-width="0.5"/>

  </g>
</svg>`

const svgBuffer = Buffer.from(appIconSvg)

async function generate() {
  const sizes = [
    { file: 'pwa-192x192.png', size: 192 },
    { file: 'pwa-512x512.png', size: 512 },
    { file: 'apple-touch-icon.png', size: 180 },
  ]

  for (const { file, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, file))
    console.log(`✓ ${file} (${size}×${size})`)
  }

  console.log('\nAll icons generated in public/')
}

generate().catch(err => {
  console.error(err)
  process.exit(1)
})
