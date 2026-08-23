import { describe, expect, it } from 'vitest'

import { getCapabilities } from '../src/env.js'

const XTERM = { TERM: 'xterm-256color' }

describe('terminal capabilities', () => {
  it('enables known SGR and cursor capabilities on an ordinary TTY', () => {
    expect(getCapabilities(XTERM, true, 'linux')).toEqual({
      sgr: true,
      cursor: true,
      color: true,
      emphasis: true,
      animation: true,
      unicode: true,
    })
    expect(Object.isFrozen(getCapabilities(XTERM, true, 'linux'))).toBe(true)
  })

  it.each([
    [{ ...XTERM, NO_COLOR: '1', FORCE_COLOR: '1' }, false],
    [{ ...XTERM, NO_COLOR: '1', FORCE_COLOR: '' }, false],
    [{ ...XTERM, NODE_DISABLE_COLORS: '1', FORCE_COLOR: '1' }, false],
    [{ ...XTERM, NO_COLOR: '1', NODE_DISABLE_COLORS: '1', FORCE_COLOR: '1' }, false],
    [{ ...XTERM, NO_COLOR: '', NODE_DISABLE_COLORS: '', FORCE_COLOR: '1' }, true],
  ])('applies explicit color precedence for %j', (env, expected) => {
    expect(getCapabilities(env, true, 'linux').color).toBe(expected)
  })

  it.each([
    [{ ...XTERM, FORCE_COLOR: '0' }, false],
    [{ ...XTERM, FORCE_COLOR: 'false' }, false],
    [{ ...XTERM, FORCE_COLOR: '' }, true],
    [{ ...XTERM, FORCE_COLOR: '1' }, true],
  ])('interprets FORCE_COLOR=%j below explicit disable variables', (env, expected) => {
    expect(getCapabilities(env, true, 'linux').color).toBe(expected)
  })

  it.each([
    [{ ...XTERM, NO_COLOR: '1' }, false, true, true],
    [{ ...XTERM, NODE_DISABLE_COLORS: '1' }, false, true, true],
    [{ ...XTERM, FORCE_COLOR: '0' }, false, true, true],
    [{ ...XTERM, CI: '1' }, false, false, false],
    [{ ...XTERM, TERM: 'dumb' }, false, false, false],
    [{ ...XTERM, NODE_ENV: 'test' }, false, false, false],
    [{ ...XTERM, CI: '' }, true, true, true],
  ])(
    'separates color, emphasis, and animation policy for %j',
    (env, color, emphasis, animation) => {
      const capabilities = getCapabilities(env, true, 'linux')
      expect(capabilities.color).toBe(color)
      expect(capabilities.emphasis).toBe(emphasis)
      expect(capabilities.animation).toBe(animation)
    },
  )

  it('uses a conservative profile policy before accepting automatic animation', () => {
    for (const term of [
      'xterm-256color',
      'screen-256color',
      'tmux-256color',
      'rxvt-unicode',
      'linux',
      'cygwin',
      'st-256color',
      'alacritty',
      'kitty',
      'wezterm',
      'foot',
      'konsole',
      'vte-256color',
      'eterm',
      'putty-256color',
    ]) {
      expect(getCapabilities({ TERM: term }, true, 'linux').cursor, term).toBe(true)
    }

    for (const term of ['', 'unknown', 'vt100', 'vt220', 'xtermish', 'puttyx', 'screen_256color']) {
      expect(getCapabilities({ TERM: term }, true, 'linux')).toMatchObject({
        sgr: false,
        cursor: false,
        color: false,
        emphasis: false,
        animation: false,
      })
    }
  })

  it('keeps physical stream constraints while honoring explicit terminal modes', () => {
    expect(
      getCapabilities({ TERM: 'unknown', CI: '1' }, true, 'linux', 'interactive'),
    ).toMatchObject({
      cursor: false,
      color: false,
      emphasis: false,
      animation: true,
    })
    expect(getCapabilities(XTERM, true, 'linux', 'static').animation).toBe(false)
    expect(getCapabilities({ TERM: 'dumb' }, true, 'linux', 'interactive').animation).toBe(false)
    expect(getCapabilities(XTERM, false, 'linux', 'interactive').animation).toBe(false)
  })

  it('keeps forced color separate from cursor animation and supports Windows Terminal', () => {
    expect(getCapabilities({ FORCE_COLOR: '1' }, false, 'linux')).toEqual({
      sgr: false,
      cursor: false,
      color: true,
      emphasis: false,
      animation: false,
      unicode: true,
    })
    expect(getCapabilities({ NO_COLOR: '1', FORCE_COLOR: '1' }, false, 'linux')).toEqual({
      sgr: false,
      cursor: false,
      color: false,
      emphasis: false,
      animation: false,
      unicode: true,
    })
    expect(getCapabilities({}, true, 'win32').unicode).toBe(false)
    expect(getCapabilities({ WT_SESSION: 'session' }, true, 'win32')).toMatchObject({
      sgr: true,
      cursor: true,
      unicode: true,
    })
  })

  it('supports process defaults without throwing', () => {
    expect(getCapabilities()).toEqual({
      sgr: expect.any(Boolean),
      cursor: expect.any(Boolean),
      color: expect.any(Boolean),
      emphasis: expect.any(Boolean),
      animation: expect.any(Boolean),
      unicode: expect.any(Boolean),
    })
  })
})
