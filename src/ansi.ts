import { styleText } from 'node:util'

import type { SpinnerColor } from './index.js'

/** Apply a resolved ANSI-16 frame or status color without owning a stream. */
export function colorize(color: SpinnerColor, text: string, enabled: boolean): string {
  return enabled ? styleText(color, text, { validateStream: false }) : text
}
