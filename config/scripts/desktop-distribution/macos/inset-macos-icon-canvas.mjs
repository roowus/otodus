#!/usr/bin/env node
// Icon Composer renders the tile edge-to-edge on its canvas, but Apple's grid puts an 824px tile
// in a 1024px canvas. Edge-to-edge made Otodus draw ~24% larger than every other Dock icon.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  decodePng,
  encodePng,
  findOpaqueBounds,
  resizeImage
} from '../windows/trim-windows-icon-source.mjs'

/** Apple's macOS app-icon grid: an 824px tile centred in a 1024px canvas. */
export const APPLE_ICON_TILE_RATIO = 824 / 1024

/** Every slot a macOS .icns carries; the app icon must be inset in all of them, not just the small ones. */
export const MAC_ICNS_SLOTS = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

/** Scale a 1024px tile-by-tile render down and centre it on a transparent 1024px canvas. */
export function insetIconCanvas(image, tileRatio = APPLE_ICON_TILE_RATIO) {
  const bounds = findOpaqueBounds(image)
  const inner = bounds
    ? (() => {
        const out = Buffer.alloc(bounds.width * bounds.height * 4)
        for (let y = 0; y < bounds.height; y++) {
          const src = ((bounds.minY + y) * image.width + bounds.minX) * 4
          out.set(image.data.subarray(src, src + bounds.width * 4), y * bounds.width * 4)
        }
        return { width: bounds.width, height: bounds.height, data: out }
      })()
    : image
  const longSide = Math.max(inner.width, inner.height)
  const targetSide = Math.max(1, Math.round(longSide * tileRatio))
  const scaled = resizeImage(inner, targetSide, targetSide)
  const canvas = Buffer.alloc(1024 * 1024 * 4)
  const offset = Math.floor((1024 - targetSide) / 2)
  for (let y = 0; y < targetSide; y++) {
    const src = y * targetSide * 4
    const dst = ((offset + y) * 1024 + offset) * 4
    canvas.set(scaled.data.subarray(src, src + targetSide * 4), dst)
  }
  return { width: 1024, height: 1024, data: canvas }
}

/** Rewrites every slot of an .icns through `insetIconCanvas`. */
export function insetIcnsSlots(icnsPath) {
  const dir = mkdtempSync(join(tmpdir(), 'otodus-icns-'))
  try {
    const iconset = join(dir, 'icon.iconset')
    execFileSync('iconutil', ['-c', 'iconset', icnsPath, '-o', iconset])
    for (const [file, size] of MAC_ICNS_SLOTS) {
      const slotPath = join(iconset, file)
      let decoded
      try {
        decoded = decodePng(readFileSync(slotPath))
      } catch {
        // A slot the source .icns omits stays absent rather than becoming a blank canvas.
        continue
      }
      // Slots below 1024 carry the same inset scaled; only 512@2x is a straight canvas inset.
      const inset = insetIconCanvas(decoded)
      const scaled = size === 1024 ? inset : resizeImage(inset, size, size)
      writeFileSync(slotPath, encodePng(scaled))
    }
    const out = join(dir, 'icon.icns')
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', out])
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: inset-macos-icon-canvas.mjs <path/to/icon.icns>')
    process.exitCode = 2
  } else {
    writeFileSync(target, insetIcnsSlots(target))
    console.log(`[icon] inset every slot of ${target} to Apple's 824/1024 grid`)
  }
}
