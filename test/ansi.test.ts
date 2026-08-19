import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyAnsiStyle, normalizeStyleNesting } from '../src/ansi.js'
import * as spinlog from '../src/index.js'
import * as styles from '../src/styles.js'

const CODES = {
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  strikethrough: [9, 29],
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  blackBright: [90, 39],
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  blueBright: [94, 39],
  magentaBright: [95, 39],
  cyanBright: [96, 39],
  whiteBright: [97, 39],
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  bgBlackBright: [100, 49],
  bgRedBright: [101, 49],
  bgGreenBright: [102, 49],
  bgYellowBright: [103, 49],
  bgBlueBright: [104, 49],
  bgMagentaBright: [105, 49],
  bgCyanBright: [106, 49],
  bgWhiteBright: [107, 49],
} as const
const STYLES = {
  reset: spinlog.reset,
  bold: spinlog.bold,
  dim: spinlog.dim,
  italic: spinlog.italic,
  underline: spinlog.underline,
  strikethrough: spinlog.strikethrough,
  black: spinlog.black,
  red: spinlog.red,
  green: spinlog.green,
  yellow: spinlog.yellow,
  blue: spinlog.blue,
  magenta: spinlog.magenta,
  cyan: spinlog.cyan,
  white: spinlog.white,
  blackBright: spinlog.blackBright,
  redBright: spinlog.redBright,
  greenBright: spinlog.greenBright,
  yellowBright: spinlog.yellowBright,
  blueBright: spinlog.blueBright,
  magentaBright: spinlog.magentaBright,
  cyanBright: spinlog.cyanBright,
  whiteBright: spinlog.whiteBright,
  bgBlack: spinlog.bgBlack,
  bgRed: spinlog.bgRed,
  bgGreen: spinlog.bgGreen,
  bgYellow: spinlog.bgYellow,
  bgBlue: spinlog.bgBlue,
  bgMagenta: spinlog.bgMagenta,
  bgCyan: spinlog.bgCyan,
  bgWhite: spinlog.bgWhite,
  bgBlackBright: spinlog.bgBlackBright,
  bgRedBright: spinlog.bgRedBright,
  bgGreenBright: spinlog.bgGreenBright,
  bgYellowBright: spinlog.bgYellowBright,
  bgBlueBright: spinlog.bgBlueBright,
  bgMagentaBright: spinlog.bgMagentaBright,
  bgCyanBright: spinlog.bgCyanBright,
  bgWhiteBright: spinlog.bgWhiteBright,
}

describe('ANSI styles', () => {
  beforeEach(() => {
    vi.stubEnv('FORCE_COLOR', '1')
    vi.stubEnv('NO_COLOR', '')
    vi.stubEnv('NODE_DISABLE_COLORS', '')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('emits every frozen SGR opening and closing sequence', () => {
    for (const [name, [open, close]] of Object.entries(CODES)) {
      const style = STYLES[name as keyof typeof CODES]
      expect(style('value')).toBe(`\x1b[${open}mvalue\x1b[${close}m`)
    }
  })

  it('returns input unchanged when color is disabled', () => {
    vi.stubEnv('FORCE_COLOR', '0')

    for (const name of Object.keys(CODES)) {
      expect(STYLES[name as keyof typeof CODES]('plain')).toBe('plain')
    }
  })

  it('honors NO_COLOR over FORCE_COLOR through both public entry points', () => {
    vi.stubEnv('NO_COLOR', '1')

    expect(spinlog.red('plain')).toBe('plain')
    expect(styles.red('plain')).toBe('plain')
  })

  it.each(['0', '1'])('rejects invalid JavaScript input with FORCE_COLOR=%s', (forceColor) => {
    vi.stubEnv('FORCE_COLOR', forceColor)
    expect(() => spinlog.red(null as unknown as string)).toThrow('text must be a string')
  })

  it('restores enclosing foreground, background, and modifier styles', () => {
    expect(spinlog.red(`a ${spinlog.blue('b')} c`)).toBe('\x1b[31ma \x1b[34mb\x1b[31m c\x1b[39m')
    expect(spinlog.bgRed(`a ${spinlog.bgBlue('b')} c`)).toBe(
      '\x1b[41ma \x1b[44mb\x1b[41m c\x1b[49m',
    )
    expect(spinlog.bold(`a ${spinlog.dim('b')} c`)).toBe(
      '\x1b[1ma \x1b[2mb\x1b[22m\x1b[1m c\x1b[22m',
    )
  })

  it('normalizes legacy and already-restored Node nesting without duplication', () => {
    const foreground = '\x1b[31ma \x1b[34mb\x1b[31m c\x1b[39m'
    const background = '\x1b[41ma \x1b[44mb\x1b[41m c\x1b[49m'
    const modifier = '\x1b[1ma \x1b[2mb\x1b[22m\x1b[1m c\x1b[22m'
    const resetBoundary = '\x1b[31ma \x1b[0mb\x1b[0m c\x1b[39m'

    expect(normalizeStyleNesting('\x1b[31ma \x1b[34mb\x1b[39m c\x1b[39m')).toBe(foreground)
    expect(normalizeStyleNesting(foreground)).toBe(foreground)
    expect(normalizeStyleNesting('\x1b[41ma \x1b[44mb\x1b[49m c\x1b[49m')).toBe(background)
    expect(normalizeStyleNesting(background)).toBe(background)
    expect(normalizeStyleNesting('\x1b[1ma \x1b[2mb\x1b[22m c\x1b[22m')).toBe(modifier)
    expect(normalizeStyleNesting(modifier)).toBe(modifier)
    expect(normalizeStyleNesting(resetBoundary)).toBe(resetBoundary)
  })

  it('leaves non-SGR and incomplete values unchanged', () => {
    expect(normalizeStyleNesting('plain')).toBe('plain')
    expect(normalizeStyleNesting('\x1b[broken')).toBe('\x1b[broken')
    expect(normalizeStyleNesting('\x1b[31mvalue')).toBe('\x1b[31mvalue')
  })

  it('treats reset as a hard SGR boundary', () => {
    expect(spinlog.red(`a ${spinlog.reset('b')} c`)).toBe('\x1b[31ma \x1b[0mb\x1b[0m c\x1b[39m')
  })

  it('applies ANSI styling and normalizes nesting directly through applyAnsiStyle', () => {
    expect(applyAnsiStyle('red', 'text')).toBe('\x1b[31mtext\x1b[39m')
    expect(applyAnsiStyle('red', `a ${applyAnsiStyle('blue', 'b')} c`)).toBe(
      '\x1b[31ma \x1b[34mb\x1b[31m c\x1b[39m',
    )
  })
})
