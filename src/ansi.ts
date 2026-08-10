// ─────────────────────────────────────────────────────────────────────────────
// ansi.ts — Low-level color helper consumed by spinner.ts
//
// This module wraps Node's built-in `styleText` (from `node:util`) into a
// single, focused function: `colorize`. It exists so the rest of the library
// never interacts with ANSI escape codes directly — all coloring flows
// through this one place.
//
// Key design constraint:
//   Color-capability detection is handled centrally by `env.ts`.
//   `colorize` receives a pre-computed `enabled` boolean so it never
//   re-evaluates stream capabilities on its own.
// ─────────────────────────────────────────────────────────────────────────────

import { styleText } from 'node:util'

import type { SpinnerColor } from './index.js'

/**
 * Apply an ANSI-16 foreground color to `text` if coloring is `enabled`.
 *
 * @param color   - One of the 16 standard ANSI foreground color names
 *                  (e.g. 'cyan', 'redBright'). See `SpinnerColor` in index.ts.
 * @param text    - The plain string to wrap with ANSI escape sequences.
 * @param enabled - When false the text is returned unchanged, making it safe
 *                  to call unconditionally regardless of terminal capability.
 * @returns       The original `text`, optionally wrapped in ANSI color codes.
 *
 * Why `validateStream: false`?
 *   By default `styleText` checks whether the destination stream supports
 *   color. We already did that check in `env.ts`, so we skip the redundant
 *   validation to avoid coupling this function to a specific stream object.
 */
export function colorize(color: SpinnerColor, text: string, enabled: boolean): string {
  // env.ts owns color policy, so Node must not re-evaluate another stream.
  return enabled ? styleText(color, text, { validateStream: false }) : text
}
