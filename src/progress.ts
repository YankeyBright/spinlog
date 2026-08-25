import { applyAnsiStyle } from './ansi.js'
import { type Capabilities, getCapabilities } from './env.js'
import type { Progress, ProgressOptions } from './index.js'
import {
  acquireInteractiveLease,
  flushTarget,
  releaseInteractiveLease,
  writeCoordinatedLine,
  writeInteractiveFrame,
  writeTarget,
  type InteractiveLease,
} from './renderer.js'
import {
  requireColor,
  requireColorOption,
  requireHideCursor,
  requireIndent,
  requireOptions,
  requireStaticMode,
  requireTerminalMode,
  requireUnicodeMode,
} from './spinner-options.js'
import { DEFAULT_SPINNER_COLOR, selectStatus, type TerminalAction } from './spinner-data.js'
import { CLEAR_LINE, HIDE_CURSOR, SHOW_CURSOR } from './terminal-control.js'
import {
  fitsSingleTerminalWidth,
  requireString,
  resolveRenderTarget,
  sanitizeSegment,
  terminalTextWidth,
} from './text.js'

const IDLE = 0
const ACTIVE = 1
const STOPPED = 2
const SUCCEEDED = 3
const FAILED = 4
const WARNED = 5
const INFORMED = 6
const DEFAULT_BAR_WIDTH = 20
const BLOCK_BAR = ['\u2588', '\u2591'] as const
const ASCII_BAR = ['#', '-'] as const
type State = 0 | 1 | 2 | 3 | 4 | 5 | 6
type RenderMode = 'interactive' | 'static' | undefined
type ProgressStyle = 'blocks' | 'ascii'

interface RenderSnapshot {
  readonly prefix: string
  readonly text: string
  readonly suffix: string
  readonly fieldCount: number
  readonly fieldWidth: number
}

