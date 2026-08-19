// ─────────────────────────────────────────────────────────────────────────────
// index.ts — Public API surface of the spinlog library
//
// This is the MAIN entrypoint that consumers import:
//
//   import spinlog, { bold, cyan } from 'spinlog'
//
// It re-exports:
//   • All style functions (bold, red, bgCyan, …) from styles.ts
//   • The `spinlog` default export — a callable spinner factory
//   • A `spinlog.promise()` helper for automatic spinner lifecycle
//
// It also declares the library's public TypeScript types:
//   • SpinnerName, SpinnerColor — union types for built-in names & colors
//   • SpinnerOptions, PromiseOptions — option bags
//   • Spinner — the mutable spinner instance interface
//   • Spinlog — the callable factory interface
//
// HOW TO ADD A NEW PUBLIC TYPE:
//   1. Declare it in this file.
//   2. Add it to the `export` statements (TypeScript will include it in the
//      generated .d.ts declarations automatically).
//
// HOW TO ADD A NEW PUBLIC STYLE:
//   1. Add the style function in styles.ts.
//   2. Import and re-export it from this file.
// ─────────────────────────────────────────────────────────────────────────────

// ── Style Re-exports ────────────────────────────────────────────────────────
// Import every individual style from the internal styles module, renaming
// with an `ansi` prefix to avoid name collisions with the public aliases
// we export below.

import {
  bgBlack as ansiBgBlack,
  bgBlackBright as ansiBgBlackBright,
  bgBlue as ansiBgBlue,
  bgBlueBright as ansiBgBlueBright,
  bgCyan as ansiBgCyan,
  bgCyanBright as ansiBgCyanBright,
  bgGreen as ansiBgGreen,
  bgGreenBright as ansiBgGreenBright,
  bgMagenta as ansiBgMagenta,
  bgMagentaBright as ansiBgMagentaBright,
  bgRed as ansiBgRed,
  bgRedBright as ansiBgRedBright,
  bgWhite as ansiBgWhite,
  bgWhiteBright as ansiBgWhiteBright,
  bgYellow as ansiBgYellow,
  bgYellowBright as ansiBgYellowBright,
  black as ansiBlack,
  blackBright as ansiBlackBright,
  blue as ansiBlue,
  blueBright as ansiBlueBright,
  bold as ansiBold,
  cyan as ansiCyan,
  cyanBright as ansiCyanBright,
  dim as ansiDim,
  green as ansiGreen,
  greenBright as ansiGreenBright,
  italic as ansiItalic,
  magenta as ansiMagenta,
  magentaBright as ansiMagentaBright,
  red as ansiRed,
  redBright as ansiRedBright,
  reset as ansiReset,
  strikethrough as ansiStrikethrough,
  underline as ansiUnderline,
  white as ansiWhite,
  whiteBright as ansiWhiteBright,
  yellow as ansiYellow,
  yellowBright as ansiYellowBright,
} from './styles.js'
import { createSpinner } from './spinner.js'

// ── Type Definitions ────────────────────────────────────────────────────────

/** Built-in spinner animation names. */
export type SpinnerName = 'dots' | 'line'

/** ANSI-16 foreground colors available to spinner frames. */
export type SpinnerColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright'

/** Options used to create a spinner. */
export interface SpinnerOptions {
  color?: SpinnerColor
  prefix?: string
  suffix?: string
  spinner?: SpinnerName
}

/** Options used by the `Spinlog.promise` overloads. */
export interface PromiseOptions extends SpinnerOptions {
  text?: string
}

/** A mutable spinner with idempotent lifecycle methods. */
export interface Spinner {
  text: string
  color: SpinnerColor
  prefix: string
  suffix: string
  /** Starts a new rendering cycle or returns the active instance unchanged. */
  start(): this
  /** Stops an active cycle and restores owned terminal state. */
  stop(): this
  /** Persists the first successful terminal result for the current cycle. */
  succeed(text?: string): this
  /** Persists the first failed terminal result for the current cycle. */
  fail(text?: string): this
  /** Persists the first warning terminal result for the current cycle. */
  warn(text?: string): this
  /** Persists the first informational terminal result for the current cycle. */
  info(text?: string): this
}

/** Callable spinner factory with promise-settlement integration. */
export interface Spinlog {
  (text?: string, options?: SpinnerOptions): Spinner
  promise<T>(input: PromiseLike<T>, options?: PromiseOptions): Promise<T>
  promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions): Promise<T>
}

