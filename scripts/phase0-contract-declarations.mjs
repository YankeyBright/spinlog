import { SPINNER_COLORS } from './phase0-contract-catalog.mjs'

/** Deterministically project the public declaration from the behavior schema. */
export function renderPublicApiDeclaration(contract) {
  const colorUnion = SPINNER_COLORS.map((color) => `  | '${color}'`).join('\n')
  const styleSignature = '(text: string) => string'
  const styleDeclarations = contract.publicApi.styleExports
    .map((name) => `export declare const ${name}: ${styleSignature}`)
    .join('\n')

  return `/// <reference lib="esnext.disposable" />

import type { Writable } from 'node:stream'

/** Built-in spinner animation names. */
export type SpinnerName = 'dots' | 'line'

/** Caller-provided animation data, copied and validated before rendering begins. */
export interface SpinnerDefinition {
  readonly frames: readonly string[]
  readonly interval?: number
}

/** ANSI-16 foreground colors available to spinner frames. */
export type SpinnerColor =
${colorUnion}

/** Controls whether built-in Unicode glyphs may be used for one render target. */
export type UnicodeMode = 'auto' | boolean

/** Shared output policy for an explicit writable render target. */
export interface RenderOptions {
  /** Destination for this surface. Defaults to \`process.stderr\`. */
  stream?: Writable
  /** Disable all automatic ANSI color, or select the spinner frame color. */
  color?: SpinnerColor | false
  /** Select built-in Unicode glyphs automatically or explicitly. */
  unicode?: UnicodeMode
  /** Hide the cursor while this surface owns an interactive lease. Defaults to \`true\`. */
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
  /** Built-in bar appearance. \`blocks\` falls back to ASCII when Unicode is unavailable. */
  style?: 'blocks' | 'ascii'
}

/** Text used when a promise-backed spinner settles, optionally derived from its result. */
export type PromiseSettlementText<T> = string | ((value: T) => string)

/** Options used by the \`Spinlog.promise\` overloads. */
export interface PromiseOptions<T = unknown> extends SpinnerOptions {
  text?: string
  /** Text rendered after fulfillment, optionally derived from the fulfillment value. */
  successText?: PromiseSettlementText<T>
  /** Text rendered after rejection, optionally derived from the rejection reason. */
  failText?: PromiseSettlementText<unknown>
}

/** Options used by \`intro()\` and \`outro()\`. */
export interface FlowOptions
  extends Pick<RenderOptions, 'stream' | 'color' | 'unicode' | 'indent'> {}

/** Options used by \`spinlog.flush()\` to await output on one target. */
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
  /** Releases terminal state when a \`using\` declaration leaves scope. */
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
  /** Releases terminal state when a \`using\` declaration leaves scope. */
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

${styleDeclarations.replace(`export declare const black: ${styleSignature}`, `\nexport declare const black: ${styleSignature}`).replace(`export declare const bgBlack: ${styleSignature}`, `\nexport declare const bgBlack: ${styleSignature}`)}

declare const spinlog: Spinlog

export default spinlog
`
}

export function renderStylesApiDeclaration(contract) {
  const styleDeclarations = contract.publicApi.styleExports
    .map((name) => `export declare const ${name}: Style`)
    .join('\n')

  return `/** A side-effect-free style transformation that follows stderr color capability. */
export type Style = (text: string) => string

${styleDeclarations.replace('export declare const black: Style', '\nexport declare const black: Style').replace('export declare const bgBlack: Style', '\nexport declare const bgBlack: Style')}
`
}
