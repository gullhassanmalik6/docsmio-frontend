import { describe, expect, it } from 'vitest'
import { targetToBytes } from './format'
import {
  binarySearchQuality,
  compressionNote,
  dimensionError,
  fitWithinLimits,
  formatSavings,
  imageExportName,
  imageFileError,
  percentFromWidth,
  resizeLinked,
  savingsPercent,
  scaleError,
  sizeFromPercent,
  targetSizeError,
  targetWasReached,
} from './image-math'

describe('target size checks', () => {
  it('converts KB and MB using 1024-byte units', () => {
    expect(targetToBytes(200, 'KB')).toBe(200 * 1024)
    expect(targetToBytes(1, 'MB')).toBe(1024 * 1024)
  })

  it('rejects empty, tiny, and oversized targets', () => {
    expect(targetSizeError(0)).toMatch(/target size/i)
    expect(targetSizeError(targetToBytes(5, 'KB'))).toMatch(/10 KB/)
    expect(targetSizeError(targetToBytes(21, 'MB'))).toMatch(/20 MB/)
    expect(targetSizeError(targetToBytes(200, 'KB'))).toBeNull()
  })

  it('reports a target as reached only when the output byte count is at or under it', () => {
    expect(targetWasReached(15_000, 15_360)).toBe(true)
    expect(targetWasReached(15_361, 15_360)).toBe(false)
    expect(targetWasReached(Number.NaN, 15_360)).toBe(false)
  })
})

describe('aspect ratio and percentage resize', () => {
  it('updates the other side when the ratio is locked', () => {
    expect(resizeLinked('width', 300, 80, 1.5, true)).toEqual({ width: 300, height: 200 })
    expect(resizeLinked('height', 100, 300, 1.5, true)).toEqual({ width: 150, height: 100 })
  })

  it('leaves the other side unchanged when the ratio is unlocked', () => {
    expect(resizeLinked('width', 300, 80, 1.5, false)).toEqual({ width: 300, height: 80 })
    expect(resizeLinked('height', 40, 300, 1.5, false)).toEqual({ width: 300, height: 40 })
  })

  it('scales both dimensions from a percentage of the starting size', () => {
    expect(sizeFromPercent(1200, 800, 50)).toEqual({ width: 600, height: 400 })
    expect(percentFromWidth(1200, 600)).toBe(50)
    expect(scaleError(0)).toMatch(/greater than 0/)
    expect(scaleError(401)).toMatch(/400%/)
  })

  it('rejects zero, fractional, and oversized dimensions', () => {
    expect(dimensionError(0)).toMatch(/at least 1/)
    expect(dimensionError(10.5)).toMatch(/whole pixels/)
    expect(dimensionError(9000)).toMatch(/8000/)
    expect(dimensionError(640)).toBeNull()
  })

  it('reduces images that would exceed the browser pixel budget', () => {
    const fitted = fitWithinLimits(10_000, 5000)
    expect(fitted.reduced).toBe(true)
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(16_000_000)
    expect(Math.max(fitted.width, fitted.height)).toBeLessThanOrEqual(8000)
    expect(fitWithinLimits(800, 600)).toEqual({ width: 800, height: 600, reduced: false })
  })
})

describe('file names, savings, and rejected uploads', () => {
  it('builds a download name from the original stem and the operation', () => {
    expect(imageExportName('photo.jpg', 'jpeg', 'compressed')).toBe('photo_compressed.jpg')
    expect(imageExportName('scan.png', 'png', 'resized')).toBe('scan_resized.png')
    expect(imageExportName('my file.webp', 'webp', 'compressed')).toBe('my_file_compressed.webp')
  })

  it('calculates savings from the actual byte counts', () => {
    expect(savingsPercent(1000, 250)).toBe(75)
    expect(formatSavings(75)).toMatch(/Saved 75%/)
    expect(formatSavings(-12.5)).toMatch(/larger/)
    expect(savingsPercent(0, 100)).toBeNull()
  })

  it('rejects empty, unsupported, and oversized files before processing', () => {
    expect(imageFileError(new File([], 'empty.png', { type: 'image/png' }))).toMatch(/empty/i)
    expect(imageFileError(new File(['gif'], 'anim.gif', { type: 'image/gif' }))).toMatch(/JPG, PNG, or WebP/)
    expect(imageFileError(new File(['heic'], 'shot.heic', { type: 'image/heic' }))).toMatch(/HEIC/)
    const huge = new File([new Uint8Array(1)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(huge, 'size', { value: 21 * 1024 * 1024 })
    expect(imageFileError(huge)).toMatch(/20 MB/)
  })
})

describe('controlled quality search', () => {
  it('keeps the highest measured quality that fits the target', async () => {
    const found = await binarySearchQuality(async (quality) => Math.round(1000 + quality * 100_000), 20_000, 0.8)
    expect(found.reached).toBe(true)
    expect(found.size).toBeLessThanOrEqual(20_000)
    expect(found.quality).toBeGreaterThan(0.15)
    expect(found.quality).toBeLessThanOrEqual(0.19)
  })

  it('does not claim success when every measured size is over the target', async () => {
    const found = await binarySearchQuality(async () => 500_000, 1000, 0.9)
    expect(found.reached).toBe(false)
    expect(found.size).toBe(500_000)
    expect(compressionNote({ format: 'jpeg', reachedTarget: false, scaledDown: true, width: 40, height: 30, flattenedTransparency: false })).toMatch(/could not be reached/)
  })

  it('surfaces a failed encode instead of a successful result', async () => {
    await expect(binarySearchQuality(async () => Promise.reject(new Error('encode failed')), 20_000, 0.8)).rejects.toThrow(/encode failed/)
  })
})
