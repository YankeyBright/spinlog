import { applyAnsiStyle, type AnsiStyle } from './ansi.js'
import { getCapabilities } from './env.js'

/** A side-effect-free style transformation that follows stderr color capability. */
export type Style = (text: string) => string

function applyStyle(format: AnsiStyle, text: string): string {
  if (typeof text !== 'string') throw new TypeError('text must be a string')
  const [colorEnabled] = getCapabilities()
  return colorEnabled ? applyAnsiStyle(format, text) : text
}

export const reset: Style = (text) => applyStyle('reset', text)
export const bold: Style = (text) => applyStyle('bold', text)
export const dim: Style = (text) => applyStyle('dim', text)
export const italic: Style = (text) => applyStyle('italic', text)
export const underline: Style = (text) => applyStyle('underline', text)
export const strikethrough: Style = (text) => applyStyle('strikethrough', text)
export const black: Style = (text) => applyStyle('black', text)
export const red: Style = (text) => applyStyle('red', text)
export const green: Style = (text) => applyStyle('green', text)
export const yellow: Style = (text) => applyStyle('yellow', text)
export const blue: Style = (text) => applyStyle('blue', text)
export const magenta: Style = (text) => applyStyle('magenta', text)
export const cyan: Style = (text) => applyStyle('cyan', text)
export const white: Style = (text) => applyStyle('white', text)
export const blackBright: Style = (text) => applyStyle('blackBright', text)
export const redBright: Style = (text) => applyStyle('redBright', text)
export const greenBright: Style = (text) => applyStyle('greenBright', text)
export const yellowBright: Style = (text) => applyStyle('yellowBright', text)
export const blueBright: Style = (text) => applyStyle('blueBright', text)
export const magentaBright: Style = (text) => applyStyle('magentaBright', text)
export const cyanBright: Style = (text) => applyStyle('cyanBright', text)
export const whiteBright: Style = (text) => applyStyle('whiteBright', text)
export const bgBlack: Style = (text) => applyStyle('bgBlack', text)
export const bgRed: Style = (text) => applyStyle('bgRed', text)
export const bgGreen: Style = (text) => applyStyle('bgGreen', text)
export const bgYellow: Style = (text) => applyStyle('bgYellow', text)
export const bgBlue: Style = (text) => applyStyle('bgBlue', text)
export const bgMagenta: Style = (text) => applyStyle('bgMagenta', text)
export const bgCyan: Style = (text) => applyStyle('bgCyan', text)
export const bgWhite: Style = (text) => applyStyle('bgWhite', text)
export const bgBlackBright: Style = (text) => applyStyle('bgBlackBright', text)
export const bgRedBright: Style = (text) => applyStyle('bgRedBright', text)
export const bgGreenBright: Style = (text) => applyStyle('bgGreenBright', text)
export const bgYellowBright: Style = (text) => applyStyle('bgYellowBright', text)
export const bgBlueBright: Style = (text) => applyStyle('bgBlueBright', text)
export const bgMagentaBright: Style = (text) => applyStyle('bgMagentaBright', text)
export const bgCyanBright: Style = (text) => applyStyle('bgCyanBright', text)
export const bgWhiteBright: Style = (text) => applyStyle('bgWhiteBright', text)
