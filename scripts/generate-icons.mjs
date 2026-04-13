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
 * Design notes:
 * - Dark-to-deeper gradient background with rounded corners
 * - Soft radial glow ellipse behind the heart
 * - Heart gradient: bright coral top → deep crimson bottom
 * - Simple drop shadow (shifted semi-transparent copy, no filter needed)
 * - Shine highlight on upper-left of the heart
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

    <!-- Radial glow behind the heart -->
    <radialGradient id="glow" cx="50%" cy="48%" r="42%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>

  <!-- Soft radial glow behind heart -->
  <ellipse cx="256" cy="238" rx="210" ry="168" fill="url(#glow)"/>

  <!-- Drop shadow: same heart shifted down + darkened, rendered first -->
  <g transform="translate(76, 87) scale(7.5)" opacity="0.15">
    <path
      d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
      fill="#000000"
    />
  </g>

  <!-- Heart body -->
  <g transform="translate(76, 75) scale(7.5)">
    <path
      d="M24 41C24 41 2 27 2 13.5A11.5 11.5 0 0 1 24 6.1 11.5 11.5 0 0 1 46 13.5C46 27 24 41 24 41Z"
      fill="#ffffff"
    />
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
