import { stderr, stdout } from 'node:process'

import { vi } from 'vitest'

import { acceptWrite } from './write-callback.js'

export interface TerminalFixture {
  readonly write: ReturnType<typeof vi.spyOn>
  readonly stdoutWrite: ReturnType<typeof vi.spyOn> | undefined
  restore(): void
}

interface TerminalFixtureOptions {
  readonly rows?: number
  readonly captureStdout?: boolean
}

/** Install the shared TTY and stream state used by terminal surface tests. */
export function setupTerminalStreams({
  rows,
  captureStdout = false,
}: TerminalFixtureOptions = {}): TerminalFixture {
  const ttyDescriptor = Object.getOwnPropertyDescriptor(stderr, 'isTTY')
  const columnsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'columns')
  const rowsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'rows')
  Object.defineProperty(stderr, 'isTTY', { configurable: true, value: true })
  Object.defineProperty(stderr, 'columns', { configurable: true, value: 80 })
  if (rows !== undefined) Object.defineProperty(stderr, 'rows', { configurable: true, value: rows })

  const write = vi.spyOn(stderr, 'write')
  write.mockImplementation(acceptWrite(write) as never)
  const stdoutWrite = captureStdout ? vi.spyOn(stdout, 'write') : undefined
  stdoutWrite?.mockImplementation(acceptWrite(stdoutWrite) as never)

  return {
    write,
    stdoutWrite,
    restore() {
      vi.restoreAllMocks()
      if (ttyDescriptor) Object.defineProperty(stderr, 'isTTY', ttyDescriptor)
      else delete (stderr as { isTTY?: boolean }).isTTY
      if (columnsDescriptor) Object.defineProperty(stderr, 'columns', columnsDescriptor)
      else delete (stderr as { columns?: number }).columns
      if (rowsDescriptor) Object.defineProperty(stderr, 'rows', rowsDescriptor)
      else delete (stderr as { rows?: number }).rows
    },
  }
}

/** Install the shared TTY, environment, timer, and stream state used by terminal surface tests. */
export function setupTerminalFixture(options: TerminalFixtureOptions = {}): TerminalFixture {
  vi.useFakeTimers()
  vi.stubEnv('CI', '')
  vi.stubEnv('FORCE_COLOR', '0')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NO_COLOR', '')
  vi.stubEnv('NODE_DISABLE_COLORS', '')
  vi.stubEnv('TERM', 'xterm-256color')
  vi.stubEnv('WT_SESSION', 'test-session')
  const streams = setupTerminalStreams(options)

  return {
    ...streams,
    restore() {
      vi.useRealTimers()
      streams.restore()
      vi.unstubAllEnvs()
    },
  }
}
