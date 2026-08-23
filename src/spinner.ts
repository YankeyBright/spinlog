import { applyAnsiStyle, isSpinnerColor } from './ansi.js'
import { type Capabilities, getCapabilities, type TerminalMode } from './env.js'
import type { Spinner, SpinnerColor, SpinnerName, SpinnerOptions } from './index.js'
import {
  acquireInteractiveLease,
  releaseInteractiveLease,
  writeCoordinatedLine,
  writeInteractiveFrame,
  type InteractiveLease,
} from './renderer.js'
import {
  fitsSingleTerminalWidth,
  requireString,
  sanitizeSegment,
  terminalCellWidth,
  terminalTextWidth,
  tryWrite,
} from './text.js'

const IDLE = 0
const SPINNING = 1
const STOPPED = 2
const SUCCEEDED = 3
const FAILED = 4
const WARNED = 5
const INFORMED = 6
type State = 0 | 1 | 2 | 3 | 4 | 5 | 6
type TerminalAction = 0 | 1 | 2 | 3
type RenderMode = 'interactive' | 'static' | undefined
type StaticMode = 'symbol' | 'text' | 'silent'
type Status = readonly [state: State, unicode: string, ascii: string, color: SpinnerColor]
interface RenderSnapshot {
  readonly prefix: string
  readonly text: string
  readonly suffix: string
  readonly fieldCount: number
  readonly fieldWidth: number
}
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const CLEAR_LINE = '\x1b[2K\r'
const DOTS_FRAMES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const LINE_FRAMES = String.raw`-\|/`
const STATUS = {
  0: [SUCCEEDED, '✔', '+', 'green'],
  1: [FAILED, '✖', 'x', 'red'],
  2: [WARNED, '⚠', '!', 'yellow'],
  3: [INFORMED, 'ℹ', 'i', 'blue'],
} as const satisfies Record<TerminalAction, Status>
function requireColor(value: unknown): SpinnerColor {
  if (typeof value !== 'string' || !isSpinnerColor(value)) {
    throw new TypeError('color must be a built-in spinner color')
  }
  return value as SpinnerColor
}

function requireSpinnerName(value: unknown): SpinnerName {
  if (value !== 'dots' && value !== 'line') throw new TypeError("spinner must be 'dots' or 'line'")
  return value
}

function requireStaticMode(value: unknown): StaticMode {
  if (value !== 'symbol' && value !== 'text' && value !== 'silent') {
    throw new TypeError("static must be 'symbol', 'text', or 'silent'")
  }
  return value
}

function requireTerminalMode(value: unknown): TerminalMode {
  if (value !== 'auto' && value !== 'static' && value !== 'interactive') {
    throw new TypeError("terminal must be 'auto', 'static', or 'interactive'")
  }
  return value
}

