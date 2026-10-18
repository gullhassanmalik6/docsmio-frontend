export type PageRangeResult = { pages: number[] } | { error: string }

export function parsePageRanges(input: string, pageCount: number): PageRangeResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { error: 'This PDF has no pages to split.' }
  }

  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { error: 'Enter a page range. Example: 1-3, 5, 8-10' }
  }

  const pages: number[] = []
  const seen = new Set<number>()
  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!match) {
      return { error: `"${part}" is not a valid range. Use 1-3, 5, or 8-10.` }
    }
    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : start
    if (start < 1 || end < 1) {
      return { error: `"${part}" is outside this document. Pages run from 1 to ${pageCount}.` }
    }
    if (end < start) {
      return { error: `"${part}" is reversed. Put the smaller page number first.` }
    }
    if (end > pageCount) {
      return { error: `"${part}" is outside this document. Pages run from 1 to ${pageCount}.` }
    }
    for (let page = start; page <= end; page += 1) {
      if (seen.has(page)) return { error: `Page ${page} is listed more than once.` }
      seen.add(page)
      pages.push(page)
    }
  }

  return { pages }
}
