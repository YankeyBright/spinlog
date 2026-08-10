// ─────────────────────────────────────────────────────────────────────────────
// spinner.ts — Core spinner engine
//
// This module implements the spinner's state machine, animation loop, and
// terminal output. It is the heart of the library.
//
// ARCHITECTURE OVERVIEW:
//
//   ┌───────┐   start()   ┌──────────┐   succeed/fail/   ┌──────────┐
//   │ IDLE  │ ──────────▶ │ SPINNING │ ──warn/info────▶ │ TERMINAL │
//   └───────┘             └──────────┘                   └──────────┘
//         │                     │                  (SUCCEEDED / FAILED /
//         │        stop()       │                   WARNED / INFORMED)
//         └─────────────────────┘
//                    ▼
//              ┌─────────┐
//              │ STOPPED │
//              └─────────┘
//
//   • IDLE     → freshly created, not yet started.
//   • SPINNING → animation timer is running, frames are being rendered.
//   • STOPPED  → manually stopped without a status line.
//   • TERMINAL → final status line printed (✔ ✖ ⚠ ℹ). No further writes.
//
// OUTPUT STREAM:
//   All output goes to stderr (never stdout). This is a deliberate design
//   choice so that programs can pipe structured data on stdout while the
//   spinner decorates stderr.
//
// CURSOR MANAGEMENT:
//   In animated mode, the cursor is hidden on start and restored on stop
//   or any terminal action. If a write fails, the cursor is restored
//   immediately to avoid leaving the terminal in a broken state.
//
// HOW TO ADD A NEW SPINNER ANIMATION:
//   1. Define a new frames string (e.g. const ARROW_FRAMES = '←↖↑↗→↘↓↙').
//   2. Add the name to `SpinnerName` in index.ts (e.g. 'arrow').
//   3. Update `requireSpinnerName` to accept it.
//   4. Update `selectFrame` to select the right frames string.
//
// HOW TO ADD A NEW TERMINAL STATUS:
//   1. Add a new state constant (e.g. const CUSTOM = 7).
//   2. Add it to the `State` union type.
//   3. Add a TerminalAction numeric key and corresponding STATUS entry.
//   4. Add a new method on the spinner object that calls `terminal(newKey)`.
//   5. Update `isTerminal` if you add a state outside the 3..6 contiguous range.
// ─────────────────────────────────────────────────────────────────────────────

import { stderr } from 'node:process'
import { stripVTControlCharacters } from 'node:util'

import { colorize } from './ansi.js'
import { type Capabilities, getCapabilities } from './env.js'
import type { Spinner, SpinnerColor, SpinnerName, SpinnerOptions } from './index.js'

// ── State Machine Constants ─────────────────────────────────────────────────
// Numeric constants representing each state. Using numbers instead of
// strings/enums keeps the minified output tiny and comparisons fast.

const IDLE = 0 // Created but not started
const SPINNING = 1 // Animation loop is active
const STOPPED = 2 // Manually stopped (no status line printed)
const SUCCEEDED = 3 // Terminal: success (✔)
const FAILED = 4 // Terminal: failure (✖)
const WARNED = 5 // Terminal: warning (⚠)
const INFORMED = 6 // Terminal: info (ℹ)

/**
 * Union of all possible spinner states.
 * Used internally to type the `state` variable and enforce exhaustive handling.
 */
type State =
  | typeof IDLE
  | typeof SPINNING
  | typeof STOPPED
  | typeof SUCCEEDED
  | typeof FAILED
  | typeof WARNED
  | typeof INFORMED

/**
 * Numeric keys into the STATUS lookup table (0–3).
 * Maps to the four terminal actions: succeed, fail, warn, info.
 */
type TerminalAction = 0 | 1 | 2 | 3

/**
 * A row in the STATUS lookup table.
 *   [0] = the State constant to transition to
 *   [1] = the Unicode symbol to display (e.g. ✔)
 *   [2] = the ASCII fallback symbol (e.g. +)
 *   [3] = the color to apply to the symbol
 */
type Status = readonly [state: State, unicode: string, ascii: string, color: SpinnerColor]