/** Create a determinate, single-line progress indicator. */
export function createProgress(text: string, options: ProgressOptions): Progress {
  const safeOptions = requireOptions(options)
  const target = resolveRenderTarget(safeOptions.stream)
  const configuredColor = requireColorOption(safeOptions.color, DEFAULT_SPINNER_COLOR)
  const automaticColor = configuredColor !== false
  const unicodeMode = requireUnicodeMode(safeOptions.unicode ?? 'auto')
  const hideCursor = requireHideCursor(safeOptions.hideCursor ?? true)
  const indent = ' '.repeat(requireIndent(safeOptions.indent ?? 0))
  const total = requireTotal(safeOptions.total)
  let value = requireValue(safeOptions.value ?? 0, total, 'value')
  let state: State = IDLE
  let capabilities: Capabilities | undefined
  let mode: RenderMode
  let currentText = requireString(text, 'text')
  let currentColor = configuredColor === false ? DEFAULT_SPINNER_COLOR : configuredColor
  let currentPrefix = requireString(safeOptions.prefix ?? '', 'prefix')
  let currentSuffix = requireString(safeOptions.suffix ?? '', 'suffix')
  let renderSnapshot: RenderSnapshot | undefined
  const staticMode = requireStaticMode(safeOptions.static ?? 'symbol')
  const terminalMode = requireTerminalMode(safeOptions.terminal ?? 'auto')
  const barWidth = requireBarWidth(safeOptions.width ?? DEFAULT_BAR_WIDTH)
  const barStyle = requireProgressStyle(safeOptions.style ?? 'blocks')

  const progress: Progress = {
    get text() {
      return currentText
    },
    set text(next) {
      currentText = requireString(next, 'text')
      renderSnapshot = undefined
      redrawAfterMutation()
    },
    get color() {
      return currentColor
    },
    set color(next) {
      currentColor = requireColor(next)
      redrawAfterMutation()
    },
    get prefix() {
      return currentPrefix
    },
    set prefix(next) {
      currentPrefix = requireString(next, 'prefix')
      renderSnapshot = undefined
      redrawAfterMutation()
    },
    get suffix() {
      return currentSuffix
    },
    set suffix(next) {
      currentSuffix = requireString(next, 'suffix')
      renderSnapshot = undefined
      redrawAfterMutation()
    },
    get total() {
      return total
    },
    get value() {
      return value
    },
    set value(next) {
      update(next)
    },
    start() {
      if (state === ACTIVE) return this
      state = ACTIVE
      const active = resolveCapabilities()
      capabilities = active
      if (!canAnimate(active)) {
        startStatic(active)
        return this
      }
      if (!acquireInteractiveLease(target, lease)) {
        startStatic(active)
        return this
      }
      mode = 'interactive'
      writeInteractiveFrame(target, lease, `${cursorHideSequence()}${renderProgress(active)}`)
      return this
    },
    stop() {
      if (state >= STOPPED) return this
      const previous = mode
      state = STOPPED
      capabilities = undefined
      mode = undefined
      if (previous === 'interactive') {
        releaseInteractiveLease(target, lease)
        if (!writeTarget(target, `${CLEAR_LINE}${cursorShowSequence()}`) && hideCursor)
          writeTarget(target, SHOW_CURSOR)
      }
      return this
    },
    log(message) {
      writeCoordinatedLine(
        target,
        `${indent}${sanitizeSegment(requireString(message, 'message'))}\n`,
      )
      return this
    },
    flush() {
      return flushTarget(target)
    },
    [Symbol.dispose]() {
      this.stop()
    },
    succeed(next) {
      settle(0, next)
      return this
    },
    fail(next) {
      settle(1, next)
      return this
    },
    warn(next) {
      settle(2, next)
      return this
    },
    info(next) {
      settle(3, next)
      return this
    },
    update(next) {
      update(next)
      return this
    },
    increment(amount = 1) {
      update(value + requireAmount(amount))
      return this
    },
  }
  Object.defineProperty(progress, Symbol.dispose, { enumerable: false })

  const lease: InteractiveLease = {
    prepareFrame: prepareInteractiveFrame,
    currentFrame: () => renderProgress(capabilities as Capabilities),
    stopAfterRenderFailure: abort,
  }

  function update(next: unknown): void {
    value = requireValue(next, total, 'value')
    redrawAfterMutation()
  }

  function settle(action: TerminalAction, next: string | undefined): void {
    const textOverride = next === undefined ? undefined : requireString(next, 'text')
    if (state >= SUCCEEDED) return
    if (textOverride !== undefined) {
      currentText = textOverride
      renderSnapshot = undefined
    }
    if (action === 0) value = total
    const active = capabilities ?? resolveCapabilities()
    const previous = mode
    state = [SUCCEEDED, FAILED, WARNED, INFORMED][action] as State
    capabilities = undefined
    mode = undefined

    if (previous === 'interactive') {
      releaseInteractiveLease(target, lease)
      const output = `${renderStatus(action, active)}\n`
      if (!writeTarget(target, `${CLEAR_LINE}${output}${cursorShowSequence()}`))
        writeTarget(target, cursorShowSequence())
    } else {
      writeStaticTerminal(action, active)
    }
  }

  function redrawAfterMutation(): void {
    if (mode !== 'interactive') return
    const active = capabilities as Capabilities
    if (prepareInteractiveFrame()) {
      writeInteractiveFrame(target, lease, `${CLEAR_LINE}${renderProgress(active)}`)
    }
  }

  /** Recheck live target geometry before any renderer-owned frame is emitted. */
  function prepareInteractiveFrame(): boolean {
    const active = capabilities as Capabilities
    if (canAnimate(active)) return true
    demoteToStatic(active)
    return false
  }

  function canAnimate(active: Capabilities): boolean {
    return active.animation && fitsSingleTerminalWidth(target, renderProgressWidth(active))
  }

  function demoteToStatic(active: Capabilities): void {
    releaseInteractiveLease(target, lease)
    mode = 'static'
    capabilities = undefined
    const output = renderStaticStart(active)
    if (!writeTarget(target, `${CLEAR_LINE}${cursorShowSequence()}${output ?? ''}`)) abort()
  }

  function startStatic(active: Capabilities): void {
    mode = 'static'
    const output = renderStaticStart(active)
    if (output !== undefined && !writeCoordinatedLine(target, output)) abort()
  }

  function renderProgress(active: Capabilities, styled = true): string {
    const percent = Math.floor((value / total) * 100)
    const filled = Math.floor((value / total) * barWidth)
    const [complete, empty] = selectBarCharacters(active)
    const bar = `${complete.repeat(filled)}${empty.repeat(barWidth - filled)}`
    const marker = styled && active.color ? applyAnsiStyle(currentColor, bar) : bar
    const snapshot = getRenderSnapshot()
    return indentRow(
      [snapshot.prefix, `[${marker}]`, `${percent}%`, snapshot.text, snapshot.suffix]
        .filter(Boolean)
        .join(' '),
    )
  }

  function renderText(): string {
    const percent = Math.floor((value / total) * 100)
    const snapshot = getRenderSnapshot()
    return [`${percent}%`, snapshot.prefix, snapshot.text, snapshot.suffix]
      .filter(Boolean)
      .join(' ')
  }

  function renderStatus(action: TerminalAction, active: Capabilities): string {
    const [symbol, color] = selectStatus(action, active.unicode)
    const marker = active.color ? applyAnsiStyle(color, symbol) : symbol
    const snapshot = getRenderSnapshot()
    return indentRow(
      [
        snapshot.prefix,
        marker,
        `${Math.floor((value / total) * 100)}%`,
        snapshot.text,
        snapshot.suffix,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  function renderStaticStart(active: Capabilities): string | undefined {
    if (staticMode === 'silent') return undefined
    return `${staticMode === 'text' ? indentRow(renderText()) : renderProgress(active)}\n`
  }

  function writeStaticTerminal(action: TerminalAction, active: Capabilities): void {
    if (staticMode !== 'silent') {
      writeCoordinatedLine(
        target,
        `${staticMode === 'text' ? indentRow(renderText()) : renderStatus(action, active)}\n`,
      )
    }
  }

  function indentRow(value: string): string {
    return `${indent}${value}`
  }

  function cursorHideSequence(): string {
    return hideCursor ? HIDE_CURSOR : ''
  }

  function cursorShowSequence(): string {
    return hideCursor ? SHOW_CURSOR : ''
  }

  function resolveCapabilities(): Capabilities {
    const resolved = getCapabilities(target, terminalMode, unicodeMode)
    return automaticColor ? resolved : { ...resolved, color: false }
  }

  /** Sanitize lazily at the render boundary and reuse immutable text measurements. */
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

  function selectBarCharacters(active: Capabilities): readonly [complete: string, empty: string] {
    return barStyle === 'blocks' && active.unicode ? BLOCK_BAR : ASCII_BAR
  }

  function renderProgressWidth(active: Capabilities): number {
    const percent = Math.floor((value / total) * 100)
    const filled = Math.floor((value / total) * barWidth)
    const [complete, empty] = selectBarCharacters(active)
    const snapshot = getRenderSnapshot()
    const renderedBarWidth =
      terminalTextWidth(complete) * filled + terminalTextWidth(empty) * (barWidth - filled) + 2

    // The bar and percentage always render; every visible caller field adds one separator.
    return (
      indent.length +
      snapshot.fieldWidth +
      renderedBarWidth +
      `${percent}%`.length +
      snapshot.fieldCount +
      1
    )
  }

  function abort(): void {
    capabilities = undefined
    mode = undefined
    state = STOPPED
    releaseInteractiveLease(target, lease)
    writeTarget(target, cursorShowSequence())
  }

  return progress
}

function requireTotal(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('total must be a positive safe integer')
  }
  return value
}

function requireValue(value: unknown, total: number, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > total) {
    throw new TypeError(`${field} must be an integer between 0 and total`)
  }
  return value
}

function requireAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('amount must be a positive safe integer')
  }
  return value
}

function requireBarWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 5 || value > 40) {
    throw new TypeError('width must be an integer between 5 and 40')
  }
  return value
}

function requireProgressStyle(value: unknown): ProgressStyle {
  if (value !== 'blocks' && value !== 'ascii') {
    throw new TypeError("style must be 'blocks' or 'ascii'")
  }
  return value
}
