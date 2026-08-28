import { stderr } from 'node:process'

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import { sortCanonicalText } from '../scripts/canonical-order.mjs'
import spinlog, * as moduleExports from '../src/index.js'
import type { Spinner } from '../src/index.js'
import { setupTerminalFixture, type TerminalFixture } from './terminal-fixture.js'

const STYLE_EXPORTS = [
  'reset',
  'bold',
  'dim',
  'italic',
  'underline',
  'strikethrough',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite',
  'bgBlackBright',
  'bgRedBright',
  'bgGreenBright',
  'bgYellowBright',
  'bgBlueBright',
  'bgMagentaBright',
  'bgCyanBright',
  'bgWhiteBright',
]

describe('public runtime surface', () => {
  it('exports only the callable default and frozen named styles', () => {
    expect(sortCanonicalText(Object.keys(moduleExports))).toEqual(
      sortCanonicalText(['default', ...STYLE_EXPORTS]),
    )
    expect(spinlog).toBeTypeOf('function')
    expect(spinlog.promise).toBeTypeOf('function')
    expect(spinlog.intro).toBeTypeOf('function')
    expect(spinlog.outro).toBeTypeOf('function')
    expectTypeOf(spinlog.intro).returns.toBeVoid()
    expectTypeOf(spinlog.outro).returns.toBeVoid()
  })

  it('returns an instance with only the frozen fields and lifecycle methods', () => {
    expect(Object.keys(spinlog())).toEqual([
      'text',
      'color',
      'prefix',
      'suffix',
      'start',
      'stop',
      'log',
      'flush',
      'succeed',
      'fail',
      'warn',
      'info',
    ])
    expect(typeof spinlog()[Symbol.dispose]).toBe('function')
    expectTypeOf(spinlog()[Symbol.dispose]).returns.toBeVoid()
    expectTypeOf(spinlog().log).parameter(0).toEqualTypeOf<string>()
    expectTypeOf(spinlog().log).returns.toEqualTypeOf<Spinner>()
    expectTypeOf(spinlog().flush).returns.toEqualTypeOf<Promise<void>>()
  })
})

