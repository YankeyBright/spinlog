import { describe, expect, it } from 'vitest'

import { compareCanonicalText, sortCanonicalText } from '../scripts/canonical-order.mjs'

describe('canonical evidence ordering', () => {
  it('uses stable JavaScript string code-unit ordering', () => {
    expect(sortCanonicalText(['z', 'ä', 'a', 'A'])).toEqual(['A', 'a', 'z', 'ä'])
    expect(compareCanonicalText('a', 'ä')).toBeLessThan(0)
    expect(compareCanonicalText('ä', 'a')).toBeGreaterThan(0)
    expect(compareCanonicalText('same', 'same')).toBe(0)
  })

  it('returns an ordered copy without mutating the input', () => {
    const source = ['styles', 'index', 'ansi']

    expect(sortCanonicalText(source)).toEqual(['ansi', 'index', 'styles'])
    expect(source).toEqual(['styles', 'index', 'ansi'])
  })
})