// ── ANSI Escape Sequences ───────────────────────────────────────────────────
// Raw escape codes used to control the terminal cursor and line content.

const HIDE_CURSOR = '\x1b[?25l' // CSI sequence: make cursor invisible
const SHOW_CURSOR = '\x1b[?25h' // CSI sequence: make cursor visible again
const CLEAR_LINE = '\x1b[2K\r' // Erase entire line + carriage return to col 0

// ── Animation Frame Strings ─────────────────────────────────────────────────
// Each character in the string is one animation frame. The spinner cycles
// through them using modular arithmetic (index % length).

const DOTS_FRAMES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' // Braille dot pattern (requires Unicode)
const LINE_FRAMES = '-\\|/' // Classic ASCII spinner (works everywhere)

// ── Allowed Colors ──────────────────────────────────────────────────────────
// Flat list of the 16 ANSI foreground color names, used for runtime validation
// in `requireColor`. Split from a space-delimited string to save bytes.

const SPINNER_COLORS =
  'black red green yellow blue magenta cyan white blackBright redBright greenBright yellowBright blueBright magentaBright cyanBright whiteBright'.split(
    ' ',
  )

// ── Terminal Status Lookup Table ────────────────────────────────────────────
// Maps each TerminalAction (0-3) to the state it transitions to, the
// unicode/ascii symbol to print, and the color for that symbol.

const STATUS = {
  0: [SUCCEEDED, '✔', '+', 'green'], // succeed → green checkmark
  1: [FAILED, '✖', 'x', 'red'], // fail    → red cross
  2: [WARNED, '⚠', '!', 'yellow'], // warn    → yellow warning
  3: [INFORMED, 'ℹ', 'i', 'blue'], // info    → blue info circle
} as const satisfies Record<TerminalAction, Status>

// ── Unsafe Text Pattern ─────────────────────────────────────────────────────
// Regex matching control characters, directional overrides, and other
// invisible/dangerous characters that could corrupt terminal output or
// enable text-spoofing attacks. These are stripped from user-provided text
// segments (prefix, text, suffix) before rendering.

const UNSAFE_TEXT = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]+/g

// ── Validation Helpers ──────────────────────────────────────────────────────
// Small guard functions that throw descriptive TypeErrors for invalid input.
// Centralizing validation keeps the main logic clean.

/** Throws if `value` is not a string. Returns the value unchanged if valid. */
function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  return value
}

/** Throws if `value` is not one of the 16 recognized ANSI color names. */
function requireColor(value: unknown): SpinnerColor {
  if (typeof value !== 'string' || !SPINNER_COLORS.includes(value)) {
    throw new TypeError('color must be a built-in spinner color')
  }
  return value as SpinnerColor
}

/** Throws if `value` is not 'dots' or 'line'. */
function requireSpinnerName(value: unknown): SpinnerName {
  if (value !== 'dots' && value !== 'line') {
    throw new TypeError("spinner must be 'dots' or 'line'")
  }
  return value
}

/** Throws if `value` is null, not an object, or an array. */
function requireOptions(value: SpinnerOptions): SpinnerOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('options must be an object')
  }
  return value
}

/**
 * Returns true if the spinner is in a terminal (final) state.
 *
 * Terminal states occupy the contiguous numeric range [SUCCEEDED..INFORMED]
 * (3–6), so a single `>=` comparison works. If you add states outside this
 * range, update this function accordingly.
 */
function isTerminal(state: State): boolean {
  // Terminal states intentionally occupy the contiguous range 3 through 6.
  return state >= SUCCEEDED
}

// ── Text Sanitization ───────────────────────────────────────────────────────

/**
 * Make a user-provided text segment safe for terminal rendering.
 *
 * Steps:
 *   1. Strip any existing ANSI escape sequences (users shouldn't inject their own).
 *   2. Replace dangerous invisible characters (control chars, directional
 *      overrides) with spaces.
 *   3. Trim leading/trailing whitespace.
 *
 * This prevents broken output and mitigates terminal-injection attacks.
 */
export function sanitizeSegment(value: string): string {
  return stripVTControlCharacters(value).replace(UNSAFE_TEXT, ' ').trim()
}

