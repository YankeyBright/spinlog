import { type Capabilities, getCapabilities } from './env.js'
import type { Spinner, SpinnerOptions } from './index.js'
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
import {
  createSpinnerPresentation,
  invalidateSpinnerText,
  renderSpinnerFrame,
  renderSpinnerFrameWidth,
  renderSpinnerStaticStart,
  renderSpinnerStaticTerminal,
  renderSpinnerStatus,
} from './spinner-rendering.js'
import {
  DEFAULT_SPINNER_COLOR,
  createFrameSet,
  hasAnimatedFrames,
  type TerminalAction,
} from './spinner-data.js'
import { CLEAR_LINE, HIDE_CURSOR, SHOW_CURSOR } from './terminal-control.js'
import {
  fitsSingleTerminalWidth,
  requireString,
  resolveRenderTarget,
  sanitizeSegment,
} from './text.js'

const IDLE = 0
const SPINNING = 1
const STOPPED = 2
const SUCCEEDED = 3
const FAILED = 4
const WARNED = 5
const INFORMED = 6
type State = 0 | 1 | 2 | 3 | 4 | 5 | 6
type RenderMode = 'interactive' | 'static' | undefined

// Compatibility exports for focused internal definition tests.
export { selectBuiltinFrame as selectFrame, selectStatus } from './spinner-data.js'

