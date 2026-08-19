import { applyAnsiStyle } from './ansi.js'
import { type Capabilities, getCapabilities } from './env.js'
import type { Spinner, SpinnerColor, SpinnerName, SpinnerOptions } from './index.js'
import { requireString, sanitizeSegment, tryWrite } from './text.js'

const IDLE = 0
const SPINNING = 1
const STOPPED = 2
const SUCCEEDED = 3
const FAILED = 4
const WARNED = 5
const INFORMED = 6
type State = 0 | 1 | 2 | 3 | 4 | 5 | 6
type TerminalAction = 0 | 1 | 2 | 3
type Status = readonly [state: State, unicode: string, ascii: string, color: SpinnerColor]
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const CLEAR_LINE = '\x1b[2K\r'
const DOTS_FRAMES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const LINE_FRAMES = String.raw`-\|/`
const SPINNER_COLORS =
  'black red green yellow blue magenta cyan white blackBright redBright greenBright yellowBright blueBright magentaBright cyanBright whiteBright'.split(
    ' ',
  )
const STATUS = {
  0: [SUCCEEDED, '✔', '+', 'green'],
  1: [FAILED, '✖', 'x', 'red'],
  2: [WARNED, '⚠', '!', 'yellow'],
  3: [INFORMED, 'ℹ', 'i', 'blue'],
} as const satisfies Record<TerminalAction, Status>
function requireColor(value: unknown): SpinnerColor {
  if (typeof value !== 'string' || !SPINNER_COLORS.includes(value)) {
    throw new TypeError('color must be a built-in spinner color')
  }
  return value as SpinnerColor
}

function requireSpinnerName(value: unknown): SpinnerName {
  if (value !== 'dots' && value !== 'line') throw new TypeError("spinner must be 'dots' or 'line'")
  return value
}

export function requireOptions<T extends object>(value: T): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('options must be an object')
  }
  return value
}

function isTerminal(state: State): boolean {
  return state >= SUCCEEDED
}

export function selectFrame(spinner: SpinnerName, unicode: boolean, index: number): string {
  const frames = spinner === 'dots' && unicode ? DOTS_FRAMES : LINE_FRAMES
  return frames.charAt(index % frames.length)
}

export function selectStatus(
  action: TerminalAction,
  unicode: boolean,
): readonly [symbol: string, color: SpinnerColor] {
  const [, unicodeSymbol, asciiSymbol, color] = STATUS[action]
  return [unicode ? unicodeSymbol : asciiSymbol, color]
}

/** Create a mutable spinner with instance-owned rendering state. */
export function createSpinner(text = '', options: SpinnerOptions = {}): Spinner {
  const safeOptions = requireOptions(options)
  let state: State = IDLE
  let timer: NodeJS.Timeout | undefined
  let frameIndex = 0
  let capabilities: Capabilities | undefined
  let currentText = requireString(text, 'text')
  let currentColor = requireColor(safeOptions.color ?? 'cyan')
  let currentPrefix = requireString(safeOptions.prefix ?? '', 'prefix')
  let currentSuffix = requireString(safeOptions.suffix ?? '', 'suffix')
  const spinnerName = requireSpinnerName(safeOptions.spinner ?? 'dots')

  const spinner: Spinner = {
    get text() {
      return currentText
    },
    set text(value) {
      currentText = requireString(value, 'text')
    },
    get color() {
      return currentColor
    },
    set color(value) {
      currentColor = requireColor(value)
    },
    get prefix() {
      return currentPrefix
    },
    set prefix(value) {
      currentPrefix = requireString(value, 'prefix')
    },
    get suffix() {
      return currentSuffix
    },
    set suffix(value) {
      currentSuffix = requireString(value, 'suffix')
    },
    start() {
      if (state === SPINNING) return this

      state = SPINNING
      frameIndex = 0
      const activeCapabilities = getCapabilities()
      capabilities = activeCapabilities
      const [, animationEnabled] = activeCapabilities

      if (!animationEnabled) {
        if (!tryWrite(`${renderFrame(activeCapabilities)}\n`)) abortCycle(false)
        return this
      }
      if (!tryWrite(HIDE_CURSOR) || !tryWrite(renderFrame(activeCapabilities))) {
        abortCycle(true)
        return this
      }

      timer = setInterval(() => tick(activeCapabilities), 80)
      timer.unref()
      return this
    },
    stop() {
      if (isTerminal(state) || state === STOPPED) return this

      const wasSpinning = state === SPINNING
      const activeCapabilities = capabilities
      state = STOPPED
      capabilities = undefined
      if (!wasSpinning) return this

      clearTimer()
      if (activeCapabilities?.[1] === true) {
        tryWrite(CLEAR_LINE)
        tryWrite(SHOW_CURSOR)
      }
      return this
    },
    succeed(value) {
      terminal(0, value)
      return this
    },
    fail(value) {
      terminal(1, value)
      return this
    },
    warn(value) {
      terminal(2, value)
      return this
    },
    info(value) {
      terminal(3, value)
      return this
    },
  }

  function terminal(action: TerminalAction, value?: string): void {
    // Validation must precede terminal idempotency to preserve the input contract.
    const nextText = value === undefined ? undefined : requireString(value, 'text')
    if (isTerminal(state)) return
    if (nextText !== undefined) spinner.text = nextText

    const activeCapabilities = state === SPINNING && capabilities ? capabilities : getCapabilities()
    state = STATUS[action][0]
    capabilities = undefined
    clearTimer()

    const output = `${renderStatus(action, activeCapabilities)}\n`
    if (activeCapabilities[1]) {
      if (tryWrite(CLEAR_LINE)) tryWrite(output)
      tryWrite(SHOW_CURSOR)
    } else {
      tryWrite(output)
    }
  }

  function tick(activeCapabilities: Capabilities): void {
    if (!tryWrite(CLEAR_LINE)) {
      abortCycle(true)
      return
    }
    frameIndex += 1
    if (!tryWrite(renderFrame(activeCapabilities))) abortCycle(true)
  }

  function renderFrame(activeCapabilities: Capabilities): string {
    const [colorEnabled, , unicodeEnabled] = activeCapabilities
    return render(
      applyAnsiStyle(
        spinner.color,
        selectFrame(spinnerName, unicodeEnabled, frameIndex),
        colorEnabled,
      ),
    )
  }

  function renderStatus(action: TerminalAction, activeCapabilities: Capabilities): string {
    const [colorEnabled, , unicodeEnabled] = activeCapabilities
    const [symbol, color] = selectStatus(action, unicodeEnabled)
    return render(applyAnsiStyle(color, symbol, colorEnabled))
  }

  function render(symbol: string): string {
    return [
      sanitizeSegment(spinner.prefix),
      symbol,
      sanitizeSegment(spinner.text),
      sanitizeSegment(spinner.suffix),
    ]
      .filter(Boolean)
      .join(' ')
  }

  function clearTimer(): void {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function abortCycle(restoreCursor: boolean): void {
    clearTimer()
    capabilities = undefined
    state = STOPPED
    if (restoreCursor) tryWrite(SHOW_CURSOR)
  }

  return spinner
}