// ── Frame Selection ─────────────────────────────────────────────────────────

/**
 * Pick the animation frame character for the current tick.
 *
 * @param spinner - Which animation style ('dots' or 'line').
 * @param unicode - Whether the terminal supports Unicode (from env.ts).
 * @param index   - The current frame counter (incremented each tick).
 * @returns A single character to display as the spinner symbol.
 *
 * The 'dots' animation uses Braille characters (⠋⠙⠹…) when Unicode is
 * available, and falls back to the ASCII 'line' animation (-\|/) otherwise.
 */
export function selectFrame(spinner: SpinnerName, unicode: boolean, index: number): string {
  const frames = spinner === 'dots' && unicode ? DOTS_FRAMES : LINE_FRAMES
  return frames.charAt(index % frames.length)
}

// ── Status Symbol Selection ─────────────────────────────────────────────────

/**
 * Look up the symbol and color for a terminal action.
 *
 * @param action  - 0 (succeed), 1 (fail), 2 (warn), or 3 (info).
 * @param unicode - Whether the terminal supports Unicode.
 * @returns A tuple of [symbol string, color name].
 *
 * Example: selectStatus(0, true) → ['✔', 'green']
 *          selectStatus(0, false) → ['+', 'green']
 */
export function selectStatus(
  action: TerminalAction,
  unicode: boolean,
): readonly [symbol: string, color: SpinnerColor] {
  const [, unicodeSymbol, asciiSymbol, color] = STATUS[action]
  return [unicode ? unicodeSymbol : asciiSymbol, color]
}

// ── Spinner Factory ─────────────────────────────────────────────────────────

/**
 * Create a new spinner instance.
 *
 * This is the main factory function called by `spinlog()` in index.ts.
 * It uses a closure-based approach (rather than a class) to keep internal
 * state truly private — callers can only interact through the `Spinner`
 * interface.
 *
 * @param text    - Initial message displayed next to the spinner symbol.
 * @param options - Configuration overrides (color, prefix, suffix, spinner name).
 * @returns A fresh `Spinner` in the IDLE state, ready to be `.start()`ed.
 */
