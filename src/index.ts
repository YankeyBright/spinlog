/// <reference lib="esnext.disposable" />

import type { Writable } from 'node:stream'

import { intro, outro } from './messages.js'
import { createGroup } from './group.js'
import { createProgress } from './progress.js'
import { flushTarget } from './renderer.js'
import { createSpinner } from './spinner.js'
import { requireOptions } from './spinner-options.js'
import { requireString, resolveRenderTarget } from './text.js'

/** Built-in spinner animation names. */
export type SpinnerName = 'dots' | 'line'

/** Caller-provided animation data, copied and validated before rendering begins. */
export interface SpinnerDefinition {
  readonly frames: readonly string[]
  readonly interval?: number
}

/** ANSI-16 foreground colors available to spinner frames. */
export type SpinnerColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright'

/** Controls whether built-in Unicode glyphs may be used for one render target. */
export type UnicodeMode = 'auto' | boolean

/** Shared output policy for an explicit writable render target. */
export interface RenderOptions {
  /** Destination for this surface. Defaults to `process.stderr`. */
  stream?: Writable
  /** Disable all automatic ANSI color, or select the spinner frame color. */
  color?: SpinnerColor | false
  /** Select built-in Unicode glyphs automatically or explicitly. */
  unicode?: UnicodeMode
  /** Hide the cursor while this surface owns an interactive lease. Defaults to `true`. */
  hideCursor?: boolean
  /** Leading spaces added to every line written by this surface. */
  indent?: number
  /** Static fallback policy when interactive rendering is unavailable. */
  static?: 'symbol' | 'text' | 'silent'
  /** Terminal rendering policy. */
  terminal?: 'auto' | 'static' | 'interactive'
}

/** Options used to create a spinner. */
export interface SpinnerOptions extends RenderOptions {
  prefix?: string
  suffix?: string
  spinner?: SpinnerName | SpinnerDefinition
}

/** Rendering policy shared by every child of a task group. */
export interface GroupOptions extends RenderOptions {
  /** Maximum interactive group rows. Defaults to the safe target row budget, capped at 10. */
  maxRows?: number
}

/** Options used by a determinate progress indicator. */
export interface ProgressOptions extends Omit<SpinnerOptions, 'spinner'> {
  total: number
  value?: number
  /** Number of visible progress cells, from 5 through 40. Defaults to 20. */
  width?: number
  /** Built-in bar appearance. `blocks` falls back to ASCII when Unicode is unavailable. */
  style?: 'blocks' | 'ascii'
}

/** Text used when a promise-backed spinner settles, optionally derived from its result. */
export type PromiseSettlementText<T> = string | ((value: T) => string)

/** Options used by the `Spinlog.promise` overloads. */
export interface PromiseOptions<T = unknown> extends SpinnerOptions {
  text?: string
  /** Text rendered after fulfillment, optionally derived from the fulfillment value. */
  successText?: PromiseSettlementText<T>
  /** Text rendered after rejection, optionally derived from the rejection reason. */
  failText?: PromiseSettlementText<unknown>
}

/** Options used by `intro()` and `outro()`. */
export interface FlowOptions
  extends Pick<RenderOptions, 'stream' | 'color' | 'unicode' | 'indent'> {}

/** Options used by `spinlog.flush()` to await output on one target. */
export interface FlushOptions extends Pick<RenderOptions, 'stream'> {}

/** A mutable spinner with idempotent lifecycle methods. */
export interface Spinner {
  text: string
  color: SpinnerColor
  prefix: string
  suffix: string
  /** Starts a new rendering cycle or returns the active instance unchanged. */
  start(): this
  /** Stops an active cycle and restores owned terminal state. */
  stop(): this
  /** Writes a permanent sanitized line to this spinner's target without changing lifecycle state. */
  log(message: string): this
  /** Resolves once already-accepted permanent output on this target has drained. */
  flush(): Promise<void>
  /** Releases terminal state when a `using` declaration leaves scope. */
  [Symbol.dispose](): void
  /** Persists the first successful terminal result for the current cycle. */
  succeed(text?: string): this
  /** Persists the first failed terminal result for the current cycle. */
  fail(text?: string): this
  /** Persists the first warning terminal result for the current cycle. */
  warn(text?: string): this
  /** Persists the first informational terminal result for the current cycle. */
  info(text?: string): this
}

/** A target-local task surface whose child spinners share one terminal lease. */
export interface SpinnerGroup {
  /** Creates an idle child that follows the group's target and rendering policy. */
  add(
    text?: string,
    options?: Omit<
      SpinnerOptions,
      'color' | 'hideCursor' | 'indent' | 'static' | 'stream' | 'terminal' | 'unicode'
    > & { color?: SpinnerColor },
  ): Spinner
  /** Stops every active child and restores terminal state owned by the group. */
  stop(): this
  /** Resolves once already-accepted permanent output on this target has drained. */
  flush(): Promise<void>
  /** Releases terminal state when a `using` declaration leaves scope. */
  [Symbol.dispose](): void
}

