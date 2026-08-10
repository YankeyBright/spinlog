// ─────────────────────────────────────────────────────────────────────────────
// styles.ts — Side-effect-free ANSI text styling helpers
//
// This module exports individual style functions (bold, red, bgCyan, …) that
// callers can use to colorize CLI output. Each function:
//
//   1. Checks color capability via `env.getCapabilities()`.
//   2. If color is enabled, wraps the text in the appropriate ANSI escape
//      sequences using Node's built-in `styleText`.
//   3. If color is disabled, returns the text unchanged.
//
// These functions are the PUBLIC style surface of the library (re-exported
// from index.ts). They are pure — they read capabilities but never write to
// any stream — so they are safe to call anywhere.
//
// This module is also exposed as a separate entrypoint (`spinlog/styles`)
// so consumers who only need styling without the spinner can tree-shake
// away the spinner code entirely.
//
// HOW TO ADD A NEW STYLE:
//   1. Pick the `StyleFormat` name from Node's `styleText` supported formats.
//      Run `node -e "console.log(require('util').inspect.colors)"` to see them.
//   2. Export a new `Style` arrow function that delegates to `applyStyle`.
//      e.g.  export const inverse: Style = (text) => applyStyle('inverse', text)
//   3. If the new style should be part of the public API, re-export it from
//      index.ts as well.
// ─────────────────────────────────────────────────────────────────────────────

import { styleText } from 'node:util'

import { getCapabilities } from './env.js'

/** A side-effect-free style transformation that follows stderr color capability. */
export type Style = (text: string) => string

/**
 * Extract only the string-based format names from `styleText`'s first parameter.
 * This excludes array-based compound formats, keeping the type narrow and safe.
 */
type StyleFormat = Extract<Parameters<typeof styleText>[0], string>

/**
 * Core styling engine. Applies a single ANSI format to `text` when color is
 * enabled, or returns `text` unchanged otherwise.
 *
 * @param format - The ANSI format name (e.g. 'bold', 'red', 'bgCyan').
 * @param text   - The string to style.
 * @throws {TypeError} if `text` is not a string.
 *
 * Why `validateStream: false`?
 *   Color capability was already resolved by `getCapabilities()` in env.ts.
 *   Letting Node re-check would couple us to a specific stream and could
 *   produce inconsistent results.
 */
function applyStyle(format: StyleFormat, text: string): string {
  if (typeof text !== 'string') throw new TypeError('text must be a string')
  const [colorEnabled] = getCapabilities()
  // env.ts owns color policy, so Node must not re-evaluate another stream.
  return colorEnabled ? styleText(format, text, { validateStream: false }) : text
}

// ── Text decoration styles ──────────────────────────────────────────────────
// These modify the font appearance rather than the color.

export const reset: Style = (text) => applyStyle('reset', text)
export const bold: Style = (text) => applyStyle('bold', text)
export const dim: Style = (text) => applyStyle('dim', text)
export const italic: Style = (text) => applyStyle('italic', text)
export const underline: Style = (text) => applyStyle('underline', text)
export const strikethrough: Style = (text) => applyStyle('strikethrough', text)

// ── Foreground colors (standard 8 + 8 bright variants) ──────────────────────
// These set the text color while leaving the background unchanged.

export const black: Style = (text) => applyStyle('black', text)
export const red: Style = (text) => applyStyle('red', text)
export const green: Style = (text) => applyStyle('green', text)
export const yellow: Style = (text) => applyStyle('yellow', text)
export const blue: Style = (text) => applyStyle('blue', text)
export const magenta: Style = (text) => applyStyle('magenta', text)
export const cyan: Style = (text) => applyStyle('cyan', text)
export const white: Style = (text) => applyStyle('white', text)
export const blackBright: Style = (text) => applyStyle('blackBright', text)
export const redBright: Style = (text) => applyStyle('redBright', text)
export const greenBright: Style = (text) => applyStyle('greenBright', text)
export const yellowBright: Style = (text) => applyStyle('yellowBright', text)
export const blueBright: Style = (text) => applyStyle('blueBright', text)
export const magentaBright: Style = (text) => applyStyle('magentaBright', text)
export const cyanBright: Style = (text) => applyStyle('cyanBright', text)
export const whiteBright: Style = (text) => applyStyle('whiteBright', text)

// ── Background colors (standard 8 + 8 bright variants) ──────────────────────
// These set the background color behind the text.

export const bgBlack: Style = (text) => applyStyle('bgBlack', text)
export const bgRed: Style = (text) => applyStyle('bgRed', text)
export const bgGreen: Style = (text) => applyStyle('bgGreen', text)
export const bgYellow: Style = (text) => applyStyle('bgYellow', text)
export const bgBlue: Style = (text) => applyStyle('bgBlue', text)
export const bgMagenta: Style = (text) => applyStyle('bgMagenta', text)
export const bgCyan: Style = (text) => applyStyle('bgCyan', text)
export const bgWhite: Style = (text) => applyStyle('bgWhite', text)
export const bgBlackBright: Style = (text) => applyStyle('bgBlackBright', text)
export const bgRedBright: Style = (text) => applyStyle('bgRedBright', text)
export const bgGreenBright: Style = (text) => applyStyle('bgGreenBright', text)
export const bgYellowBright: Style = (text) => applyStyle('bgYellowBright', text)
export const bgBlueBright: Style = (text) => applyStyle('bgBlueBright', text)
export const bgMagentaBright: Style = (text) => applyStyle('bgMagentaBright', text)
export const bgCyanBright: Style = (text) => applyStyle('bgCyanBright', text)
export const bgWhiteBright: Style = (text) => applyStyle('bgWhiteBright', text)
