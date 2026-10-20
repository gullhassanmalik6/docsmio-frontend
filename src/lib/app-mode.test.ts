import { describe, expect, it } from 'vitest'
import { nextAppMode, parseAppMode } from '@/lib/app-mode'

describe('application mode', () => {
  it('keeps wallet as the default and accepts only the tools value', () => {
    expect(parseAppMode(null)).toBe('wallet')
    expect(parseAppMode('wallet')).toBe('wallet')
    expect(parseAppMode('something-else')).toBe('wallet')
    expect(parseAppMode('tools')).toBe('tools')
  })

  it('switches between the two modes without a third state', () => {
    expect(nextAppMode('wallet')).toBe('tools')
    expect(nextAppMode('tools')).toBe('wallet')
  })
})