/** A determinate progress indicator with the standard spinner lifecycle. */
export interface Progress
  extends Omit<Spinner, 'start' | 'stop' | 'succeed' | 'fail' | 'warn' | 'info' | 'log'> {
  readonly total: number
  value: number
  start(): this
  stop(): this
  log(message: string): this
  /** Resolves once already-accepted permanent output on this target has drained. */
  flush(): Promise<void>
  succeed(text?: string): this
  fail(text?: string): this
  warn(text?: string): this
  info(text?: string): this
  /** Replaces the completed amount without changing lifecycle state. */
  update(value: number): this
  /** Adds a positive completed amount without changing lifecycle state. */
  increment(amount?: number): this
}

/** Callable spinner factory with promise and flow-message integration. */
export interface Spinlog {
  (text?: string, options?: SpinnerOptions): Spinner
  promise<T>(input: PromiseLike<T>, options?: PromiseOptions<T>): Promise<T>
  promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions<T>): Promise<T>
  intro(message?: string, options?: FlowOptions): void
  outro(message?: string, options?: FlowOptions): void
  flush(options?: FlushOptions): Promise<void>
  group(options?: GroupOptions): SpinnerGroup
  progress(text: string, options: ProgressOptions): Progress
}

export {
  bgBlack,
  bgBlackBright,
  bgBlue,
  bgBlueBright,
  bgCyan,
  bgCyanBright,
  bgGreen,
  bgGreenBright,
  bgMagenta,
  bgMagentaBright,
  bgRed,
  bgRedBright,
  bgWhite,
  bgWhiteBright,
  bgYellow,
  bgYellowBright,
  black,
  blackBright,
  blue,
  blueBright,
  bold,
  cyan,
  cyanBright,
  dim,
  green,
  greenBright,
  italic,
  magenta,
  magentaBright,
  red,
  redBright,
  reset,
  strikethrough,
  underline,
  white,
  whiteBright,
  yellow,
  yellowBright,
} from './styles.js'

const factory = (text = '', options: SpinnerOptions = {}): Spinner => createSpinner(text, options)
const group: Spinlog['group'] = (options = {}) => createGroup(options)
const progress: Spinlog['progress'] = (text, options) => createProgress(text, options)
const flush: Spinlog['flush'] = (options = {}) => {
  const safeOptions = requireOptions(options)
  return flushTarget(resolveRenderTarget(safeOptions.stream))
}

const promise: Spinlog['promise'] = async <T>(
  input: PromiseLike<T> | (() => PromiseLike<T>),
  options: PromiseOptions<T> = {},
) => {
  const safeOptions = requireOptions(options)
  const successText = requirePromiseSettlementText<T>(safeOptions.successText, 'successText')
  const failText = requirePromiseSettlementText<unknown>(safeOptions.failText, 'failText')
  const spinner = factory(safeOptions.text, safeOptions).start()
  try {
    const value = await normalizePromiseInput(input)
    spinner.succeed(resolvePromiseSettlementText(successText, value, 'successText'))
    return value
  } catch (error) {
    spinner.fail(resolvePromiseSettlementText(failText, error, 'failText'))
    throw error
  }
}

function normalizePromiseInput<T>(input: PromiseLike<T> | (() => PromiseLike<T>)): Promise<T> {
  if (typeof input !== 'function') return requirePromiseLike<T>(input)

  // A callable thenable is direct input, not a task. Read `then` once before
  // deciding whether to invoke an ordinary function.
  const then = (input as { then?: unknown }).then
  if (typeof then === 'function') return requirePromiseLike<T>(input, then)
  return requirePromiseLike<T>(input())
}

function requirePromiseLike<T>(candidate: unknown, observedThen?: unknown): Promise<T> {
  if (candidate === null || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    throw new TypeError('input must be a PromiseLike or a task returning one')
  }

  // Read `then` once after the spinner starts, then assimilate it with the original receiver.
  const then = observedThen ?? (candidate as { then?: unknown }).then
  if (typeof then !== 'function') {
    throw new TypeError('input must be a PromiseLike or a task returning one')
  }

  // Let the native Promise resolution procedure schedule thenable invocation.
  // The wrapper keeps the validated `then` and its original receiver intact.
  return Promise.resolve({
    // Node's Promise resolution assimilates this thenable asynchronously with its original receiver.
    // biome-ignore lint/suspicious/noThenProperty: Promise resolution requires this deliberate thenable.
    then /* NOSONAR: Deliberate thenable required for Promise assimilation. */(resolve, reject) {
      Reflect.apply(then, candidate, [resolve, reject])
    },
  })
}

function requirePromiseSettlementText<T>(
  value: unknown,
  field: string,
): PromiseSettlementText<T> | undefined {
  if (value === undefined || typeof value === 'string' || typeof value === 'function') {
    return value as PromiseSettlementText<T> | undefined
  }
  throw new TypeError(`${field} must be a string or function`)
}

function resolvePromiseSettlementText<T>(
  configured: PromiseSettlementText<T> | undefined,
  value: T,
  field: string,
): string | undefined {
  if (configured === undefined) return undefined
  try {
    return requireString(typeof configured === 'function' ? configured(value) : configured, field)
  } catch {
    // A cosmetic callback must never replace the task's fulfillment or rejection.
    return undefined
  }
}

const spinlog: Spinlog = /* @__PURE__ */ Object.assign(factory, {
  promise,
  intro,
  outro,
  flush,
  group,
  progress,
})

export default spinlog
