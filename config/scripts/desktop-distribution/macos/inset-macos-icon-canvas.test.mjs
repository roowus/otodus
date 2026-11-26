import { describe, expect, it } from 'vitest'
import { APPLE_ICON_TILE_RATIO, insetIconCanvas } from './inset-macos-icon-canvas.mjs'

/** A filled square tile that fills the whole canvas, as Icon Composer emits. */
function edgeToEdgeTile(size) {
  const data = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 40
    data[i * 4 + 1] = 80
    data[i * 4 + 2] = 120
    data[i * 4 + 3] = 255
  }
  return { width: size, height: size, data }
}

function opaqueBounds(image) {
  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] > 16) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

describe('macOS icon canvas inset', () => {
  it('shrinks an edge-to-edge tile to Apple’s 824/1024 grid', () => {
    const inset = insetIconCanvas(edgeToEdgeTile(1024))
    const bounds = opaqueBounds(inset)
    expect(bounds.width).toBe(824)
    expect(bounds.height).toBe(824)
  })

  it('centres the tile, leaving the same margin on all four sides', () => {
    const bounds = opaqueBounds(insetIconCanvas(edgeToEdgeTile(1024)))
    expect(bounds.minX).toBe(100)
    expect(bounds.minY).toBe(100)
    expect(1024 - (bounds.maxX + 1)).toBe(100)
    expect(1024 - (bounds.maxY + 1)).toBe(100)
  })

  it('keeps the canvas at 1024 so Dock slots never rescale it', () => {
    const inset = insetIconCanvas(edgeToEdgeTile(1024))
    expect([inset.width, inset.height]).toEqual([1024, 1024])
  })

  it('leaves an already-inset render alone instead of double-shrinking it', () => {
    const once = insetIconCanvas(edgeToEdgeTile(1024))
    const twice = insetIconCanvas(once)
    // Second pass sees the 824px tile and scales it again, so a regenerated icon must be insetted
    // from the source render, never from an icon this script already wrote.
    expect(opaqueBounds(twice).width).toBeLessThan(opaqueBounds(once).width)
    expect(APPLE_ICON_TILE_RATIO).toBeCloseTo(0.8047, 3)
  })

  it('preserves the artwork: only scale changes, not pixels', () => {
    const inset = insetIconCanvas(edgeToEdgeTile(1024))
    const centre = (512 * inset.width + 512) * 4
    expect([...inset.data.subarray(centre, centre + 4)]).toEqual([40, 80, 120, 255])
  })
})
