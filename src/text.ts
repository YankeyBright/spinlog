import { stderr } from 'node:process'
import type { Writable } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'

const UNSAFE_TEXT = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]+/g
const COMBINING_MARK = /\p{Mark}/u
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u
const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** The writable surface used for one independent terminal rendering session. */
export interface RenderTarget {
  /** The Node writable that receives terminal bytes. */
  readonly stream: Writable
  /** Whether the target currently reports terminal semantics. */
  readonly isTTY: boolean
  /** The target's live terminal width when available. */
  readonly columns: number | undefined
  /** The target's live terminal height when available. */
  readonly rows: number | undefined
}

/** A contained synchronous write outcome, including Node backpressure. */
export type WriteResult =
  | Readonly<{ readonly status: 'written'; readonly accepted: true }>
  | Readonly<{ readonly status: 'backpressured'; readonly accepted: true }>
  | Readonly<{ readonly status: 'failed'; readonly accepted: false }>

/** Called by Node once one accepted write has been handled or failed. */
export type WriteCallback = (error?: Error | null) => void

interface TerminalWritable extends Writable {
  readonly columns?: number
  readonly isTTY?: boolean
  readonly rows?: number
}

const WRITTEN: WriteResult = Object.freeze({ status: 'written', accepted: true })
const BACKPRESSURED: WriteResult = Object.freeze({ status: 'backpressured', accepted: true })
const FAILED: WriteResult = Object.freeze({ status: 'failed', accepted: false })

/**
 * Resolve a writable render target without taking ownership of the stream.
 *
 * Capability properties deliberately remain live so width changes are observed by
 * an active renderer without installing stream listeners.
 */
export function resolveRenderTarget(stream: Writable = stderr): RenderTarget {
  if (stream === null || typeof stream !== 'object' || typeof stream.write !== 'function') {
    throw new TypeError('stream must be a Node writable stream')
  }

  const terminal = stream as TerminalWritable
  return Object.freeze({
    stream,
    get isTTY() {
      return terminal.isTTY === true
    },
    get columns() {
      const columns = terminal.columns
      return Number.isSafeInteger(columns) && (columns as number) > 0 ? columns : undefined
    },
    get rows() {
      const rows = terminal.rows
      return Number.isSafeInteger(rows) && (rows as number) > 0 ? rows : undefined
    },
  })
}

/** Validate a public text field without coercing caller input. */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  return value
}

/** Remove terminal controls only when text crosses the rendering boundary. */
export function sanitizeSegment(value: string): string {
  return stripVTControlCharacters(value).replace(UNSAFE_TEXT, ' ').trim()
}

/** Check an already measured frame against the current conservative line budget. */
export function fitsSingleTerminalWidth(target: RenderTarget, measuredWidth: number): boolean {
  const columns = target.columns
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(measuredWidth)) return false
  const safeColumns = columns as number
  const safeWidth = measuredWidth as number
  return safeColumns >= 3 && safeWidth >= 0 && safeWidth < safeColumns - 1
}

/** Measure text by terminal grapheme cells without splitting emoji or combining sequences. */
export function terminalTextWidth(value: string): number {
  let width = 0
  for (const { segment } of graphemeSegmenter.segment(value)) width += graphemeCellWidth(segment)
  return width
}

/** Assign a terminal-cell width to the first grapheme in a caller-supplied string. */
export function terminalCellWidth(character: string): 0 | 1 | 2 {
  const first = graphemeSegmenter.segment(character)[Symbol.iterator]().next()
  return first.done ? 0 : graphemeCellWidth(first.value.segment)
}

function graphemeCellWidth(grapheme: string): 0 | 1 | 2 {
  if (isEmojiCluster(grapheme)) return 2

  let visible = false
  for (const character of grapheme) {
    const codePoint = character.codePointAt(0) as number
    if (isZeroWidth(codePoint, character)) continue
    visible = true
    if (isFullWidth(codePoint)) return 2
  }
  return visible ? 1 : 0
}

function isEmojiCluster(grapheme: string): boolean {
  if (EXTENDED_PICTOGRAPHIC.test(grapheme) || grapheme.includes('\u20e3')) return true
  for (const character of grapheme) {
    const codePoint = character.codePointAt(0) as number
    if (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff) return true
  }
  return false
}

function isZeroWidth(codePoint: number, character: string): boolean {
  return (
    codePoint === 0x00ad ||
    codePoint === 0x034f ||
    codePoint === 0x061c ||
    codePoint === 0x200b ||
    codePoint === 0x200c ||
    codePoint === 0x200d ||
    codePoint === 0x2060 ||
    codePoint === 0xfeff ||
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef) ||
    COMBINING_MARK.test(character)
  )
}

/** Unicode ranges that occupy two cells in conventional wcwidth implementations. */
function isFullWidth(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1b000 && codePoint <= 0x1b001) ||
      (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  )
}

/**
 * Contain synchronous write failures and report Node backpressure.
 *
 * A `true` return means only that the stream can accept more data. Permanent
 * output supplies `onComplete` so its caller can separately await completion.
 */
export function writeToTarget(
  target: RenderTarget,
  value: string,
  onComplete?: WriteCallback,
): WriteResult {
  try {
    return target.stream.write(value, onComplete) === false ? BACKPRESSURED : WRITTEN
  } catch {
    return FAILED
  }
}
