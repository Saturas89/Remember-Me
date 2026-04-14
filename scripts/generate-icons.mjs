/**
 * Generates PWA icons from logo.jpeg.
 * Run once: node scripts/generate-icons.mjs
 * Requires: sharp (dev dependency)
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const sourceImage = join(publicDir, 'logo.jpeg')

// Background colour matching the sepia/cream edge of the logo
const BG = { r: 242, g: 235, b: 224, alpha: 1 }

async function generate() {
  const sizes = [
    { file: 'pwa-512x512.png', size: 512 },
    { file: 'pwa-192x192.png', size: 192 },
    { file: 'apple-touch-icon.png', size: 180 },
  ]

  for (const { file, size } of sizes) {
    await sharp(sourceImage)
      .resize(size, size, {
        fit: 'contain',
        background: BG,
      })
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
