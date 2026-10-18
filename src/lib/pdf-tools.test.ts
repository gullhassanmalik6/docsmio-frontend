import { describe, expect, it } from 'vitest'
import { parsePageRanges } from './page-ranges'
import { compressionFacts, pdfFileError } from './pdf-report'

describe('page ranges', () => {
  it('keeps a valid range in the requested order', () => {
    expect(parsePageRanges('1-3, 5, 8-10', 12)).toEqual({ pages: [1, 2, 3, 5, 8, 9, 10] })
    expect(parsePageRanges(' 5, 1 - 2 ', 6)).toEqual({ pages: [5, 1, 2] })
  })

  it('rejects empty input and invalid syntax', () => {
    expect(parsePageRanges('   ', 4)).toMatchObject({ error: expect.stringMatching(/page range/i) })
    expect(parsePageRanges('1-3-5', 8)).toMatchObject({ error: expect.stringMatching(/not a valid range/) })
    expect(parsePageRanges('a, 2', 8)).toMatchObject({ error: expect.stringMatching(/not a valid range/) })
  })

  it('rejects duplicate pages', () => {
    expect(parsePageRanges('1-3, 2', 10)).toMatchObject({ error: 'Page 2 is listed more than once.' })
    expect(parsePageRanges('4, 4', 6)).toMatchObject({ error: 'Page 4 is listed more than once.' })
  })

  it('rejects reversed ranges', () => {
    expect(parsePageRanges('8-3', 10)).toMatchObject({ error: expect.stringMatching(/reversed/) })
  })

  it('rejects pages outside the document', () => {
    expect(parsePageRanges('8', 2)).toMatchObject({ error: expect.stringMatching(/outside this document/) })
    expect(parsePageRanges('1-4', 3)).toMatchObject({ error: expect.stringMatching(/1 to 3/) })
    expect(parsePageRanges('1', 0)).toMatchObject({ error: expect.stringMatching(/no pages/) })
  })
})

describe('PDF file checks and compression results', () => {
  it('rejects empty, non-PDF, and oversized uploads', () => {
    expect(pdfFileError(new File([], 'empty.pdf', { type: 'application/pdf' }))).toMatch(/empty/i)
    expect(pdfFileError(new File(['hello'], 'notes.txt', { type: 'text/plain' }))).toMatch(/PDF/)
    const huge = new File([new Uint8Array(8)], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(huge, 'size', { value: 51 * 1024 * 1024 })
    expect(pdfFileError(huge)).toMatch(/50 MB/)
    expect(pdfFileError(new File(['%PDF'], 'ok.pdf', { type: 'application/pdf' }))).toBeNull()
  })

  it('marks a target as reached only when the measured output is at or under it', () => {
    const over = compressionFacts({ mode: 'low', originalBytes: 1000, outputBytes: 800, targetBytes: 700 })
    expect(over.reachedTarget).toBe(false)
    expect(over.reduced).toBe(true)
    expect(over.note).toMatch(/still above the target/)

    const exact = compressionFacts({ mode: 'balanced', originalBytes: 5000, outputBytes: 2000, targetBytes: 2000 })
    expect(exact.reachedTarget).toBe(true)
    expect(exact.note).toMatch(/within the target/)
  })

  it('does not describe a larger file as a successful reduction', () => {
    const larger = compressionFacts({ mode: 'low', originalBytes: 1000, outputBytes: 1200, targetBytes: 800 })
    expect(larger.reduced).toBe(false)
    expect(larger.reachedTarget).toBe(false)
    expect(larger.note).toMatch(/No size reduction was achieved/)
    expect(larger.note).toMatch(/does not recompress images/)

    const rebuilt = compressionFacts({ mode: 'high', originalBytes: 1000, outputBytes: 1400, targetBytes: 2000 })
    expect(rebuilt.reduced).toBe(false)
    expect(rebuilt.reachedTarget).toBe(true)
    expect(rebuilt.note).toMatch(/no size reduction was achieved/i)
    expect(rebuilt.note).toMatch(/still within the requested target/)
  })
})
