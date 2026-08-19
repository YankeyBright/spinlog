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
  intro(message?: string): void
  outro(message?: string): void
}

export declare const reset: (text: string) => string
export declare const bold: (text: string) => string
export declare const dim: (text: string) => string
export declare const italic: (text: string) => string
export declare const underline: (text: string) => string
export declare const strikethrough: (text: string) => string

export declare const black: (text: string) => string
export declare const red: (text: string) => string
export declare const green: (text: string) => string
export declare const yellow: (text: string) => string
export declare const blue: (text: string) => string
export declare const magenta: (text: string) => string
export declare const cyan: (text: string) => string
export declare const white: (text: string) => string
export declare const blackBright: (text: string) => string
export declare const redBright: (text: string) => string
export declare const greenBright: (text: string) => string
export declare const yellowBright: (text: string) => string
export declare const blueBright: (text: string) => string
export declare const magentaBright: (text: string) => string
export declare const cyanBright: (text: string) => string
export declare const whiteBright: (text: string) => string

export declare const bgBlack: (text: string) => string
export declare const bgRed: (text: string) => string
export declare const bgGreen: (text: string) => string
export declare const bgYellow: (text: string) => string
export declare const bgBlue: (text: string) => string
export declare const bgMagenta: (text: string) => string
export declare const bgCyan: (text: string) => string
export declare const bgWhite: (text: string) => string
export declare const bgBlackBright: (text: string) => string
export declare const bgRedBright: (text: string) => string
export declare const bgGreenBright: (text: string) => string
export declare const bgYellowBright: (text: string) => string
export declare const bgBlueBright: (text: string) => string
export declare const bgMagentaBright: (text: string) => string
export declare const bgCyanBright: (text: string) => string
export declare const bgWhiteBright: (text: string) => string

declare const spinlog: Spinlog

export default spinlog
