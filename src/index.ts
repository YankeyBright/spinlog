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

/**
 * Signature for a style function: takes a string, returns a styled string.
 * The styling is applied only when color capability is detected (see env.ts).
 */
type Style = (text: string) => string

/** Built-in spinner animation names. */
export type SpinnerName = 'dots' | 'line'

/**
 * ANSI-16 foreground colors available to spinner frames.
 *
 * These correspond to the 16 standard terminal colors. Every color here is
 * also available as a standalone style function (e.g. `import { cyan } from 'spinlog'`).
 */
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

/**
 * Options used to create a spinner.
 *
 * All fields are optional — sensible defaults are applied in spinner.ts:
 *   color   → 'cyan'
 *   prefix  → '' (empty string, no prefix)
 *   suffix  → '' (empty string, no suffix)
 *   spinner → 'dots' (Braille dot animation)
 */
export interface SpinnerOptions {
  color?: SpinnerColor
  prefix?: string
  suffix?: string
  spinner?: SpinnerName
}

/**
 * Options used by {@link Spinlog.promise}.
 * Extends `SpinnerOptions` with a `text` field for the spinner message.
 */
export interface PromiseOptions extends SpinnerOptions {
  text?: string
}

/**
 * A mutable spinner with idempotent lifecycle methods.
 *
 * Lifecycle flow:
 *   1. Create with `spinlog('Loading…')` — spinner is in IDLE state.
 *   2. Call `.start()` — transitions to SPINNING, begins animation.
 *   3. End with a terminal method: `.succeed()`, `.fail()`, `.warn()`, or `.info()`.
 *      Each prints a final status line and stops the animation.
 *
 * Idempotency:
 *   - Calling `.start()` on an already-spinning instance is a no-op (returns `this`).
 *   - Calling a terminal method more than once is a no-op after the first call.
 *   - `.stop()` cleans up without printing a status line.
 *
 * All properties (text, color, prefix, suffix) can be changed mid-spin.
 */
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

/**
 * Callable spinner factory with promise-settlement integration.
 *
 * Usage as a factory:
 *   const spinner = spinlog('Loading…', { color: 'yellow' })
 *   spinner.start()
 *
 * Usage with promises:
 *   await spinlog.promise(fetch('/data'), { text: 'Fetching…' })
 *   // Automatically calls .succeed() or .fail() based on promise outcome.
 */
export interface Spinlog {
  (text?: string, options?: SpinnerOptions): Spinner
  promise<T>(input: PromiseLike<T>, options?: PromiseOptions): Promise<T>
  promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions): Promise<T>
}

// ── Public Style Exports ────────────────────────────────────────────────────
// Re-export style functions under their short, ergonomic names.
// Consumers use these as:  import { bold, red } from 'spinlog'

// Text decoration styles
export const reset: Style = ansiReset
export const bold: Style = ansiBold
export const dim: Style = ansiDim
export const italic: Style = ansiItalic
export const underline: Style = ansiUnderline
export const strikethrough: Style = ansiStrikethrough

// Foreground colors (standard 8)
export const black: Style = ansiBlack
export const red: Style = ansiRed
export const green: Style = ansiGreen
export const yellow: Style = ansiYellow
export const blue: Style = ansiBlue
export const magenta: Style = ansiMagenta
export const cyan: Style = ansiCyan
export const white: Style = ansiWhite

// Foreground colors (bright variants)
export const blackBright: Style = ansiBlackBright
export const redBright: Style = ansiRedBright
export const greenBright: Style = ansiGreenBright
export const yellowBright: Style = ansiYellowBright
export const blueBright: Style = ansiBlueBright
export const magentaBright: Style = ansiMagentaBright
export const cyanBright: Style = ansiCyanBright
export const whiteBright: Style = ansiWhiteBright

// Background colors (standard 8)
export const bgBlack: Style = ansiBgBlack
export const bgRed: Style = ansiBgRed
export const bgGreen: Style = ansiBgGreen
export const bgYellow: Style = ansiBgYellow
export const bgBlue: Style = ansiBgBlue
export const bgMagenta: Style = ansiBgMagenta
export const bgCyan: Style = ansiBgCyan
export const bgWhite: Style = ansiBgWhite

// Background colors (bright variants)
export const bgBlackBright: Style = ansiBgBlackBright
export const bgRedBright: Style = ansiBgRedBright
export const bgGreenBright: Style = ansiBgGreenBright
export const bgYellowBright: Style = ansiBgYellowBright
export const bgBlueBright: Style = ansiBgBlueBright
export const bgMagentaBright: Style = ansiBgMagentaBright
export const bgCyanBright: Style = ansiBgCyanBright
export const bgWhiteBright: Style = ansiBgWhiteBright

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

/**
 * Assemble the final `spinlog` object: a callable factory with a `.promise`
 * method attached.
 *
 * `@__PURE__` tells bundlers (esbuild, Rollup) that this `Object.assign`
 * has no side effects, so it can be tree-shaken if unused.
 */
const spinlog: Spinlog = /* @__PURE__ */ Object.assign(factory, { promise })

export default spinlog
