type Style = (text: string) => string

export type SpinnerName = 'dots' | 'line'

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

export interface SpinnerOptions {
  color?: SpinnerColor
  prefix?: string
  suffix?: string
  spinner?: SpinnerName
}

export interface PromiseOptions extends SpinnerOptions {
  text?: string
}

export interface Spinner {
  text: string
  color: SpinnerColor
  prefix: string
  suffix: string
  start(): this
  stop(): this
  succeed(text?: string): this
  fail(text?: string): this
  warn(text?: string): this
  info(text?: string): this
}

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
