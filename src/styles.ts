import {
  bgBlackBrightDefinition,
  bgBlackDefinition,
  bgBlueBrightDefinition,
  bgBlueDefinition,
  bgCyanBrightDefinition,
  bgCyanDefinition,
  bgGreenBrightDefinition,
  bgGreenDefinition,
  bgMagentaBrightDefinition,
  bgMagentaDefinition,
  bgRedBrightDefinition,
  bgRedDefinition,
  bgWhiteBrightDefinition,
  bgWhiteDefinition,
  bgYellowBrightDefinition,
  bgYellowDefinition,
  blackBrightDefinition,
  blackDefinition,
  blueBrightDefinition,
  blueDefinition,
  boldDefinition,
  cyanBrightDefinition,
  cyanDefinition,
  dimDefinition,
  EMPHASIS,
  greenBrightDefinition,
  greenDefinition,
  italicDefinition,
  magentaBrightDefinition,
  magentaDefinition,
  redBrightDefinition,
  redDefinition,
  resetDefinition,
  strikethroughDefinition,
  type StyleDefinition,
  underlineDefinition,
  whiteBrightDefinition,
  whiteDefinition,
  yellowBrightDefinition,
  yellowDefinition,
} from './ansi-metadata.js'
import { applyAnsiDefinition } from './ansi-apply.js'
import { getStyleCapabilities } from './env.js'

/** A side-effect-free style transformation that follows stderr capabilities. */
export type Style = (text: string) => string

function applyStyle(definition: StyleDefinition, text: string): string {
  if (typeof text !== 'string') throw new TypeError('text must be a string')
  const capabilities = getStyleCapabilities()
  const enabled = definition.kind !== EMPHASIS ? capabilities & 1 : capabilities & 2
  return enabled ? applyAnsiDefinition(definition, text) : text
}

export const reset: Style = (text) => applyStyle(resetDefinition, text)
export const bold: Style = (text) => applyStyle(boldDefinition, text)
export const dim: Style = (text) => applyStyle(dimDefinition, text)
export const italic: Style = (text) => applyStyle(italicDefinition, text)
export const underline: Style = (text) => applyStyle(underlineDefinition, text)
export const strikethrough: Style = (text) => applyStyle(strikethroughDefinition, text)
export const black: Style = (text) => applyStyle(blackDefinition, text)
export const red: Style = (text) => applyStyle(redDefinition, text)
export const green: Style = (text) => applyStyle(greenDefinition, text)
export const yellow: Style = (text) => applyStyle(yellowDefinition, text)
export const blue: Style = (text) => applyStyle(blueDefinition, text)
export const magenta: Style = (text) => applyStyle(magentaDefinition, text)
export const cyan: Style = (text) => applyStyle(cyanDefinition, text)
export const white: Style = (text) => applyStyle(whiteDefinition, text)
export const blackBright: Style = (text) => applyStyle(blackBrightDefinition, text)
export const redBright: Style = (text) => applyStyle(redBrightDefinition, text)
export const greenBright: Style = (text) => applyStyle(greenBrightDefinition, text)
export const yellowBright: Style = (text) => applyStyle(yellowBrightDefinition, text)
export const blueBright: Style = (text) => applyStyle(blueBrightDefinition, text)
export const magentaBright: Style = (text) => applyStyle(magentaBrightDefinition, text)
export const cyanBright: Style = (text) => applyStyle(cyanBrightDefinition, text)
export const whiteBright: Style = (text) => applyStyle(whiteBrightDefinition, text)
export const bgBlack: Style = (text) => applyStyle(bgBlackDefinition, text)
export const bgRed: Style = (text) => applyStyle(bgRedDefinition, text)
export const bgGreen: Style = (text) => applyStyle(bgGreenDefinition, text)
export const bgYellow: Style = (text) => applyStyle(bgYellowDefinition, text)
export const bgBlue: Style = (text) => applyStyle(bgBlueDefinition, text)
export const bgMagenta: Style = (text) => applyStyle(bgMagentaDefinition, text)
export const bgCyan: Style = (text) => applyStyle(bgCyanDefinition, text)
export const bgWhite: Style = (text) => applyStyle(bgWhiteDefinition, text)
export const bgBlackBright: Style = (text) => applyStyle(bgBlackBrightDefinition, text)
export const bgRedBright: Style = (text) => applyStyle(bgRedBrightDefinition, text)
export const bgGreenBright: Style = (text) => applyStyle(bgGreenBrightDefinition, text)
export const bgYellowBright: Style = (text) => applyStyle(bgYellowBrightDefinition, text)
export const bgBlueBright: Style = (text) => applyStyle(bgBlueBrightDefinition, text)
export const bgMagentaBright: Style = (text) => applyStyle(bgMagentaBrightDefinition, text)
export const bgCyanBright: Style = (text) => applyStyle(bgCyanBrightDefinition, text)
export const bgWhiteBright: Style = (text) => applyStyle(bgWhiteBrightDefinition, text)
