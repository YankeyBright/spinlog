import { stderr } from 'node:process'
import { stripVTControlCharacters } from 'node:util'

const UNSAFE_TEXT = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]+/g

/** Validate a public text field without coercing caller input. */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  return value
}

/** Remove terminal controls only when text crosses the rendering boundary. */
export function sanitizeSegment(value: string): string {
  return stripVTControlCharacters(value).replace(UNSAFE_TEXT, ' ').trim()
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
