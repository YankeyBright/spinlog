import type { Writable } from 'node:stream'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCapabilities, type TerminalMode, type UnicodeMode } from '../src/env.js'
import type { RenderTarget } from '../src/text.js'

const XTERM = { TERM: 'xterm-256color' }
const ENV_KEYS = [
  'CI',
  'FORCE_COLOR',
  'NO_COLOR',
  'NODE_DISABLE_COLORS',
  'NODE_ENV',
  'TERM',
  'WT_SESSION',
] as const
const stream = { write: () => true } as unknown as Writable

function target(isTTY: boolean): RenderTarget {
  return { stream, isTTY, columns: 80, rows: 24 }
}

describe('terminal capabilities', () => {
  let originalEnvironment: Record<(typeof ENV_KEYS)[number], string | undefined>
  let platform: NodeJS.Platform

  beforeEach(() => {
    originalEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
    for (const key of ENV_KEYS) delete process.env[key]
    platform = process.platform
    vi.spyOn(process, 'platform', 'get').mockImplementation(() => platform)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const key of ENV_KEYS) {
      const value = originalEnvironment[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  function capabilities(
    env: NodeJS.ProcessEnv = {},
    isTTY = true,
    nextPlatform: NodeJS.Platform = 'linux',
    terminal: TerminalMode = 'auto',
    unicode: UnicodeMode = 'auto',
  ) {
    for (const key of ENV_KEYS) delete process.env[key]
    Object.assign(process.env, env)
    platform = nextPlatform
    return getCapabilities(target(isTTY), terminal, unicode)
  }

  it('enables known SGR and cursor capabilities on an ordinary TTY', () => {
    expect(capabilities(XTERM)).toEqual({
      sgr: true,
      cursor: true,
      color: true,
      emphasis: true,
      animation: true,
      unicode: true,
    })
    expect(Object.isFrozen(capabilities(XTERM))).toBe(true)
  })

  it.each([
    [{ ...XTERM, NO_COLOR: '1', FORCE_COLOR: '1' }, false],
    [{ ...XTERM, NO_COLOR: '1', FORCE_COLOR: '' }, false],
    [{ ...XTERM, NODE_DISABLE_COLORS: '1', FORCE_COLOR: '1' }, false],
    [{ ...XTERM, NO_COLOR: '1', NODE_DISABLE_COLORS: '1', FORCE_COLOR: '1' }, false],
    [{ ...XTERM, NO_COLOR: '', NODE_DISABLE_COLORS: '', FORCE_COLOR: '1' }, true],
  ])('applies explicit color precedence for %j', (env, expected) => {
    expect(capabilities(env).color).toBe(expected)
  })

  it.each([
    [{ ...XTERM, FORCE_COLOR: '0' }, false],
    [{ ...XTERM, FORCE_COLOR: 'false' }, false],
    [{ ...XTERM, FORCE_COLOR: '' }, true],
    [{ ...XTERM, FORCE_COLOR: '1' }, true],
  ])('interprets FORCE_COLOR=%j below explicit disable variables', (env, expected) => {
    expect(capabilities(env).color).toBe(expected)
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
      expect(capabilities(env)).toMatchObject({ color, emphasis, animation })
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
      expect(capabilities({ TERM: term }).cursor, term).toBe(true)
    }

    for (const term of ['', 'unknown', 'vt100', 'vt220', 'xtermish', 'puttyx', 'screen_256color']) {
      expect(capabilities({ TERM: term })).toMatchObject({
        sgr: false,
        cursor: false,
        color: false,
        emphasis: false,
        animation: false,
      })
    }
  })

  it('keeps physical stream constraints while honoring explicit terminal modes', () => {
    expect(capabilities({ TERM: 'unknown', CI: '1' }, true, 'linux', 'interactive')).toMatchObject({
      cursor: false,
      color: false,
      emphasis: false,
      animation: true,
    })
    expect(capabilities(XTERM, true, 'linux', 'static').animation).toBe(false)
    expect(capabilities({ TERM: 'dumb' }, true, 'linux', 'interactive').animation).toBe(false)
    expect(capabilities(XTERM, false, 'linux', 'interactive').animation).toBe(false)
  })

  it('keeps forced color separate from cursor animation and supports Windows Terminal', () => {
    expect(capabilities({ FORCE_COLOR: '1' }, false)).toEqual({
      sgr: true,
      cursor: false,
      color: true,
      emphasis: true,
      animation: false,
      unicode: true,
    })
    expect(capabilities({ NO_COLOR: '1', FORCE_COLOR: '1' }, false)).toEqual({
      sgr: true,
      cursor: false,
      color: false,
      emphasis: true,
      animation: false,
      unicode: true,
    })
    expect(capabilities({}, true, 'win32').unicode).toBe(false)
    expect(capabilities({ WT_SESSION: 'session' }, true, 'win32')).toMatchObject({
      sgr: true,
      cursor: true,
      unicode: true,
    })
  })
})
