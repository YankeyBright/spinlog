/// <reference lib="esnext.disposable" />

import { intro, outro } from './messages.js'
import { createSpinner, requireOptions } from './spinner.js'
import * as styles from './styles.js'

/** Built-in spinner animation names. */
export type SpinnerName = 'dots' | 'line'

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

/** Options used to create a spinner. */
export interface SpinnerOptions {
  color?: SpinnerColor
  prefix?: string
  suffix?: string
  spinner?: SpinnerName
  static?: 'symbol' | 'text' | 'silent'
  terminal?: 'auto' | 'static' | 'interactive'
}

/** Options used by the `Spinlog.promise` overloads. */
export interface PromiseOptions extends SpinnerOptions {
  text?: string
}

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
  /** Writes a permanent sanitized stderr line without changing spinner lifecycle state. */
  log(message: string): this
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

/** Callable spinner factory with promise and flow-message integration. */
export interface Spinlog {
  (text?: string, options?: SpinnerOptions): Spinner
  promise<T>(input: PromiseLike<T>, options?: PromiseOptions): Promise<T>
  promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions): Promise<T>
  intro(message?: string): void
  outro(message?: string): void
}

export const reset: (text: string) => string = styles.reset
export const bold: (text: string) => string = styles.bold
export const dim: (text: string) => string = styles.dim
export const italic: (text: string) => string = styles.italic
export const underline: (text: string) => string = styles.underline
export const strikethrough: (text: string) => string = styles.strikethrough

export const black: (text: string) => string = styles.black
export const red: (text: string) => string = styles.red
export const green: (text: string) => string = styles.green
export const yellow: (text: string) => string = styles.yellow
export const blue: (text: string) => string = styles.blue
export const magenta: (text: string) => string = styles.magenta
export const cyan: (text: string) => string = styles.cyan
export const white: (text: string) => string = styles.white
export const blackBright: (text: string) => string = styles.blackBright
export const redBright: (text: string) => string = styles.redBright
export const greenBright: (text: string) => string = styles.greenBright
export const yellowBright: (text: string) => string = styles.yellowBright
export const blueBright: (text: string) => string = styles.blueBright
export const magentaBright: (text: string) => string = styles.magentaBright
export const cyanBright: (text: string) => string = styles.cyanBright
export const whiteBright: (text: string) => string = styles.whiteBright

export const bgBlack: (text: string) => string = styles.bgBlack
export const bgRed: (text: string) => string = styles.bgRed
export const bgGreen: (text: string) => string = styles.bgGreen
export const bgYellow: (text: string) => string = styles.bgYellow
export const bgBlue: (text: string) => string = styles.bgBlue
export const bgMagenta: (text: string) => string = styles.bgMagenta
export const bgCyan: (text: string) => string = styles.bgCyan
export const bgWhite: (text: string) => string = styles.bgWhite
export const bgBlackBright: (text: string) => string = styles.bgBlackBright
export const bgRedBright: (text: string) => string = styles.bgRedBright
export const bgGreenBright: (text: string) => string = styles.bgGreenBright
export const bgYellowBright: (text: string) => string = styles.bgYellowBright
export const bgBlueBright: (text: string) => string = styles.bgBlueBright
export const bgMagentaBright: (text: string) => string = styles.bgMagentaBright
export const bgCyanBright: (text: string) => string = styles.bgCyanBright
export const bgWhiteBright: (text: string) => string = styles.bgWhiteBright

const factory = (text = '', options: SpinnerOptions = {}): Spinner => createSpinner(text, options)

const promise: Spinlog['promise'] = async <T>(
  input: PromiseLike<T> | (() => PromiseLike<T>),
  options: PromiseOptions = {},
) => {
  const safeOptions = requireOptions(options)
  const spinner = factory(safeOptions.text, safeOptions).start()
  try {
    const value = await (typeof input === 'function' ? input() : input)
    spinner.succeed()
    return value
  } catch (error) {
    spinner.fail()
    throw error
  }
}

const spinlog: Spinlog = /* @__PURE__ */ Object.assign(factory, { promise, intro, outro })

export default spinlog
