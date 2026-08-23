import { stderr } from 'node:process'
import { stripVTControlCharacters } from 'node:util'

const UNSAFE_TEXT = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]+/g
const ASCII_MAX_CODE_POINT = 0x7f

/** Validate a public text field without coercing caller input. */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  return value
}

/** Remove terminal controls only when text crosses the rendering boundary. */
export function sanitizeSegment(value: string): string {
  return stripVTControlCharacters(value).replace(UNSAFE_TEXT, ' ').trim()
}

/** Reserve a conservative terminal-cell budget so animated frames never wrap. */
export function fitsSingleTerminalLine(value: string): boolean {
  return fitsSingleTerminalWidth(terminalTextWidth(value))
}

/** Check an already measured frame against the current conservative line budget. */
export function fitsSingleTerminalWidth(width: number): boolean {
  const columns = stderr.columns
  return (
    Number.isSafeInteger(columns) &&
    columns >= 3 &&
    Number.isSafeInteger(width) &&
    width >= 0 &&
    width < columns - 1
  )
}

/** Measure text with the frozen conservative Unicode-cell policy. */
export function terminalTextWidth(value: string): number {
  let width = 0
  for (const character of value) width += terminalCellWidth(character)
  return width
}

/** Assign a conservative terminal-cell width to one Unicode code point. */
export function terminalCellWidth(character: string): 0 | 1 | 2 {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) return 0
  return codePoint <= ASCII_MAX_CODE_POINT ? 1 : 2
}

/** Contain synchronous cosmetic write failures and ignore backpressure. */
export function tryWrite(value: string): boolean {
  try {
    stderr.write(value)
    return true
  } catch {
    return false
  }
}
