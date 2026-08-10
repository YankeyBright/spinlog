import { describe, expect, it } from 'vitest'

import { getCapabilities } from '../src/env.js'

describe('terminal capabilities', () => {
  it('enables color, animation, and Unicode on an ordinary TTY', () => {
    expect(getCapabilities({}, true, 'linux')).toEqual([true, true, true])
  })

  it.each([
    [{ FORCE_COLOR: '0' }, false],
    [{ FORCE_COLOR: 'false' }, false],
    [{ FORCE_COLOR: '' }, true],
    [{ FORCE_COLOR: '1' }, true],
  ])('applies FORCE_COLOR precedence for %j', (env, expected) => {
    expect(getCapabilities({ ...env, NO_COLOR: '1', CI: '1' }, false, 'linux')[0]).toBe(expected)
  })

  it.each([
    [{ NO_COLOR: '1' }, true, false],
    [{ NODE_DISABLE_COLORS: '1' }, true, false],
    [{ CI: '1' }, true, true],
    [{ TERM: 'dumb' }, true, true],
    [{ NODE_ENV: 'test' }, true, true],
    [{ CI: '' }, false, false],
  ])('applies the frozen disable policy for %j', (env, colorDisabled, animationDisabled) => {
    const capabilities = getCapabilities(env, true, 'linux')
    expect(capabilities[0]).toBe(!colorDisabled)
    expect(capabilities[1]).toBe(!animationDisabled)
  })

  it('keeps animation disabled when FORCE_COLOR enables non-TTY color', () => {
    expect(getCapabilities({ FORCE_COLOR: '1' }, false, 'linux')).toEqual([true, false, true])
  })

  it('uses the frozen Windows Terminal Unicode heuristic', () => {
    expect(getCapabilities({}, true, 'win32')[2]).toBe(false)
    expect(getCapabilities({ WT_SESSION: 'session' }, true, 'win32')[2]).toBe(true)
  })

  it('supports the process defaults without throwing', () => {
    expect(getCapabilities()).toEqual([
      expect.any(Boolean),
      expect.any(Boolean),
      expect.any(Boolean),
    ])
  })
})