export function requireOptions<T extends object>(value: T): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('options must be an object')
  }
  return value
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
  let renderMode: RenderMode
  let currentText = requireString(text, 'text')
  let currentColor = requireColor(safeOptions.color ?? 'cyan')
  let currentPrefix = requireString(safeOptions.prefix ?? '', 'prefix')
  let currentSuffix = requireString(safeOptions.suffix ?? '', 'suffix')
  let renderSnapshot: RenderSnapshot | undefined
  const spinnerName = requireSpinnerName(safeOptions.spinner ?? 'dots')
  const staticMode = requireStaticMode(safeOptions.static ?? 'symbol')
  const terminalMode = requireTerminalMode(safeOptions.terminal ?? 'auto')

  const spinner: Spinner = {
    get text() {
      return currentText
    },
    set text(value) {
      currentText = requireString(value, 'text')
      renderSnapshot = undefined
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
      renderSnapshot = undefined
    },
    get suffix() {
      return currentSuffix
    },
    set suffix(value) {
      currentSuffix = requireString(value, 'suffix')
      renderSnapshot = undefined
    },
    start() {
      if (state === SPINNING) return this

      state = SPINNING
      frameIndex = 0
      const activeCapabilities = getCapabilities(undefined, undefined, undefined, terminalMode)
      capabilities = activeCapabilities
      const frame = renderFrame(activeCapabilities)

      if (!canAnimate(activeCapabilities) || !acquireInteractiveLease(lease)) {
        startStatic(activeCapabilities)
        return this
      }

      renderMode = 'interactive'
      if (!writeInteractiveFrame(lease, `${HIDE_CURSOR}${frame}`)) return this

      timer = setInterval(() => tick(activeCapabilities), 80)
      timer.unref()
      return this
    },
    stop() {
      if (state >= STOPPED) return this

      const previousMode = renderMode
      state = STOPPED
      capabilities = undefined
      clearTimer()
      renderMode = undefined
      if (previousMode === 'interactive') stopInteractive()
      return this
    },
    log(message) {
      const line = sanitizeSegment(requireString(message, 'message'))
      writeCoordinatedLine(`${line}\n`)
      return this
    },
    [Symbol.dispose]() {
      this.stop()
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
  Object.defineProperty(spinner, Symbol.dispose, { enumerable: false })

  const lease: InteractiveLease = {
    // A lease is acquired only after this cycle captures terminal capabilities.
    currentFrame: () => renderFrame(capabilities as Capabilities),
    stopAfterRenderFailure: () => abortCycle(true),
  }

  function terminal(action: TerminalAction, value?: string): void {
    // Validation must precede terminal idempotency to preserve the input contract.
    const nextText = value === undefined ? undefined : requireString(value, 'text')
    if (state >= SUCCEEDED) return
    if (nextText !== undefined) spinner.text = nextText

    const activeCapabilities =
      capabilities ?? getCapabilities(undefined, undefined, undefined, terminalMode)
    const previousMode = renderMode
    state = STATUS[action][0]
    capabilities = undefined
    renderMode = undefined
    clearTimer()

    if (previousMode === 'interactive') {
      releaseInteractiveLease(lease)
      const output = `${renderStatus(action, activeCapabilities)}\n`
      if (!tryWrite(`${CLEAR_LINE}${output}${SHOW_CURSOR}`)) tryWrite(SHOW_CURSOR)
    } else {
      writeStaticTerminal(action, activeCapabilities)
    }
  }

  function tick(activeCapabilities: Capabilities): void {
    frameIndex += 1
    if (!canAnimate(activeCapabilities)) {
      demoteToStatic(activeCapabilities)
      return
    }
    writeInteractiveFrame(lease, `${CLEAR_LINE}${renderFrame(activeCapabilities)}`)
  }

  function startStatic(activeCapabilities: Capabilities): void {
    renderMode = 'static'
    const output = renderStaticStart(activeCapabilities)
    if (output !== undefined && !writeCoordinatedLine(output)) abortCycle(false)
  }

  function stopInteractive(): void {
    releaseInteractiveLease(lease)
    tryWrite(`${CLEAR_LINE}${SHOW_CURSOR}`)
  }

  function demoteToStatic(activeCapabilities: Capabilities): void {
    clearTimer()
    releaseInteractiveLease(lease)
    renderMode = 'static'
    const output = renderStaticStart(activeCapabilities)
    if (!tryWrite(`${CLEAR_LINE}${SHOW_CURSOR}${output ?? ''}`)) abortCycle(true)
  }

  function canAnimate(activeCapabilities: Capabilities): boolean {
    return (
      activeCapabilities.animation &&
      fitsSingleTerminalWidth(renderPlainFrameWidth(activeCapabilities))
    )
  }

  function renderFrame(activeCapabilities: Capabilities): string {
    const symbol = selectFrame(spinnerName, activeCapabilities.unicode, frameIndex)
    return renderWithSymbol(
      activeCapabilities.color ? applyAnsiStyle(spinner.color, symbol) : symbol,
    )
  }

  function renderPlainFrameWidth(activeCapabilities: Capabilities): number {
    const symbol = selectFrame(spinnerName, activeCapabilities.unicode, frameIndex)
    const snapshot = getRenderSnapshot()
    return snapshot.fieldWidth + terminalCellWidth(symbol) + snapshot.fieldCount
  }

  function renderStatus(action: TerminalAction, activeCapabilities: Capabilities): string {
    const [symbol, color] = selectStatus(action, activeCapabilities.unicode)
    return renderWithSymbol(activeCapabilities.color ? applyAnsiStyle(color, symbol) : symbol)
  }

  function renderStaticStart(activeCapabilities: Capabilities): string | undefined {
    if (staticMode === 'silent') return undefined
    return `${staticMode === 'text' ? renderText() : renderFrame(activeCapabilities)}\n`
  }

  function writeStaticTerminal(action: TerminalAction, activeCapabilities: Capabilities): void {
    if (staticMode === 'silent') return
    const output =
      staticMode === 'text' ? `${renderText()}\n` : `${renderStatus(action, activeCapabilities)}\n`
    writeCoordinatedLine(output)
  }

  function renderWithSymbol(symbol: string): string {
    const snapshot = getRenderSnapshot()
    return [snapshot.prefix, symbol, snapshot.text, snapshot.suffix].filter(Boolean).join(' ')
  }

  function renderText(): string {
    const snapshot = getRenderSnapshot()
    return [snapshot.prefix, snapshot.text, snapshot.suffix].filter(Boolean).join(' ')
  }

  /** Sanitize lazily at the render boundary, then reuse immutable data across frames. */
  function getRenderSnapshot(): RenderSnapshot {
    if (renderSnapshot !== undefined) return renderSnapshot

    const prefix = sanitizeSegment(currentPrefix)
    const text = sanitizeSegment(currentText)
    const suffix = sanitizeSegment(currentSuffix)
    const fields = [prefix, text, suffix].filter(Boolean)
    renderSnapshot = {
      prefix,
      text,
      suffix,
      fieldCount: fields.length,
      fieldWidth: fields.reduce((width, field) => width + terminalTextWidth(field), 0),
    }
    return renderSnapshot
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
    renderMode = undefined
    state = STOPPED
    releaseInteractiveLease(lease)
    if (restoreCursor) tryWrite(SHOW_CURSOR)
  }

  return spinner
}
