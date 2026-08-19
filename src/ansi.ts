import { styleText } from 'node:util'

export type AnsiStyle = Extract<Parameters<typeof styleText>[0], string>

/** Normalize Node-version-specific nested SGR restoration to the frozen v1 behavior. */
export function normalizeStyleNesting(formatted: string): string {
  const openingEnd = formatted.indexOf('m') + 1
  const closingStart = formatted.lastIndexOf('\x1b[')
  if (!formatted.startsWith('\x1b[') || openingEnd === 0 || closingStart < openingEnd)
    return formatted

  const opening = formatted.slice(0, openingEnd)
  const closing = formatted.slice(closingStart)
  if (closing === '\x1b[0m') return formatted

  const [first = '', ...segments] = formatted.slice(openingEnd, closingStart).split(closing)
  let restored = first
  for (const segment of segments) {
    if (closing[2] !== '3' && closing[2] !== '4') restored += closing
    if (!segment.startsWith(opening)) restored += opening
    restored += segment
  }
  return `${opening}${restored}${closing}`
}

/** Apply one ANSI style while preserving deterministic nesting across supported Node versions. */
export function applyAnsiStyle(format: AnsiStyle, text: string): string {
  return normalizeStyleNesting(styleText(format, text, { validateStream: false }))
}
