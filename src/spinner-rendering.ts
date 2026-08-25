import { applyAnsiStyle } from './ansi.js'
import type { Capabilities } from './env.js'
import type { SpinnerColor } from './index.js'
import type { StaticMode } from './spinner-options.js'
import { selectFrame, selectStatus, type FrameSet, type TerminalAction } from './spinner-data.js'
import { sanitizeSegment, terminalTextWidth } from './text.js'

interface RenderSnapshot {
  readonly prefix: string
  readonly text: string
  readonly suffix: string
  readonly fieldCount: number
  readonly fieldWidth: number
}

export interface SpinnerPresentation {
  text: string
  color: SpinnerColor
  prefix: string
  suffix: string
  readonly indent: string
  readonly frameSet: FrameSet
  snapshot: RenderSnapshot | undefined
}

export function createSpinnerPresentation(
  text: string,
  color: SpinnerColor,
  prefix: string,
  suffix: string,
  indent: string,
  frameSet: FrameSet,
): SpinnerPresentation {
  return { text, color, prefix, suffix, indent, frameSet, snapshot: undefined }
}

export function invalidateSpinnerText(presentation: SpinnerPresentation): void {
  presentation.snapshot = undefined
}

export function renderSpinnerFrame(
  presentation: SpinnerPresentation,
  capabilities: Capabilities,
  frameIndex: number,
): string {
  const symbol = selectFrame(presentation.frameSet, capabilities.unicode, frameIndex)
  const marker = capabilities.color ? applyAnsiStyle(presentation.color, symbol) : symbol
  return renderWithSymbol(presentation, marker)
}

export function renderSpinnerFrameWidth(
  presentation: SpinnerPresentation,
  capabilities: Capabilities,
  frameIndex: number,
): number {
  const symbol = selectFrame(presentation.frameSet, capabilities.unicode, frameIndex)
  const snapshot = getRenderSnapshot(presentation)
  return (
    presentation.indent.length +
    snapshot.fieldWidth +
    terminalTextWidth(symbol) +
    snapshot.fieldCount
  )
}

export function renderSpinnerStatus(
  presentation: SpinnerPresentation,
  action: TerminalAction,
  capabilities: Capabilities,
): string {
  const [symbol, color] = selectStatus(action, capabilities.unicode)
  const marker = capabilities.color ? applyAnsiStyle(color, symbol) : symbol
  return renderWithSymbol(presentation, marker)
}

export function renderSpinnerStaticStart(
  presentation: SpinnerPresentation,
  capabilities: Capabilities,
  frameIndex: number,
  staticMode: StaticMode,
): string | undefined {
  if (staticMode === 'silent') return undefined
  return staticMode === 'text'
    ? renderSpinnerText(presentation)
    : renderSpinnerFrame(presentation, capabilities, frameIndex)
}

export function renderSpinnerStaticTerminal(
  presentation: SpinnerPresentation,
  action: TerminalAction,
  capabilities: Capabilities,
  staticMode: StaticMode,
): string | undefined {
  if (staticMode === 'silent') return undefined
  return staticMode === 'text'
    ? renderSpinnerText(presentation)
    : renderSpinnerStatus(presentation, action, capabilities)
}

function renderWithSymbol(presentation: SpinnerPresentation, symbol: string): string {
  const snapshot = getRenderSnapshot(presentation)
  return indentRow(
    [snapshot.prefix, symbol, snapshot.text, snapshot.suffix].filter(Boolean).join(' '),
    presentation.indent,
  )
}

function renderSpinnerText(presentation: SpinnerPresentation): string {
  const snapshot = getRenderSnapshot(presentation)
  return indentRow(
    [snapshot.prefix, snapshot.text, snapshot.suffix].filter(Boolean).join(' '),
    presentation.indent,
  )
}

function indentRow(value: string, indent: string): string {
  return value ? `${indent}${value}` : value
}

function getRenderSnapshot(presentation: SpinnerPresentation): RenderSnapshot {
  if (presentation.snapshot !== undefined) return presentation.snapshot
  const prefix = sanitizeSegment(presentation.prefix)
  const text = sanitizeSegment(presentation.text)
  const suffix = sanitizeSegment(presentation.suffix)
  const fields = [prefix, text, suffix].filter(Boolean)
  presentation.snapshot = {
    prefix,
    text,
    suffix,
    fieldCount: fields.length,
    fieldWidth: fields.reduce((width, field) => width + terminalTextWidth(field), 0),
  }
  return presentation.snapshot
}
