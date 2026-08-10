type Style = (text: string) => string

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
}

/** Options used by {@link Spinlog.promise}. */
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
  /** Persists the first successful terminal result for the current cycle. */
  succeed(text?: string): this
  /** Persists the first failed terminal result for the current cycle. */
  fail(text?: string): this
  /** Persists the first warning terminal result for the current cycle. */
  warn(text?: string): this
  /** Persists the first informational terminal result for the current cycle. */
  info(text?: string): this
}

/** Callable spinner factory with promise-settlement integration. */
export interface Spinlog {
  (text?: string, options?: SpinnerOptions): Spinner
  promise<T>(input: PromiseLike<T>, options?: PromiseOptions): Promise<T>
  promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions): Promise<T>
}

export declare const reset: Style
export declare const bold: Style
export declare const dim: Style
export declare const italic: Style
export declare const underline: Style
export declare const strikethrough: Style

export declare const black: Style
export declare const red: Style
export declare const green: Style
export declare const yellow: Style
export declare const blue: Style
export declare const magenta: Style
export declare const cyan: Style
export declare const white: Style
export declare const blackBright: Style
export declare const redBright: Style
export declare const greenBright: Style
export declare const yellowBright: Style
export declare const blueBright: Style
export declare const magentaBright: Style
export declare const cyanBright: Style
export declare const whiteBright: Style

export declare const bgBlack: Style
export declare const bgRed: Style
export declare const bgGreen: Style
export declare const bgYellow: Style
export declare const bgBlue: Style
export declare const bgMagenta: Style
export declare const bgCyan: Style
export declare const bgWhite: Style
export declare const bgBlackBright: Style
export declare const bgRedBright: Style
export declare const bgGreenBright: Style
export declare const bgYellowBright: Style
export declare const bgBlueBright: Style
export declare const bgMagentaBright: Style
export declare const bgCyanBright: Style
export declare const bgWhiteBright: Style

declare const spinlog: Spinlog

export default spinlog