/** Create a mutable spinner with instance-owned rendering state. */
export function createSpinner(text = '', options: SpinnerOptions = {}): Spinner {
  const safeOptions = requireOptions(options)
  const target = resolveRenderTarget(safeOptions.stream)
  const configuredColor = requireColorOption(safeOptions.color, DEFAULT_SPINNER_COLOR)
  const automaticColor = configuredColor !== false
  const unicodeMode = requireUnicodeMode(safeOptions.unicode ?? 'auto')
  const hideCursor = requireHideCursor(safeOptions.hideCursor ?? true)
  const indent = ' '.repeat(requireIndent(safeOptions.indent ?? 0))
  const frameSet = createFrameSet(safeOptions.spinner)
  const staticMode = requireStaticMode(safeOptions.static ?? 'symbol')
  const terminalMode = requireTerminalMode(safeOptions.terminal ?? 'auto')
  const presentation = createSpinnerPresentation(
    requireString(text, 'text'),
    configuredColor === false ? DEFAULT_SPINNER_COLOR : configuredColor,
    requireString(safeOptions.prefix ?? '', 'prefix'),
    requireString(safeOptions.suffix ?? '', 'suffix'),
    indent,
    frameSet,
  )
  let state: State = IDLE
  let timer: NodeJS.Timeout | undefined
  let frameIndex = 0
  let capabilities: Capabilities | undefined
  let renderMode: RenderMode

  const spinner: Spinner = {
    get text() {
      return presentation.text
    },
    set text(value) {
      presentation.text = requireString(value, 'text')
      invalidateSpinnerText(presentation)
    },
    get color() {
      return presentation.color
    },
    set color(value) {
      presentation.color = requireColor(value)
    },
    get prefix() {
      return presentation.prefix
    },
    set prefix(value) {
      presentation.prefix = requireString(value, 'prefix')
      invalidateSpinnerText(presentation)
    },
    get suffix() {
      return presentation.suffix
    },
    set suffix(value) {
      presentation.suffix = requireString(value, 'suffix')
      invalidateSpinnerText(presentation)
    },
    start() {
      if (state === SPINNING) return this
      // Capabilities are captured per cycle. A later resize or terminal change
      // is handled by prepareInteractiveFrame before the next physical write.
      state = SPINNING
      frameIndex = 0
      const active = resolveCapabilities()
      capabilities = active
      const frame = renderSpinnerFrame(presentation, active, frameIndex)

      if (!canAnimate(active) || !acquireInteractiveLease(target, lease)) {
        startStatic(active)
        return this
      }
      renderMode = 'interactive'
      if (!writeInteractiveFrame(target, lease, `${cursorHide()}${frame}`)) return this
      timer = setInterval(() => tick(active), frameSet.interval)
      timer.unref()
      return this
    },
    stop() {
      if (state >= STOPPED) return this
      const previous = renderMode
      state = STOPPED
      capabilities = undefined
      clearTimer()
      renderMode = undefined
      if (previous === 'interactive') stopInteractive()
      return this
    },
    log(message) {
      const line = sanitizeSegment(requireString(message, 'message'))
      writeCoordinatedLine(target, `${indent}${line}\n`)
      return this
    },
    flush() {
      return flushTarget(target)
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
    prepareFrame: prepareInteractiveFrame,
    currentFrame: () => renderSpinnerFrame(presentation, capabilities as Capabilities, frameIndex),
    stopAfterRenderFailure: () => abortCycle(true),
  }

  function terminal(action: TerminalAction, value?: string): void {
    const nextText = value === undefined ? undefined : requireString(value, 'text')
    if (state >= SUCCEEDED) return
    if (nextText !== undefined) spinner.text = nextText

    const active = capabilities ?? resolveCapabilities()
    const previous = renderMode
    // Terminal methods are first-result-wins and release the lease before
    // writing the permanent status line so another surface can take ownership.
    state = terminalState(action)
    capabilities = undefined
    renderMode = undefined
    clearTimer()
    if (previous === 'interactive') {
      releaseInteractiveLease(target, lease)
      const output = `${renderSpinnerStatus(presentation, action, active)}\n`
      if (!writeTarget(target, `${CLEAR_LINE}${output}${cursorShow()}`))
        writeTarget(target, cursorShow())
    } else {
      const output = renderSpinnerStaticTerminal(presentation, action, active, staticMode)
      if (output !== undefined) writeCoordinatedLine(target, `${output}\n`)
    }
  }

  function tick(active: Capabilities): void {
    frameIndex += 1
    if (!prepareInteractiveFrame()) return
    writeInteractiveFrame(
      target,
      lease,
      `${CLEAR_LINE}${renderSpinnerFrame(presentation, active, frameIndex)}`,
    )
  }

  function prepareInteractiveFrame(): boolean {
    const active = capabilities as Capabilities
    if (canAnimate(active)) return true
    demoteToStatic(active)
    return false
  }

  function startStatic(active: Capabilities): void {
    renderMode = 'static'
    const output = renderSpinnerStaticStart(presentation, active, frameIndex, staticMode)
    if (output !== undefined && !writeCoordinatedLine(target, `${output}\n`)) abortCycle(false)
  }

  function stopInteractive(): void {
    releaseInteractiveLease(target, lease)
    if (!writeTarget(target, `${CLEAR_LINE}${cursorShow()}`) && hideCursor)
      writeTarget(target, SHOW_CURSOR)
  }

  function demoteToStatic(active: Capabilities): void {
    // A live target can lose width/cursor support. Demotion preserves the
    // current text and status while stopping future interactive writes.
    clearTimer()
    releaseInteractiveLease(target, lease)
    renderMode = 'static'
    const output = renderSpinnerStaticStart(presentation, active, frameIndex, staticMode)
    const staticLine = output === undefined ? '' : `${output}\n`
    if (!writeTarget(target, `${CLEAR_LINE}${cursorShow()}${staticLine}`)) abortCycle(true)
  }

  function canAnimate(active: Capabilities): boolean {
    return (
      active.animation &&
      hasAnimatedFrames(frameSet, active.unicode) &&
      fitsSingleTerminalWidth(target, renderSpinnerFrameWidth(presentation, active, frameIndex))
    )
  }

  function cursorHide(): string {
    return hideCursor ? HIDE_CURSOR : ''
  }

  function cursorShow(): string {
    return hideCursor ? SHOW_CURSOR : ''
  }

  function resolveCapabilities(): Capabilities {
    const resolved = getCapabilities(target, terminalMode, unicodeMode)
    return automaticColor ? resolved : { ...resolved, color: false }
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
    releaseInteractiveLease(target, lease)
    if (restoreCursor) writeTarget(target, cursorShow())
  }

  return spinner
}

function terminalState(action: TerminalAction): State {
  switch (action) {
    case 0:
      return SUCCEEDED
    case 1:
      return FAILED
    case 2:
      return WARNED
    case 3:
      return INFORMED
  }
}
