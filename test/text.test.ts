import { describe, expect, it } from 'vitest'

import { resolveRenderTarget, terminalCellWidth, terminalTextWidth } from '../src/text.js'

describe('render target validation', () => {
  it('rejects values that are not writable streams', () => {
    for (const value of [null, 42, [], {}, { write: true }]) {
      expect(() => resolveRenderTarget(value as never)).toThrow(
        'stream must be a Node writable stream',
      )
    }
  })
})

describe('terminal cell measurement', () => {
  it.each([
    ['', 0],
    ['plain', 5],
    ['\u00e9', 1],
    ['e\u0301', 1],
    ['\u754c', 2],
    ['\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66', 2],
    ['\ud83c\uddee\ud83c\uddf8', 2],
    ['1\ufe0f\u20e3', 2],
    ['a\u754c', 3],
  ])('measures %j as %i terminal cells', (value, expected) => {
    expect(terminalTextWidth(value)).toBe(expected)
  })

  it('measures only the first complete grapheme for a cell query', () => {
    expect(terminalCellWidth('e\u0301tail')).toBe(1)
    expect(terminalCellWidth('\ud83d\udc69\u200d\ud83d\udc69tail')).toBe(2)
  })

  it.each([
    '\u00ad',
    '\u034f',
    '\u061c',
    '\u200b',
    '\u200c',
    '\u200d',
    '\u2060',
    '\ufeff',
    '\u0001',
    '\u007f',
    '\ufe0e',
    '\udb40\udd00',
    '\u0301',
  ])('treats zero-width code point %j as zero cells', (value) => {
    expect(terminalTextWidth(value)).toBe(0)
  })

  it.each([
    '\u1100',
    '\u2329',
    '\u232a',
    '\u2e80',
    '\uac00',
    '\uf900',
    '\ufe10',
    '\ufe30',
    '\uff00',
    '\uffe0',
    '\ud82c\udc00',
    '\ud83c\ude10',
    '\ud840\udc00',
  ])('treats full-width code point %j as two cells', (value) => {
    expect(terminalTextWidth(value)).toBe(2)
  })

  it('keeps the explicitly narrow CJK punctuation exception narrow', () => {
    expect(terminalTextWidth('\u303f')).toBe(1)
  })
})
