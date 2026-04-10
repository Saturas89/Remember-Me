/**
 * Generates PWA icons from an SVG source.
 * Run once: node scripts/generate-icons.mjs
 * Requires: sharp (dev dependency)
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Heart icon SVG – matches the app's HeroLogo
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="#1a1a2e"/>
  <!-- Heart -->
  <path
    d="M256 420 C256 420 68 308 68 168
       A114 114 0 0 1 256 97
       A114 114 0 0 1 444 168
       C444 308 256 420 256 420 Z"
    fill="#e94560"
  />
  <!-- Shine -->
  <path
    d="M170 145 C140 145 115 170 115 200"
    stroke="rgba(255,255,255,0.28)"
    stroke-width="18"
    stroke-linecap="round"
    fill="none"
  />
</svg>
`

const svgBuffer = Buffer.from(svg)

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
    console.log(`✓ ${file}`)
  }

  console.log('All icons generated in public/')
}

generate().catch(err => {
  console.error(err)
  process.exit(1)
})
