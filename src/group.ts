import { type Capabilities, getCapabilities } from './env.js'
import {
  GROUP_FAILED,
  GROUP_INFORMED,
  GROUP_SPINNING,
  GROUP_STOPPED,
  GROUP_SUCCEEDED,
  GROUP_WARNED,
  createGroupItem,
  isGroupSpinning,
  renderGroupFrame,
  renderGroupStaticLine,
  renderGroupStaticStart,
  renderGroupStaticTerminal,
  renderGroupStatus,
  renderGroupWidth,
  type GroupChildOptions,
  type GroupItem,
  type GroupState,
} from './group-rendering.js'
import { createGroupScheduler } from './group-scheduler.js'
import { createGroupSession } from './group-session.js'
import type { GroupOptions, Spinner, SpinnerGroup } from './index.js'
import {
  acquireInteractiveLease,
  clearActiveFrame,
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
import { DEFAULT_SPINNER_COLOR, hasAnimatedFrames, type TerminalAction } from './spinner-data.js'
import { CLEAR_LINE, HIDE_CURSOR, SHOW_CURSOR } from './terminal-control.js'
import {
  fitsSingleTerminalWidth,
  requireString,
  resolveRenderTarget,
  sanitizeSegment,
} from './text.js'

type RenderMode = 'interactive' | 'static' | undefined

/** Create a multi-row task surface with one shared interactive terminal lease. */
export function createGroup(options: GroupOptions = {}): SpinnerGroup {
  const safeOptions = requireOptions(options)
  const target = resolveRenderTarget(safeOptions.stream)
  const staticMode = requireStaticMode(safeOptions.static ?? 'symbol')
  const terminalMode = requireTerminalMode(safeOptions.terminal ?? 'auto')
  const configuredColor = requireColorOption(safeOptions.color, DEFAULT_SPINNER_COLOR)
  const automaticColor = configuredColor !== false
  const unicodeMode = requireUnicodeMode(safeOptions.unicode ?? 'auto')
  const hideCursor = requireHideCursor(safeOptions.hideCursor ?? true)
  const indent = ' '.repeat(requireIndent(safeOptions.indent ?? 0))
  const configuredMaxRows =
    safeOptions.maxRows === undefined ? undefined : requireMaxRows(safeOptions.maxRows)
  const defaultColor = configuredColor === false ? DEFAULT_SPINNER_COLOR : configuredColor
  const items: GroupItem[] = []
  const session = createGroupSession(items)
  const scheduler = createGroupScheduler(() => session.activeItems(), redraw)
  let capabilities: Capabilities | undefined
  let mode: RenderMode
  /** Rows in the last frame accepted by the target; these are safe to clear. */
  let renderedRows = 0
  /** Rows requested by the most recent frame construction, possibly still queued. */
  let requestedRows = 0

  const lease: InteractiveLease = {
    currentFrame: renderCurrentFrame,
    clearFrame: clearRows,
    prepareFrame: prepareInteractiveFrame,
    didWriteFrame: commitInteractiveFrame,
    stopAfterRenderFailure: () => abortInteractive(),
  }

  const group: SpinnerGroup = {
    add(text = '', itemOptions = {}) {
      return createItem(text, itemOptions)
    },
    stop() {
      const active = session.activeItems()
      if (active.length === 0) return this

      for (const item of active) {
        item.state = GROUP_STOPPED
        item.session = undefined
      }
      if (mode === 'interactive') {
        const rows = renderRows(capabilities as Capabilities)
        closeInteractive(rows.length === 0 ? '' : `${rows.join('\n')}\n`)
      } else {
        closeStaticSession()
      }
      return this
    },
    flush() {
      return flushTarget(target)
    },
    [Symbol.dispose]() {
      this.stop()
    },
  }
  Object.defineProperty(group, Symbol.dispose, { enumerable: false })

  function createItem(text: string, options: GroupChildOptions): Spinner {
    const item = createGroupItem(text, options, defaultColor)
    const spinner: Spinner = {
      get text() {
        return item.text
      },
      set text(value) {
        item.text = requireString(value, 'text')
        item.snapshot = undefined
        redrawAfterMutation()
      },
      get color() {
        return item.color
      },
      set color(value) {
        item.color = requireColor(value)
        redrawAfterMutation()
      },
      get prefix() {
        return item.prefix
      },
      set prefix(value) {
        item.prefix = requireString(value, 'prefix')
        item.snapshot = undefined
        redrawAfterMutation()
      },
      get suffix() {
        return item.suffix
      },
      set suffix(value) {
        item.suffix = requireString(value, 'suffix')
        item.snapshot = undefined
        redrawAfterMutation()
      },
      start() {
        startItem(item)
        return this
      },
      stop() {
        stopItem(item)
        return this
      },
      log(message) {
        writeGroupLine(`${indent}${sanitizeSegment(requireString(message, 'message'))}\n`)
        return this
      },
      flush() {
        return flushTarget(target)
      },
      [Symbol.dispose]() {
        this.stop()
      },
      succeed(value) {
        settleItem(item, 0, value)
        return this
      },
      fail(value) {
        settleItem(item, 1, value)
        return this
      },
      warn(value) {
        settleItem(item, 2, value)
        return this
      },
      info(value) {
        settleItem(item, 3, value)
        return this
      },
    }
    Object.defineProperty(spinner, Symbol.dispose, { enumerable: false })
    items.push(item)
    return spinner
  }

  function startItem(item: GroupItem): void {
    if (item.state === GROUP_SPINNING) return
    // Joining creates a fresh session identity when the previous group has
    // finished, preventing old terminal rows from being redrawn by new items.
    session.join(item)
    item.state = GROUP_SPINNING
    item.terminalAction = undefined
    item.frameIndex = 0
    item.elapsedMs = 0

    if (mode === 'static') {
      writeStaticStart(item, resolveCapabilities())
      return
    }

    const active = capabilities ?? resolveCapabilities()
    if (!canAnimate(active)) {
      if (mode === 'interactive') demoteToStatic(active)
      else {
        mode = 'static'
        writeStaticStart(item, active)
      }
      return
    }

    capabilities = active
    if (mode === 'interactive') {
      if (redraw()) scheduler.arm()
      return
    }
    if (!acquireInteractiveLease(target, lease)) {
      mode = 'static'
      writeStaticStart(item, active)
      return
    }

    mode = 'interactive'
    if (writeInitialFrame()) scheduler.arm()
  }

  function stopItem(item: GroupItem): void {
    if (item.state >= GROUP_STOPPED) return
    item.state = GROUP_STOPPED
    item.session = undefined
    if (mode === 'interactive') {
      if (hasVisibleRows()) redrawOrFinish()
      else closeInteractive('')
      return
    }
    closeStaticSessionIfFinished()
  }

  function settleItem(item: GroupItem, action: TerminalAction, value: string | undefined): void {
    const nextText = value === undefined ? undefined : requireString(value, 'text')
    if (item.state >= GROUP_SUCCEEDED) return
    if (nextText !== undefined) {
      item.text = nextText
      item.snapshot = undefined
    }
    const previous = item.state
    // A completed row stays visible for the current session; only an item that
    // was never active leaves the session immediately.
    item.state = [GROUP_SUCCEEDED, GROUP_FAILED, GROUP_WARNED, GROUP_INFORMED][action] as GroupState
    item.terminalAction = action
    if (previous !== GROUP_SPINNING) item.session = undefined
    const active = capabilities ?? resolveCapabilities()

    if (mode === 'interactive' && previous === GROUP_SPINNING && session.owns(item)) {
      redrawOrFinish()
      return
    }
    if (mode === 'static') {
      writeStaticTerminal(item, active)
      closeStaticSessionIfFinished()
      return
    }
    writeGroupLine(`${renderGroupStatus(item, active, indent)}\n`)
  }

  function redrawAfterMutation(): void {
    if (mode === 'interactive') redraw()
  }

  function canAnimate(active: Capabilities): boolean {
    const visible = session.visibleItems()
    return (
      active.animation &&
      fitsGroupHeight(visible.length) &&
      visible.every(
        (item) => !isGroupSpinning(item) || hasAnimatedFrames(item.frameSet, active.unicode),
      ) &&
      visible.every((item) =>
        fitsSingleTerminalWidth(target, renderGroupWidth(item, active, indent.length)),
      )
    )
  }

  function redrawOrFinish(): void {
    if (session.activeItems().length === 0)
      closeInteractive(`${renderRows(capabilities as Capabilities).join('\n')}\n`)
    else if (redraw()) scheduler.arm()
  }

  function redraw(): boolean {
    return (
      writeInteractiveFrame(
        target,
        lease,
        `${clearActiveFrame(target, lease)}${lease.currentFrame()}`,
      ) && mode === 'interactive'
    )
  }

  function writeInitialFrame(): boolean {
    return (
      writeInteractiveFrame(target, lease, `${cursorHide()}${lease.currentFrame()}`) &&
      mode === 'interactive'
    )
  }

  /**
   * Check geometry immediately before every owned frame. The renderer repeats
   * this check before it flushes a queued frame after `drain`, so an old frame
   * cannot be replayed after a resize.
   */
  function prepareInteractiveFrame(): boolean {
    const active = resolveCapabilities()
    if (!canAnimate(active)) {
      demoteToStatic(active)
      return false
    }

    capabilities = active
    return true
  }

  /** Record only a frame the renderer has accepted, never a coalesced request. */
  function commitInteractiveFrame(): void {
    if (mode === 'interactive') renderedRows = requestedRows
  }

  /** The renderer preflights any active surface before rebuilding its frame. */
  function writeGroupLine(value: string): boolean {
    return writeCoordinatedLine(target, value)
  }

  function demoteToStatic(active: Capabilities): void {
    scheduler.clear()
    releaseInteractiveLease(target, lease)
    mode = 'static'
    capabilities = undefined
    const output = session
      .visibleItems()
      .map((item) => renderGroupStaticLine(item, active, staticMode, indent))
      .join('')
    if (!writeTarget(target, `${clearRows()}${cursorShow()}${output}`)) abortInteractive()
    renderedRows = 0
    requestedRows = 0
  }

  function closeInteractive(output: string): void {
    scheduler.clear()
    releaseInteractiveLease(target, lease)
    mode = undefined
    capabilities = undefined
    if (!writeTarget(target, `${clearRows()}${output}${cursorShow()}`) && hideCursor)
      writeTarget(target, SHOW_CURSOR)
    renderedRows = 0
    requestedRows = 0
    session.reset()
  }

  function abortInteractive(): void {
    scheduler.clear()
    for (const item of session.activeItems()) {
      item.state = GROUP_STOPPED
      item.session = undefined
    }
    releaseInteractiveLease(target, lease)
    mode = undefined
    capabilities = undefined
    renderedRows = 0
    requestedRows = 0
    session.reset()
    if (hideCursor) writeTarget(target, SHOW_CURSOR)
  }

  function hasVisibleRows(): boolean {
    return session.visibleItems().length > 0
  }

  function renderCurrentFrame(): string {
    const rows = renderRows(capabilities as Capabilities)
    requestedRows = rows.length
    return rows.join('\n')
  }

  function renderRows(active: Capabilities): string[] {
    return session
      .visibleItems()
      .map((item) =>
        isGroupSpinning(item)
          ? renderGroupFrame(item, active, indent)
          : renderGroupStatus(item, active, indent),
      )
  }

  function writeStaticStart(item: GroupItem, active: Capabilities): void {
    const line = renderGroupStaticStart(item, active, staticMode, indent)
    if (line !== undefined && !writeCoordinatedLine(target, `${line}\n`)) abortStaticSession()
  }

  function writeStaticTerminal(item: GroupItem, active: Capabilities): void {
    const line = renderGroupStaticTerminal(item, active, staticMode, indent)
    if (line !== undefined && !writeCoordinatedLine(target, `${line}\n`)) abortStaticSession()
  }

  function closeStaticSessionIfFinished(): void {
    if (session.activeItems().length === 0) closeStaticSession()
  }

  function closeStaticSession(): void {
    scheduler.clear()
    mode = undefined
    capabilities = undefined
    session.reset()
    renderedRows = 0
    requestedRows = 0
  }

  function abortStaticSession(): void {
    scheduler.clear()
    for (const item of session.activeItems()) {
      item.state = GROUP_STOPPED
      item.session = undefined
    }
    mode = undefined
    capabilities = undefined
    session.reset()
    renderedRows = 0
    requestedRows = 0
  }

  function resolveCapabilities(): Capabilities {
    const resolved = getCapabilities(target, terminalMode, unicodeMode)
    return automaticColor ? resolved : { ...resolved, color: false }
  }

  function fitsGroupHeight(rowCount: number): boolean {
    const rows = target.rows
    const maxRows = configuredMaxRows ?? defaultMaxRows(rows)
    return rows !== undefined && rowCount <= maxRows && rowCount < rows
  }

  function cursorHide(): string {
    return hideCursor ? HIDE_CURSOR : ''
  }

  function cursorShow(): string {
    return hideCursor ? SHOW_CURSOR : ''
  }

  function clearRows(): string {
    // Clear only rows confirmed by didWriteFrame. requestedRows may describe a
    // frame still queued and must never cause us to erase unrelated output.
    let output = CLEAR_LINE
    for (let index = 1; index < renderedRows; index += 1) output += `\x1b[1A${CLEAR_LINE}`
    return output
  }

  return group
}

function requireMaxRows(value: unknown): number {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value <= 0) {
    throw new TypeError('maxRows must be a positive safe integer')
  }
  return value
}

function defaultMaxRows(rows: number | undefined): number {
  return rows === undefined ? 0 : Math.min(10, rows - 1)
}
