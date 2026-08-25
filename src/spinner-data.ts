import type { SpinnerColor, SpinnerDefinition, SpinnerName } from './index.js'
import { requireString, sanitizeSegment, terminalTextWidth } from './text.js'

export type TerminalAction = 0 | 1 | 2 | 3

export interface FrameSet {
  readonly frames: readonly string[]
  readonly interval: number
  readonly unicodeFallback: boolean
}

type Status = readonly [unicode: string, ascii: string, color: SpinnerColor]

/** Canonical defaults for the built-in spinner catalogue. */
export const DEFAULT_INTERVAL = 80
export const DEFAULT_SPINNER_COLOR: SpinnerColor = 'cyan'
const MAX_FRAMES = 64
const MIN_INTERVAL = 16
const MAX_INTERVAL = 60_000
const DOTS_FRAMES = Object.freeze([
  '\u280b',
  '\u2819',
  '\u2839',
  '\u2838',
  '\u283c',
  '\u2834',
  '\u2826',
  '\u2827',
  '\u2807',
  '\u280f',
])
const LINE_FRAMES = Object.freeze(['-', '\\', '|', '/'])
const STATUS = Object.freeze([
  Object.freeze(['\u2714', '+', 'green'] as const),
  Object.freeze(['\u2716', 'x', 'red'] as const),
  Object.freeze(['\u26a0', '!', 'yellow'] as const),
  Object.freeze(['\u2139', 'i', 'blue'] as const),
]) satisfies readonly Status[]
const BUILT_IN_FRAME_SETS = Object.freeze({
  dots: Object.freeze({ frames: DOTS_FRAMES, interval: DEFAULT_INTERVAL, unicodeFallback: true }),
  line: Object.freeze({ frames: LINE_FRAMES, interval: DEFAULT_INTERVAL, unicodeFallback: false }),
}) satisfies Readonly<Record<SpinnerName, FrameSet>>

/** Validate and snapshot animation data before a spinner can render. */
export function createFrameSet(value: SpinnerName | SpinnerDefinition | undefined): FrameSet {
  if (value === undefined || value === 'dots') return BUILT_IN_FRAME_SETS.dots
  if (value === 'line') return BUILT_IN_FRAME_SETS.line
  if (typeof value === 'string') throw new TypeError("spinner must be 'dots' or 'line'")
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError("spinner must be 'dots', 'line', or a spinner definition")
  }

  const { frames, interval } = value
  if (!Array.isArray(frames) || frames.length === 0 || frames.length > MAX_FRAMES) {
    throw new TypeError(`spinner.frames must contain between 1 and ${MAX_FRAMES} strings`)
  }

  const snapshot = frames.map((frame, index) => {
    const validated = requireString(frame, `spinner.frames[${index}]`)
    const rendered = sanitizeSegment(validated)
    if (!rendered || terminalTextWidth(rendered) === 0) {
      throw new TypeError(`spinner.frames[${index}] must contain visible text`)
    }
    return rendered
  })
  const safeInterval = interval === undefined ? DEFAULT_INTERVAL : requireInterval(interval)

  return Object.freeze({
    frames: Object.freeze(snapshot),
    interval: safeInterval,
    unicodeFallback: false,
  })
}

/** Select a built-in frame without duplicating the built-in catalogue. */
export function selectBuiltinFrame(spinner: SpinnerName, unicode: boolean, index: number): string {
  return selectFrame(BUILT_IN_FRAME_SETS[spinner], unicode, index)
}

/** Select a frame without exposing mutable animation state. */
export function selectFrame(set: FrameSet, unicode: boolean, index: number): string {
  const frames = set.unicodeFallback && !unicode ? LINE_FRAMES : set.frames
  const frame = frames[index % frames.length]
  if (frame === undefined) throw new TypeError('spinner frame set must not be empty')
  return frame
}

/** Resolve the fixed terminal symbol and its foreground color. */
export function selectStatus(
  action: TerminalAction,
  unicode: boolean,
): readonly [string, SpinnerColor] {
  const status = STATUS[action]
  if (status === undefined) throw new TypeError('unknown terminal action')
  return [unicode ? status[0] : status[1], status[2]]
}

export function hasAnimatedFrames(set: FrameSet, unicode: boolean): boolean {
  return (set.unicodeFallback && !unicode ? LINE_FRAMES : set.frames).length > 1
}

function requireInterval(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < MIN_INTERVAL ||
    value > MAX_INTERVAL
  ) {
    throw new TypeError(
      `spinner.interval must be an integer between ${MIN_INTERVAL} and ${MAX_INTERVAL}`,
    )
  }
  return value
}
