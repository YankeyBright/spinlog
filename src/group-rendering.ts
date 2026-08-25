import { applyAnsiStyle } from './ansi.js'
import type { Capabilities } from './env.js'
import type { SpinnerColor, SpinnerOptions } from './index.js'
import { requireColor, requireOptions, type StaticMode } from './spinner-options.js'
import {
  createFrameSet,
  selectFrame,
  selectStatus,
  type FrameSet,
  type TerminalAction,
} from './spinner-data.js'
import { requireString, sanitizeSegment, terminalTextWidth } from './text.js'

/** Child-only fields accepted by a group row. Surface policy stays group-owned. */
export type GroupChildOptions = Pick<SpinnerOptions, 'prefix' | 'suffix' | 'spinner'> & {
  color?: SpinnerColor
}

export const GROUP_IDLE = 0
export const GROUP_SPINNING = 1
export const GROUP_STOPPED = 2
export const GROUP_SUCCEEDED = 3
export const GROUP_FAILED = 4
export const GROUP_WARNED = 5
export const GROUP_INFORMED = 6

export type GroupState = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface GroupItem {
  readonly frameSet: FrameSet
  text: string
  color: SpinnerColor
  prefix: string
  suffix: string
  state: GroupState
  frameIndex: number
  elapsedMs: number
  terminalAction: TerminalAction | undefined
  /** Identity of the live group session that currently owns this row. */
  session: symbol | undefined
  snapshot: GroupSnapshot | undefined
}

interface GroupSnapshot {
  readonly prefix: string
  readonly text: string
  readonly suffix: string
  readonly fieldCount: number
  readonly fieldWidth: number
}

/** Validate child input before a group item becomes observable. */
export function createGroupItem(
  text: string,
  options: GroupChildOptions,
  defaultColor: SpinnerColor = 'cyan',
): GroupItem {
  const safe = requireOptions(options)
  return {
    frameSet: createFrameSet(safe.spinner),
    text: requireString(text, 'text'),
    color: requireColor(safe.color ?? defaultColor),
    prefix: requireString(safe.prefix ?? '', 'prefix'),
    suffix: requireString(safe.suffix ?? '', 'suffix'),
    state: GROUP_IDLE,
    frameIndex: 0,
    elapsedMs: 0,
    terminalAction: undefined,
    session: undefined,
    snapshot: undefined,
  }
}

export function isGroupSpinning(item: GroupItem): boolean {
  return item.state === GROUP_SPINNING
}

export function isGroupVisible(item: GroupItem): boolean {
  return item.state === GROUP_SPINNING || item.state >= GROUP_SUCCEEDED
}

export function renderGroupFrame(item: GroupItem, capabilities: Capabilities, indent = ''): string {
  const symbol = selectFrame(item.frameSet, capabilities.unicode, item.frameIndex)
  const styledSymbol = capabilities.color ? applyAnsiStyle(item.color, symbol) : symbol
  return renderGroupWithSymbol(item, styledSymbol, indent)
}

export function renderGroupStatus(
  item: GroupItem,
  capabilities: Capabilities,
  indent = '',
): string {
  const [symbol, color] = selectStatus(item.terminalAction as TerminalAction, capabilities.unicode)
  const styledSymbol = capabilities.color ? applyAnsiStyle(color, symbol) : symbol
  return renderGroupWithSymbol(item, styledSymbol, indent)
}

export function renderGroupStaticLine(
  item: GroupItem,
  capabilities: Capabilities,
  staticMode: StaticMode,
  indent = '',
): string {
  if (isGroupSpinning(item)) {
    const start = renderGroupStaticStart(item, capabilities, staticMode, indent)
    return start === undefined ? '' : `${start}\n`
  }
  return `${renderGroupStatus(item, capabilities, indent)}\n`
}

export function renderGroupStaticStart(
  item: GroupItem,
  capabilities: Capabilities,
  staticMode: StaticMode,
  indent = '',
): string | undefined {
  if (staticMode === 'silent') return undefined
  if (staticMode === 'text') return renderGroupText(item, indent)
  return renderGroupFrame(item, capabilities, indent)
}

export function renderGroupStaticTerminal(
  item: GroupItem,
  capabilities: Capabilities,
  staticMode: StaticMode,
  indent = '',
): string | undefined {
  if (staticMode === 'silent') return undefined
  if (staticMode === 'text') return renderGroupText(item, indent)
  return renderGroupStatus(item, capabilities, indent)
}

export function renderGroupText(item: GroupItem, indent = ''): string {
  const snapshot = getGroupSnapshot(item)
  return indentRow(
    [snapshot.prefix, snapshot.text, snapshot.suffix].filter(Boolean).join(' '),
    indent,
  )
}

export function renderGroupWidth(
  item: GroupItem,
  capabilities: Capabilities,
  indentWidth = 0,
): number {
  const symbol = selectUnstyledGroupSymbol(item, capabilities)
  const snapshot = getGroupSnapshot(item)
  return indentWidth + snapshot.fieldWidth + terminalTextWidth(symbol) + snapshot.fieldCount
}

function renderGroupWithSymbol(item: GroupItem, symbol: string, indent: string): string {
  const snapshot = getGroupSnapshot(item)
  return indentRow(
    [snapshot.prefix, symbol, snapshot.text, snapshot.suffix].filter(Boolean).join(' '),
    indent,
  )
}

function indentRow(value: string, indent: string): string {
  return value ? `${indent}${value}` : value
}

function selectUnstyledGroupSymbol(item: GroupItem, capabilities: Capabilities): string {
  if (isGroupSpinning(item)) {
    return selectFrame(item.frameSet, capabilities.unicode, item.frameIndex)
  }
  return selectStatus(item.terminalAction as TerminalAction, capabilities.unicode)[0]
}

function getGroupSnapshot(item: GroupItem): GroupSnapshot {
  if (item.snapshot !== undefined) return item.snapshot
  const prefix = sanitizeSegment(item.prefix)
  const text = sanitizeSegment(item.text)
  const suffix = sanitizeSegment(item.suffix)
  const fields = [prefix, text, suffix]
  const visible = fields.filter(Boolean)
  item.snapshot = {
    prefix,
    text,
    suffix,
    fieldCount: visible.length,
    fieldWidth: visible.reduce((width, field) => width + terminalTextWidth(field), 0),
  }
  return item.snapshot
}
