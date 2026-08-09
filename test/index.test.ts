import { describe, expect, it } from 'vitest'

import { spinlog } from '../src/index.js'

describe('Phase 1 package shell', () => {
  it('exports an inert entry point', () => {
    expect(spinlog).toBeTypeOf('function')
    expect(() => spinlog()).not.toThrow()
  })
})