describe('intro and outro flow messages', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdoutWrite: ReturnType<typeof vi.spyOn>
  let terminal: TerminalFixture

  beforeEach(() => {
    terminal = setupTerminalFixture({ captureStdout: true })
    vi.stubEnv('CI', '1')
    write = terminal.write
    stdoutWrite = terminal.stdoutWrite as ReturnType<typeof vi.spyOn>
  })

  afterEach(() => {
    terminal.restore()
  })

  it('writes Unicode, empty, and repeated messages exactly once per call', () => {
    expect(spinlog.intro('Build')).toBeUndefined()
    spinlog.outro('Done')
    spinlog.intro()
    spinlog.outro('')
    spinlog.intro('Again')

    expect(write.mock.calls.map(([value]) => String(value))).toEqual([
      '┌  Build\n',
      '└  Done\n',
      '┌\n',
      '└\n',
      '┌  Again\n',
    ])
    expect(stdoutWrite).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses ASCII markers when Unicode is unavailable', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('WT_SESSION', '')

    spinlog.intro('Build')
    spinlog.outro('Done')

    expect(write.mock.calls.map(([value]) => String(value))).toEqual(['>  Build\n', '<  Done\n'])
  })

  it('colors only the marker and honors explicit color-disable precedence', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    vi.stubEnv('NO_COLOR', '')
    spinlog.intro('Build')
    expect(write).toHaveBeenLastCalledWith('\x1b[90m┌\x1b[39m  Build\n')

    vi.stubEnv('NO_COLOR', '1')
    spinlog.outro('Done')
    expect(write).toHaveBeenLastCalledWith('└  Done\n')
  })

  it('sanitizes terminal controls without mutating caller-owned text', () => {
    const message = '\x1b[31mred\x1b[0m\r\nnext\u202ehidden\x1b]0;title\x07'
    spinlog.intro(message)

    expect(message).toContain('\x1b[31m')
    expect(write).toHaveBeenCalledWith('┌  red next hidden\n')
  })

  it('validates before capability detection or output', () => {
    const environmentDescriptor = Object.getOwnPropertyDescriptor(process, 'env')
    Object.defineProperty(process, 'env', {
      configurable: true,
      get() {
        throw new Error('capability detection occurred')
      },
    })

    try {
      expect(() => spinlog.intro(42 as unknown as string)).toThrow('message must be a string')
      expect(() => spinlog.outro(null as unknown as string)).toThrow('message must be a string')
      expect(write).not.toHaveBeenCalled()
    } finally {
      if (environmentDescriptor) Object.defineProperty(process, 'env', environmentDescriptor)
    }
  })

  it('suppresses write exceptions and ignores backpressure', () => {
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    expect(() => spinlog.intro('Build')).not.toThrow()

    write.mockImplementationOnce(() => false)
    expect(() => spinlog.outro('Done')).not.toThrow()
    expect(write).toHaveBeenCalledTimes(2)
    stderr.emit('drain')
  })

  it('coordinates flow messages around an active spinner without process ownership', () => {
    vi.stubEnv('CI', '')
    const beforeSignals = {
      sigint: process.listenerCount('SIGINT'),
      sigterm: process.listenerCount('SIGTERM'),
    }
    const spinner = spinlog('work', { spinner: 'line' }).start()
    expect(vi.getTimerCount()).toBe(1)

    spinlog.intro('Build')
    spinlog.outro('Done')

    expect(vi.getTimerCount()).toBe(1)
    expect(write.mock.calls.map(([value]) => String(value))).toEqual([
      '\x1b[?25l- work',
      '\x1b[2K\r┌  Build\n- work',
      '\x1b[2K\r└  Done\n- work',
    ])
    expect(process.listenerCount('SIGINT')).toBe(beforeSignals.sigint)
    expect(process.listenerCount('SIGTERM')).toBe(beforeSignals.sigterm)
    spinner.succeed()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('promise wrapper', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdoutWrite: ReturnType<typeof vi.spyOn>
  let terminal: TerminalFixture

  beforeEach(() => {
    terminal = setupTerminalFixture({ captureStdout: true })
    vi.stubEnv('CI', '1')
    write = terminal.write
    stdoutWrite = terminal.stdoutWrite as ReturnType<typeof vi.spyOn>
  })

  afterEach(() => {
    terminal.restore()
  })

  it('starts before observing and assimilating a direct thenable exactly once', async () => {
    const order: string[] = []
    let thenGetterReads = 0
    let thenCalls = 0
    write.mockImplementation((value: unknown) => {
      order.push(String(value))
      return true
    })
    const thenable = Object.defineProperty({}, 'then', {
      configurable: true,
      get() {
        thenGetterReads += 1
        order.push('then-observed')
        return (resolve: (value: number) => void) => {
          thenCalls += 1
          resolve(42)
        }
      },
    }) as PromiseLike<number>

    await expect(spinlog.promise(thenable, { text: 'direct', spinner: 'line' })).resolves.toBe(42)
    expect(order[0]).toBe('- direct\n')
    expect(order[1]).toBe('then-observed')
    expect(order.at(-1)).toBe('✔ direct\n')
    expect(thenGetterReads).toBe(1)
    expect(thenCalls).toBe(1)
  })

  it('defers direct thenable invocation to the Promise job queue', async () => {
    const order: string[] = []
    let receiver: unknown
    const thenable = {
      // biome-ignore lint/suspicious/noThenProperty: Intentionally tests thenable assimilation.
      then(resolve: (value: string) => void) {
        receiver = this
        order.push('then-called')
        resolve('done')
      },
    } as PromiseLike<string>

    const pending = spinlog.promise(thenable, { text: 'deferred', spinner: 'line' })
    order.push('after-call')
    expect(order).toEqual(['after-call'])

    await Promise.resolve()
    expect(order).toEqual(['after-call', 'then-called'])
    expect(receiver).toBe(thenable)
    await expect(pending).resolves.toBe('done')
  })

  it('starts before invoking a task exactly once and preserves fulfillment', async () => {
    const task = vi.fn(() => Promise.resolve({ value: 7 }))
    const promise = spinlog.promise(task, { text: 'task', prefix: 'p' })

    expect(write).toHaveBeenCalledWith('p ⠋ task\n')
    expect(task).toHaveBeenCalledTimes(1)
    await expect(promise).resolves.toEqual({ value: 7 })
    expect(write).toHaveBeenLastCalledWith('p ✔ task\n')
  })

  it('assimilates callable thenables directly without invoking them as tasks', async () => {
    let thenReads = 0
    const callableThenable = vi.fn(() => {
      throw new Error('callable thenable must not be invoked as a task')
    })
    Object.defineProperty(callableThenable, 'then', {
      configurable: true,
      get() {
        thenReads += 1
        return (resolve: (value: string) => void) => resolve('resolved directly')
      },
    })

    await expect(
      spinlog.promise(callableThenable as unknown as PromiseLike<string>, { text: 'callable' }),
    ).resolves.toBe('resolved directly')
    expect(callableThenable).not.toHaveBeenCalled()
    expect(thenReads).toBe(1)

    const reason = new Error('callable thenable rejected')
    const rejectingThenable = vi.fn(() => {
      throw new Error('rejecting callable thenable must not be invoked as a task')
    })
    Object.defineProperty(rejectingThenable, 'then', {
      configurable: true,
      value: (_resolve: (value: never) => void, reject: (error: Error) => void) => reject(reason),
    })

    await expect(
      spinlog.promise(rejectingThenable as unknown as PromiseLike<never>, {
        text: 'rejecting callable',
      }),
    ).rejects.toBe(reason)
    expect(rejectingThenable).not.toHaveBeenCalled()
  })

  it('accepts a callable thenable returned by a task', async () => {
    const then = vi.fn((resolve: (value: string) => void) => resolve('callable result'))
    const callableThenable = Object.defineProperty(() => undefined, 'then', {
      configurable: true,
      value: then,
    }) as unknown as PromiseLike<string>
    const task = vi.fn(() => callableThenable)

    await expect(spinlog.promise(task, { text: 'callable', spinner: 'line' })).resolves.toBe(
      'callable result',
    )
    expect(task).toHaveBeenCalledTimes(1)
    expect(then).toHaveBeenCalledTimes(1)
  })

  it('renders generic settlement text without changing fulfillment or rejection semantics', async () => {
    await expect(
      spinlog.promise(Promise.resolve('artifact'), {
        text: 'build',
        successText: 'built',
      }),
    ).resolves.toBe('artifact')
    expect(write).toHaveBeenLastCalledWith('\u2714 built\n')

    const fulfilled = await spinlog.promise(Promise.resolve({ artifact: 'dist/index.js' }), {
      text: 'build',
      successText: (value) => `built ${value.artifact}`,
    })
    expect(fulfilled).toEqual({ artifact: 'dist/index.js' })
    expect(write).toHaveBeenLastCalledWith('\u2714 built dist/index.js\n')

    const reason = new Error('network unavailable')
    await expect(
      spinlog.promise(Promise.reject(reason), {
        text: 'publish',
        failText: (error) => `publish failed: ${(error as Error).message}`,
      }),
    ).rejects.toBe(reason)
    expect(write).toHaveBeenLastCalledWith('\u2716 publish failed: network unavailable\n')

    await expect(
      spinlog.promise(Promise.resolve('kept'), {
        successText() {
          throw new Error('cosmetic callback failure')
        },
      }),
    ).resolves.toBe('kept')
    expect(write).toHaveBeenLastCalledWith('\u2714\n')
  })

  it('preserves rejection reasons and converts synchronous task throws', async () => {
    const reason = { reason: 'original' }
    await expect(spinlog.promise(Promise.reject(reason), { text: 'reject' })).rejects.toBe(reason)
    expect(write).toHaveBeenLastCalledWith('✖ reject\n')

    const thrown = new Error('synchronous')
    const rejected = spinlog.promise(() => {
      throw thrown
    })
    await expect(rejected).rejects.toBe(thrown)
  })

  it('preserves a throwing then getter as the rejection reason', async () => {
    const reason = new Error('then getter failed')
    let reads = 0
    const thenable = Object.defineProperty({}, 'then', {
      configurable: true,
      get() {
        reads += 1
        throw reason
      },
    }) as PromiseLike<never>

    await expect(spinlog.promise(thenable, { text: 'getter', spinner: 'line' })).rejects.toBe(
      reason,
    )
    expect(reads).toBe(1)
    expect(write).toHaveBeenNthCalledWith(1, '- getter\n')
    expect(write).toHaveBeenLastCalledWith('✖ getter\n')
  })

  it('never lets cosmetic write failure replace action settlement', async () => {
    write.mockImplementation(() => {
      throw new Error('stderr unavailable')
    })

    await expect(spinlog.promise(Promise.resolve('ok'))).resolves.toBe('ok')
    const reason = new Error('action failed')
    await expect(spinlog.promise(Promise.reject(reason))).rejects.toBe(reason)
    expect(stdoutWrite).not.toHaveBeenCalled()
  })

  it('rejects invalid JavaScript options before invoking a task', async () => {
    const task = vi.fn(() => Promise.resolve('unreachable'))
    await expect(spinlog.promise(task, null as unknown as never)).rejects.toThrow(
      'options must be an object',
    )
    expect(task).not.toHaveBeenCalled()

    await expect(
      spinlog.promise(task, { successText: 1 as unknown as (value: string) => string }),
    ).rejects.toThrow('successText must be a string or function')
    expect(task).not.toHaveBeenCalled()
  })

  const nonCallableThen = Object.defineProperty({}, 'then', { value: true })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['string', 'not a promise'],
    ['plain object', {}],
    ['object with a non-callable then', nonCallableThen],
  ])(
    'rejects invalid direct input (%s) through failure settlement after starting',
    async (_label, input) => {
      await expect(
        spinlog.promise(input as never, { text: 'invalid direct', spinner: 'line' }),
      ).rejects.toThrow('input must be a PromiseLike or a task returning one')
      expect(write).toHaveBeenNthCalledWith(1, '- invalid direct\n')
      expect(write).toHaveBeenLastCalledWith('✖ invalid direct\n')
    },
  )

  it.each([
    ['null', null],
    ['number', 42],
    ['plain object', {}],
    ['object with a non-callable then', nonCallableThen],
  ])(
    'rejects an invalid task result (%s) through failure settlement after starting',
    async (_label, value) => {
      const task = vi.fn(() => value)
      const result = spinlog.promise(task as never, { text: 'invalid task', spinner: 'line' })
      const rejection = expect(result).rejects.toThrow(
        'input must be a PromiseLike or a task returning one',
      )

      expect(write).toHaveBeenNthCalledWith(1, '- invalid task\n')
      expect(task).toHaveBeenCalledTimes(1)
      await rejection
      expect(write).toHaveBeenLastCalledWith('✖ invalid task\n')
    },
  )
})