// ── Public Style Exports ────────────────────────────────────────────────────
// Re-export style functions under their short, ergonomic names.
// Consumers use these as:  import { bold, red } from 'spinlog'

// Text decoration styles
export const reset: (text: string) => string = ansiReset
export const bold: (text: string) => string = ansiBold
export const dim: (text: string) => string = ansiDim
export const italic: (text: string) => string = ansiItalic
export const underline: (text: string) => string = ansiUnderline
export const strikethrough: (text: string) => string = ansiStrikethrough

// Foreground colors (standard 8)
export const black: (text: string) => string = ansiBlack
export const red: (text: string) => string = ansiRed
export const green: (text: string) => string = ansiGreen
export const yellow: (text: string) => string = ansiYellow
export const blue: (text: string) => string = ansiBlue
export const magenta: (text: string) => string = ansiMagenta
export const cyan: (text: string) => string = ansiCyan
export const white: (text: string) => string = ansiWhite

// Foreground colors (bright variants)
export const blackBright: (text: string) => string = ansiBlackBright
export const redBright: (text: string) => string = ansiRedBright
export const greenBright: (text: string) => string = ansiGreenBright
export const yellowBright: (text: string) => string = ansiYellowBright
export const blueBright: (text: string) => string = ansiBlueBright
export const magentaBright: (text: string) => string = ansiMagentaBright
export const cyanBright: (text: string) => string = ansiCyanBright
export const whiteBright: (text: string) => string = ansiWhiteBright

// Background colors (standard 8)
export const bgBlack: (text: string) => string = ansiBgBlack
export const bgRed: (text: string) => string = ansiBgRed
export const bgGreen: (text: string) => string = ansiBgGreen
export const bgYellow: (text: string) => string = ansiBgYellow
export const bgBlue: (text: string) => string = ansiBgBlue
export const bgMagenta: (text: string) => string = ansiBgMagenta
export const bgCyan: (text: string) => string = ansiBgCyan
export const bgWhite: (text: string) => string = ansiBgWhite

// Background colors (bright variants)
export const bgBlackBright: (text: string) => string = ansiBgBlackBright
export const bgRedBright: (text: string) => string = ansiBgRedBright
export const bgGreenBright: (text: string) => string = ansiBgGreenBright
export const bgYellowBright: (text: string) => string = ansiBgYellowBright
export const bgBlueBright: (text: string) => string = ansiBgBlueBright
export const bgMagentaBright: (text: string) => string = ansiBgMagentaBright
export const bgCyanBright: (text: string) => string = ansiBgCyanBright
export const bgWhiteBright: (text: string) => string = ansiBgWhiteBright

// ── Spinner Factory ─────────────────────────────────────────────────────────

/**
 * The default spinner factory.
 * Creates a new `Spinner` instance with the given text and options.
 * Delegates all the real work to `createSpinner` in spinner.ts.
 */
const factory = (text = '', options: SpinnerOptions = {}): Spinner => createSpinner(text, options)

// ── Promise Helper ──────────────────────────────────────────────────────────

/**
 * Wraps a promise (or a function that returns one) with an automatic spinner.
 *
 * Behaviour:
 *   1. Creates a spinner with the given options and starts it.
 *   2. Awaits the promise or invokes the function.
 *   3. On success → calls `spinner.succeed()` and returns the resolved value.
 *   4. On failure → calls `spinner.fail()` and re-throws the error.
 *
 * This lets you write one-liner progress indicators:
 *   const data = await spinlog.promise(fetchData(), { text: 'Loading…' })
 */
const promise: Spinlog['promise'] = async <T>(
  input: PromiseLike<T> | (() => PromiseLike<T>),
  options: PromiseOptions = {},
) => {
  // Guard: options must be a plain object, not null/array/primitive.
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object')
  }

  // Start the spinner immediately.
  const spinner = factory(options.text, options).start()
  try {
    // If `input` is a function, call it to obtain the promise; otherwise use it directly.
    const value = await (typeof input === 'function' ? input() : input)
    spinner.succeed()
    return value
  } catch (error) {
    spinner.fail()
    throw error
  }
}

// ── Default Export ───────────────────────────────────────────────────────────

const spinlog: Spinlog = /* @__PURE__ */ Object.assign(factory, { promise })

export default spinlog
