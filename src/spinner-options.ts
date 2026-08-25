import { isSpinnerColor } from './ansi.js'
import type { TerminalMode, UnicodeMode } from './env.js'
import type { SpinnerColor } from './index.js'

export type StaticMode = 'symbol' | 'text' | 'silent'

export function requireColor(value: unknown): SpinnerColor {
  if (typeof value !== 'string' || !isSpinnerColor(value)) {
    throw new TypeError('color must be a built-in spinner color')
  }
  return value as SpinnerColor
}

export function requireStaticMode(value: unknown): StaticMode {
  if (value !== 'symbol' && value !== 'text' && value !== 'silent') {
    throw new TypeError("static must be 'symbol', 'text', or 'silent'")
  }
  return value
}

export function requireTerminalMode(value: unknown): TerminalMode {
  if (value !== 'auto' && value !== 'static' && value !== 'interactive') {
    throw new TypeError("terminal must be 'auto', 'static', or 'interactive'")
  }
  return value
}

/** Validate an automatic color policy while retaining the mutable frame color. */
export function requireColorOption(value: unknown, fallback: SpinnerColor): SpinnerColor | false {
  if (value === undefined) return fallback
  if (value === false) return false
  return requireColor(value)
}

export function requireUnicodeMode(value: unknown): UnicodeMode {
  if (value === 'auto' || typeof value === 'boolean') return value
  throw new TypeError("unicode must be 'auto', true, or false")
}

export function requireHideCursor(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('hideCursor must be a boolean')
  return value
}

export function requireIndent(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 40) {
    throw new TypeError('indent must be a safe integer between 0 and 40')
  }
  return value as number
}

export function requireOptions<T extends object>(value: T): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('options must be an object')
  }
  return value
}