export function createSpinner(text = '', options: SpinnerOptions = {}): Spinner {
  // Validate options up front so callers get immediate, clear errors.
  const safeOptions = requireOptions(options)

  // ── Internal State (closure-private) ────────────────────────────────────
  // These variables are captured by the returned object's methods but are
  // never exposed directly. This is the "closure as encapsulation" pattern.

  let state: State = IDLE // Current lifecycle state
  let timer: NodeJS.Timeout | undefined // setInterval handle for animation
  let frameIndex = 0 // Current animation frame counter
  let capabilities: Capabilities | undefined // Cached terminal capabilities (set on start)

  // Mutable spinner properties — validated on every write via setters.
  let currentText = requireString(text, 'text')
  let currentColor = requireColor(safeOptions.color ?? 'cyan') // Default: cyan
  let currentPrefix = requireString(safeOptions.prefix ?? '', 'prefix')
  let currentSuffix = requireString(safeOptions.suffix ?? '', 'suffix')
  const spinnerName = requireSpinnerName(safeOptions.spinner ?? 'dots') // Default: 'dots'

  // ── The Spinner Object ──────────────────────────────────────────────────
  // Properties use getters/setters so that validation runs on every mutation,
  // even while the spinner is actively spinning.

  const spinner: Spinner = {
    // --- text: the message shown next to the spinner symbol ---
    get text() {
      return currentText
    },
    set text(value) {
      currentText = requireString(value, 'text')
    },

    // --- color: the ANSI color applied to the spinner frame character ---
    get color() {
      return currentColor
    },
    set color(value) {
      currentColor = requireColor(value)
    },

    // --- prefix: text shown before the spinner symbol ---
    get prefix() {
      return currentPrefix
    },
    set prefix(value) {
      currentPrefix = requireString(value, 'prefix')
    },

    // --- suffix: text shown after the spinner text ---
    get suffix() {
      return currentSuffix
    },
    set suffix(value) {
      currentSuffix = requireString(value, 'suffix')
    },

    /**
     * Start the spinner animation.
     *
     * Behaviour depends on terminal capabilities:
     *   • Interactive terminal (animation=true):
     *       1. Hide the cursor (HIDE_CURSOR escape sequence).
     *       2. Render the first frame.
     *       3. Start an 80ms interval timer that advances frames.
     *   • Non-interactive (CI, piped, dumb terminal):
     *       1. Print a single static line with the spinner frame + text.
     *       2. No timer, no cursor manipulation.
     *
     * Idempotent: calling start() on an already-spinning spinner is a no-op.
     */
    start() {
      // Guard: don't restart if already spinning.
      if (state === SPINNING) return this

      state = SPINNING
      frameIndex = 0

      // Snapshot capabilities at start time so the entire spin cycle uses
      // consistent color/animation/unicode decisions.
      const activeCapabilities = getCapabilities()
      capabilities = activeCapabilities
      const [, animationEnabled] = activeCapabilities

      // Non-interactive path: print one static line and return.
      if (!animationEnabled) {
        if (!tryWrite(`${renderFrame(activeCapabilities)}\n`)) abortCycle(false)
        return this
      }

      // Interactive path: hide cursor, render first frame, start timer.
      if (!tryWrite(HIDE_CURSOR) || !tryWrite(renderFrame(activeCapabilities))) {
        abortCycle(true)
        return this
      }

      // 80ms ≈ 12.5 fps — fast enough to look smooth, slow enough to be light.
      timer = setInterval(() => tick(activeCapabilities), 80)

      // .unref() lets Node exit even if the spinner is still running.
      // Without this, a forgotten spinner would keep the process alive.
      timer.unref()
      return this
    },

    /**
     * Stop the spinner without printing a status line.
     *
     * Use this when you want to silently remove the spinner. For a
     * visible outcome, prefer .succeed(), .fail(), .warn(), or .info().
     *
     * Idempotent: safe to call multiple times or on a stopped/terminal spinner.
     */
    stop() {
      // No-op if already in a terminal or stopped state.
      if (isTerminal(state) || state === STOPPED) return this

      const wasSpinning = state === SPINNING
      const activeCapabilities = capabilities

      state = STOPPED
      capabilities = undefined

      // If we never started spinning, there's nothing to clean up.
      if (!wasSpinning) return this

      // Cancel the animation timer.
      clearTimer()

      // In animated mode, clear the spinner line and restore the cursor.
      const animationEnabled = activeCapabilities?.[1] === true
      if (animationEnabled && !tryWrite(CLEAR_LINE)) {
        tryWrite(SHOW_CURSOR) // Best-effort cursor restoration on write failure
        return this
      }
      if (animationEnabled) tryWrite(SHOW_CURSOR)
      return this
    },

    // ── Terminal Methods ───────────────────────────────────────────────────
    // Each calls `terminal(action)` with a numeric action key that maps to
    // the STATUS table entry. They all return `this` for chaining.

    /** Print ✔ (green) and stop. */
    succeed(value) {
      terminal(0, value)
      return this
    },
    /** Print ✖ (red) and stop. */
    fail(value) {
      terminal(1, value)
      return this
    },
    /** Print ⚠ (yellow) and stop. */
    warn(value) {
      terminal(2, value)
      return this
    },
    /** Print ℹ (blue) and stop. */
    info(value) {
      terminal(3, value)
      return this
    },
  }

  // ── Internal Helper Functions ───────────────────────────────────────────
  // These are closure-private: accessible to the spinner methods above but
  // invisible to the outside world.

  /**
   * Transition to a terminal state and print the final status line.
   *
   * @param action - Which terminal action (0=succeed, 1=fail, 2=warn, 3=info).
   * @param value  - Optional text to replace the current spinner text.
   *
   * This is idempotent: once a terminal state is reached, subsequent calls
   * are silently ignored.
   */
  function terminal(action: TerminalAction, value?: string): void {
    // Guard: already in a terminal state — do nothing.
    if (isTerminal(state)) return

    // Allow the caller to override the displayed text at finalization time.
    if (value !== undefined) spinner.text = value

    // Use cached capabilities if we were spinning, otherwise re-detect.
    const activeCapabilities = state === SPINNING && capabilities ? capabilities : getCapabilities()

    // Transition to the appropriate terminal state (SUCCEEDED, FAILED, etc.).
    state = STATUS[action][0]
    capabilities = undefined

    // Stop the animation timer.
    clearTimer()

    // Build the final output line: status symbol + text + newline.
    const output = `${renderStatus(action, activeCapabilities)}\n`
    const [, animationEnabled] = activeCapabilities

    if (animationEnabled) {
      // In animated mode: clear the spinner line first, then print status, then show cursor.
      if (tryWrite(CLEAR_LINE)) tryWrite(output)
      tryWrite(SHOW_CURSOR)
      return
    }
    // In static mode: just print the status line (no cursor manipulation needed).
    tryWrite(output)
  }

  /**
   * Called every 80ms by the animation interval.
   *
   * Each tick:
   *   1. Clears the current line (CLEAR_LINE).
   *   2. Advances the frame counter.
   *   3. Writes the new frame.
   *
   * If any write fails, the cycle is aborted and the cursor is restored.
   */
  function tick(activeCapabilities: Capabilities): void {
    if (!tryWrite(CLEAR_LINE)) {
      abortCycle(true)
      return
    }
    frameIndex += 1
    if (!tryWrite(renderFrame(activeCapabilities))) abortCycle(true)
  }

  /**
   * Build the string for an animation frame: "prefix ⠋ text suffix"
   *
   * The frame character is colored according to `spinner.color`.
   */
  function renderFrame(activeCapabilities: Capabilities): string {
    const [colorEnabled, , unicodeEnabled] = activeCapabilities
    const frame = selectFrame(spinnerName, unicodeEnabled, frameIndex)
    return render(colorize(spinner.color, frame, colorEnabled))
  }

  /**
   * Build the string for a terminal status line: "prefix ✔ text suffix"
   *
   * The status symbol is colored according to the STATUS table.
   */
  function renderStatus(action: TerminalAction, activeCapabilities: Capabilities): string {
    const [colorEnabled, , unicodeEnabled] = activeCapabilities
    const [symbol, color] = selectStatus(action, unicodeEnabled)
    return render(colorize(color, symbol, colorEnabled))
  }

  /**
   * Assemble the final display string from its four segments.
   *
   * Layout: "prefix symbol text suffix"
   *
   * Each segment is sanitized to strip ANSI codes, control characters,
   * and directional overrides. Empty segments are filtered out, and the
   * remaining parts are joined with single spaces.
   */
  function render(symbol: string): string {
    return [
      sanitizeSegment(spinner.prefix),
      symbol,
      sanitizeSegment(spinner.text),
      sanitizeSegment(spinner.suffix),
    ]
      .filter(Boolean) // Remove empty strings so we don't get double spaces
      .join(' ')
  }

  /**
   * Attempt to write a string to stderr.
   *
   * Returns true on success, false if an error is thrown.
   * Catching errors here prevents unhandled exceptions from crashing the
   * host process if stderr becomes unavailable (e.g. broken pipe).
   */
  function tryWrite(value: string): boolean {
    try {
      stderr.write(value)
      return true
    } catch {
      return false
    }
  }

  /**
   * Cancel the animation interval timer, if one is running.
   * Sets the timer reference to undefined to avoid double-clearing.
   */
  function clearTimer(): void {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  /**
   * Emergency stop: cancel the timer, reset state to STOPPED, and
   * optionally restore the cursor.
   *
   * Called when a write to stderr fails mid-animation. We can't continue
   * rendering, so we clean up as much as possible.
   *
   * @param restoreCursor - If true, attempt to show the cursor (it was
   *                        hidden at start). False in non-animated mode
   *                        where the cursor was never hidden.
   */
  function abortCycle(restoreCursor: boolean): void {
    clearTimer()
    capabilities = undefined
    state = STOPPED
    if (restoreCursor) tryWrite(SHOW_CURSOR)
  }

  return spinner
}
