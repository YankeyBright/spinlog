// ─────────────────────────────────────────────────────────────────────────────
// env.ts — Terminal capability detection
//
// This module answers three questions about the runtime environment:
//   1. Should we emit ANSI color codes?     → `color`
//   2. Should we animate (spinner frames)?  → `animation`
//   3. Can we safely use Unicode glyphs?    → `unicode`
//
// The answers come back as a readonly 3-tuple called `Capabilities`.
//
// Everything in this file is **side-effect-free**: it only reads environment
// variables and platform info — it never writes to any stream.
//
// HOW TO EXTEND:
//   If you need to detect a new terminal capability (e.g. 256-color, hyperlinks),
//   add it as a fourth element to the `Capabilities` tuple, compute it inside
//   `getCapabilities`, and update the destructuring sites in spinner.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Immutable 3-tuple describing what the host terminal can do.
 *
 * Index 0 (`color`)     — true when ANSI color escape codes should be emitted.
 * Index 1 (`animation`) — true when the terminal supports animated redraws
 *                          (cursor movement, line clearing, etc.).
 * Index 2 (`unicode`)   — true when the terminal can render multi-byte Unicode
 *                          characters (Braille dots ⠋⠙⠹, status symbols ✔✖⚠ℹ).
 */
export type Capabilities = readonly [color: boolean, animation: boolean, unicode: boolean]

/**
 * Returns `true` when the environment is known to be non-interactive.
 *
 * Non-interactive contexts include:
 *   - CI systems          (`CI` env var is set — GitHub Actions, Jenkins, etc.)
 *   - Dumb terminals      (`TERM=dumb` — no cursor control)
 *   - Test runners         (`NODE_ENV=test` — avoid noisy spinner output in tests)
 *   - Non-TTY stderr       (output is piped or redirected to a file)
 *
 * When the terminal is non-interactive, animations and colors are disabled
 * by default (colors can still be force-enabled via `FORCE_COLOR`).
 */
function disablesTerminalFeatures(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  return Boolean(env.CI) || env.TERM === 'dumb' || env.NODE_ENV === 'test' || !isTTY
}

/**
 * Detect what the current terminal supports.
 *
 * All three parameters default to the real process values, but can be
 * overridden in tests so capability detection is fully deterministic.
 *
 * @param env      - The environment-variable dictionary (default: `process.env`).
 * @param isTTY    - Whether stderr is a TTY (default: `process.stderr.isTTY`).
 * @param platform - The OS identifier (default: `process.platform`).
 *
 * Color resolution priority (highest → lowest):
 *   1. `FORCE_COLOR` overrides everything. Set to '0' or 'false' to disable,
 *      any other value to force-enable.
 *   2. `NO_COLOR` or `NODE_DISABLE_COLORS` disables color (see https://no-color.org).
 *   3. Non-interactive environments (CI, dumb, pipe) disable color.
 *   4. Otherwise, color is enabled.
 *
 * Unicode detection:
 *   On Windows, Unicode is only enabled inside Windows Terminal (`WT_SESSION`
 *   env var present). Classic cmd.exe and legacy ConHost cannot reliably
 *   render multi-byte characters. On macOS and Linux, Unicode is always on.
 */
export function getCapabilities(
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = process.stderr.isTTY === true,
  platform: NodeJS.Platform = process.platform,
): Capabilities {
  // Step 1: Check if the user explicitly forced color on or off.
  const forceColor = env.FORCE_COLOR

  // Step 2: Determine if the terminal context is non-interactive.
  const terminalDisabled = disablesTerminalFeatures(env, isTTY)

  // Step 3: Resolve final color decision.
  //   - If FORCE_COLOR is set, it wins (unless it's '0'/'false').
  //   - Otherwise, color is on only if NO_COLOR is absent AND the terminal
  //     is interactive.
  const color =
    forceColor === undefined
      ? !env.NO_COLOR && !env.NODE_DISABLE_COLORS && !terminalDisabled
      : forceColor !== '0' && forceColor !== 'false'

  // Return the tuple: [color, animation, unicode]
  //   animation = opposite of terminalDisabled (interactive terminals animate)
  //   unicode   = always true except on win32 without Windows Terminal
  return [color, !terminalDisabled, platform !== 'win32' || Boolean(env.WT_SESSION)]
}
