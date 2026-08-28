import { stderr } from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog, { type SpinnerGroup } from '../src/index.js'
import { setupTerminalFixture, type TerminalFixture } from './terminal-fixture.js'
import { acceptWrite } from './write-callback.js'

describe('spinner groups', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdoutWrite: ReturnType<typeof vi.spyOn>
  let terminal: TerminalFixture
  let groups: SpinnerGroup[]

  function output(): string[] {
    return write.mock.calls.map(([value]) => String(value))
  }

  beforeEach(() => {
    terminal = setupTerminalFixture({ captureStdout: true, rows: 24 })
    write = terminal.write
    stdoutWrite = terminal.stdoutWrite as ReturnType<typeof vi.spyOn>
    groups = []
  })

  afterEach(() => {
    for (const group of groups) group.stop()
    terminal.restore()
  })

  function createGroup(...args: Parameters<typeof spinlog.group>): SpinnerGroup {
    const group = spinlog.group(...args)
    groups.push(group)
    return group
  }

  it('renders active children as one coordinated interactive surface', () => {
    const group = createGroup()
    const install = group.add('install', { spinner: 'line' }).start()
    const compile = group.add('compile', { spinner: 'line' }).start()

    expect(output()).toEqual(['\x1b[?25l- install', '\x1b[2K\r- install\n- compile'])
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(80)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[1A\x1b[2K\r\\ install\n\\ compile')

    install.succeed()
    compile.fail()
    expect(output().at(-1)).toContain('\u2714 install\n\u2716 compile\n\x1b[?25h')
    expect(vi.getTimerCount()).toBe(0)
    expect(stdoutWrite).not.toHaveBeenCalled()
  })

  it('rearms the scheduler when a faster child settles', () => {
    const group = createGroup()
    const fast = group.add('fast', { spinner: { frames: ['a', 'b'], interval: 16 } }).start()
    const slow = group.add('slow', { spinner: { frames: ['A', 'B'], interval: 60_000 } }).start()

    fast.succeed()
    const settledWriteCount = output().length
    vi.advanceTimersByTime(90)
    expect(output()).toHaveLength(settledWriteCount)

    vi.advanceTimersByTime(59_910)
    expect(output()).toHaveLength(settledWriteCount + 1)
    slow.stop()
  })

  it('rearms the scheduler when a faster child stops', () => {
    const group = createGroup()
    const fast = group.add('fast', { spinner: { frames: ['a', 'b'], interval: 16 } }).start()
    const slow = group.add('slow', { spinner: { frames: ['A', 'B'], interval: 60_000 } }).start()

    fast.stop()
    const stoppedWriteCount = output().length
    vi.advanceTimersByTime(90)
    expect(output()).toHaveLength(stoppedWriteCount)

    vi.advanceTimersByTime(59_910)
    expect(output()).toHaveLength(stoppedWriteCount + 1)
    slow.stop()
  })

  it('coordinates logs and flow messages without changing child ownership', () => {
    const child = createGroup().add('work', { spinner: 'line' }).start()
    child.log('checkpoint\r\nnow')
    spinlog.intro('build')

    expect(output().slice(1)).toEqual([
      '\x1b[2K\rcheckpoint now\n- work',
      '\x1b[2K\r┌  build\n- work',
    ])
    child.stop()
  })

  it('falls back atomically to configured static output on width loss', () => {
    const group = createGroup({ static: 'text' })
    const first = group.add('first', { spinner: 'line' }).start()
    group.add('second', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 9 })

    vi.advanceTimersByTime(80)

    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[1A\x1b[2K\r\x1b[?25hfirst\nsecond\n')
    expect(vi.getTimerCount()).toBe(0)
    first.succeed()
    expect(output().at(-1)).toBe('first\n')
  })

  it('stops the group when static demotion output cannot be written', () => {
    const group = createGroup()
    group.add('work', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 4 })
    write.mockImplementationOnce(() => {
      throw new Error('target unavailable')
    })

    group.add('other', { spinner: 'line' }).start()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('preflights a settlement redraw and atomically demotes after a resize', () => {
    const group = createGroup({ static: 'text' })
    const done = group.add('done', { spinner: 'line' }).start()
    group.add('active', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 8 })
    write.mockClear()

    done.succeed()

    expect(output()).toEqual(['\x1b[2K\r\x1b[1A\x1b[2K\r\x1b[?25h✔ done\nactive\n'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preflights a coordinated log frame and keeps the permanent row after height loss', () => {
    const group = createGroup()
    const first = group.add('one', { spinner: 'line' }).start()
    group.add('two', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'rows', { configurable: true, value: 2 })
    write.mockClear()

    first.log('checkpoint')

    expect(output()).toEqual(['\x1b[2K\r\x1b[1A\x1b[2K\r\x1b[?25h- one\n- two\n', 'checkpoint\n'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the last accepted multi-row frame when a smaller redraw is still queued', () => {
    const group = createGroup()
    const first = group.add('first', { spinner: 'line' }).start()
    write.mockImplementationOnce(() => false)
    const second = group.add('second', { spinner: 'line' }).start()

    second.stop()
    group.stop()

    expect(output()).toEqual(['\x1b[?25l- first', '\x1b[2K\r- first\n- second'])
    stderr.emit('drain')
    expect(output()).toEqual([
      '\x1b[?25l- first',
      '\x1b[2K\r- first\n- second',
      '\x1b[2K\r\x1b[1A\x1b[2K\r\x1b[?25h',
    ])
    expect(vi.getTimerCount()).toBe(0)
    expect(first.stop()).toBe(first)
  })

  it('atomically falls back when row limits or terminal height cannot contain the surface', () => {
    const limited = createGroup({ maxRows: 2 } as never)
    limited.add('one', { spinner: 'line' }).start()
    limited.add('two', { spinner: 'line' }).start()
    const beforeLimit = output().length
    limited.add('three', { spinner: 'line' }).start()

    expect(output()).toHaveLength(beforeLimit + 1)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[1A\x1b[2K\r\x1b[?25h- one\n- two\n- three\n')
    expect(vi.getTimerCount()).toBe(0)
    limited.stop()

    Object.defineProperty(stderr, 'rows', { configurable: true, value: 3 })
    const heightLimited = createGroup()
    heightLimited.add('one', { spinner: 'line' }).start()
    heightLimited.add('two', { spinner: 'line' }).start()
    const beforeHeight = output().length
    heightLimited.add('three', { spinner: 'line' }).start()

    expect(output()).toHaveLength(beforeHeight + 1)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[1A\x1b[2K\r\x1b[?25h- one\n- two\n- three\n')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts a clean interactive session after permanent rows have been flushed', () => {
    const group = createGroup()
    group.add('first', { spinner: 'line' }).start().succeed()

    expect(output().at(-1)).toBe('\x1b[2K\r✔ first\n\x1b[?25h')
    write.mockClear()

    group.add('second', { spinner: 'line' }).start()
    expect(output()).toEqual(['\x1b[?25l- second'])
  })

  it('exposes the target-local flush boundary on groups and their children', async () => {
    const group = createGroup()
    const child = group.add('work', { spinner: 'line' }).start().succeed()

    await expect(child.flush()).resolves.toBeUndefined()
    await expect(group.flush()).resolves.toBeUndefined()
  })

  it('flushes settled rows when an interactive group is stopped', () => {
    const group = createGroup()
    const done = group.add('done', { spinner: 'line' }).start()
    group.add('active', { spinner: 'line' }).start()
    done.succeed()
    write.mockClear()

    group.stop()

    expect(output()).toEqual(['\x1b[2K\r\x1b[1A\x1b[2K\r\u2714 done\n\x1b[?25h'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resets a static session on stop so a later start can reacquire interactivity', () => {
    Object.defineProperty(stderr, 'rows', { configurable: true, value: 1 })
    const group = createGroup()
    const child = group.add('retry', { spinner: 'line' }).start()

    expect(output()).toEqual(['- retry\n'])
    expect(vi.getTimerCount()).toBe(0)

    group.stop()
    Object.defineProperty(stderr, 'rows', { configurable: true, value: 24 })
    write.mockClear()
    child.start()

    expect(output()).toEqual(['\x1b[?25l- retry'])
    expect(vi.getTimerCount()).toBe(1)
  })

  it('retries an interactive group after lease contention and narrow-width fallback', () => {
    const owner = spinlog('owner', { spinner: 'line' }).start()
    const contested = createGroup()
    const blocked = contested.add('blocked', { spinner: 'line' }).start()

    expect(output().at(-1)).toBe('\x1b[2K\r- blocked\n- owner')
    blocked.stop()
    owner.stop()
    write.mockClear()
    blocked.start()
    expect(output()).toEqual(['\x1b[?25l- blocked'])
    blocked.stop()

    Object.defineProperty(stderr, 'columns', { configurable: true, value: 8 })
    const narrow = createGroup()
    const retry = narrow.add('retry', { spinner: 'line' }).start()
    expect(output().at(-1)).toBe('- retry\n')
    retry.stop()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 80 })
    write.mockClear()
    retry.start()

    expect(output()).toEqual(['\x1b[?25l- retry'])
  })

  it('does not indent an empty text-mode static row', () => {
    const group = createGroup({ terminal: 'static', static: 'text', indent: 3 } as never)

    group.add('').start()

    expect(output()).toEqual(['\n'])
  })

  it('applies group presentation policy without allowing automatic color or cursor leakage', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    const plain = createGroup({
      color: false,
      unicode: false,
      hideCursor: false,
      indent: 2,
    } as never)
    const child = plain.add('work', { color: 'red', spinner: 'line' }).start()

    expect(output()).toEqual(['  - work'])
    child.succeed()
    expect(output().at(-1)).toBe('\x1b[2K\r  + work\n')

    const colored = createGroup({ color: 'magenta', hideCursor: true } as never)
    colored.add('default', { spinner: 'line' }).start()
    expect(output().at(-1)).toContain('\x1b[35m')
  })

  it('validates group presentation limits before terminal output', () => {
    expect(() => spinlog.group({ color: true } as never)).toThrow('color must be')
    expect(() => spinlog.group({ unicode: 'yes' } as never)).toThrow(
      "unicode must be 'auto', true, or false",
    )
    expect(() => spinlog.group({ hideCursor: 'yes' } as never)).toThrow(
      'hideCursor must be a boolean',
    )
    expect(() => spinlog.group({ indent: -1 } as never)).toThrow('indent must be')
    expect(() => spinlog.group({ indent: 1_001 } as never)).toThrow('indent must be')
    expect(() => spinlog.group({ maxRows: 0 } as never)).toThrow(
      'maxRows must be a positive safe integer',
    )
    expect(() => spinlog.group({ maxRows: Number.MAX_SAFE_INTEGER + 1 } as never)).toThrow(
      'maxRows must be a positive safe integer',
    )
    expect(output()).toEqual([])
  })

  it('keeps explicit logs visible in silent static mode and validates before writes', () => {
    const group = createGroup({ static: 'silent', terminal: 'static' })
    const child = group.add('quiet').start()
    child.succeed()
    expect(output()).toEqual([])
    expect(child.log('visible')).toBe(child)
    expect(output()).toEqual(['visible\n'])
    expect(() => child.log(null as unknown as string)).toThrow('message must be a string')
    expect(output()).toEqual(['visible\n'])
  })

  it('contains synchronous write failures, supports disposal, and allows a later cycle', () => {
    const group = createGroup()
    const child = group.add('retry', { spinner: 'line' }).start()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    child.log('fails safely')

    expect(vi.getTimerCount()).toBe(0)
    expect(child.start()).toBe(child)
    expect(vi.getTimerCount()).toBe(1)
    group[Symbol.dispose]()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ends a static group session when a terminal write fails', () => {
    const group = createGroup({ terminal: 'static' })
    const first = group.add('first', { spinner: 'line' }).start()
    const retry = group.add('retry', { spinner: 'line' }).start()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })

    first.succeed()
    write.mockClear()
    retry.start()

    expect(output()).toEqual(['- retry\n'])
  })

  it('validates group and child options before any terminal side effect', () => {
    expect(() => spinlog.group(null as unknown as never)).toThrow('options must be an object')
    const group = createGroup()
    expect(() => group.add('bad', null as unknown as never)).toThrow('options must be an object')
    expect(() => group.add(1 as unknown as string)).toThrow('text must be a string')
    expect(output()).toEqual([])
  })

  it('preserves the spinner lifecycle and mutable fields in static group mode', () => {
    const group = createGroup({ terminal: 'static' })
    const first = group.add('first', { color: 'red', prefix: 'p', suffix: 's' })
    expect([first.text, first.color, first.prefix, first.suffix]).toEqual([
      'first',
      'red',
      'p',
      's',
    ])
    first.text = 'changed'
    first.color = 'blue'
    first.prefix = 'before'
    first.suffix = 'after'
    first.start().succeed('done').fail().warn().info()
    const second = group.add('second').start().warn()
    group.add('idle').info()
    first[Symbol.dispose]()

    expect(second.stop()).toBe(second)
    expect(output()).toEqual([
      'before ⠋ changed after\n',
      'before ✔ done after\n',
      '⠋ second\n',
      '⚠ second\n',
      'ℹ idle\n',
    ])
  })

  it('demotes an active surface when child mutation no longer fits and handles lease contention', () => {
    const primary = spinlog('primary', { spinner: 'line' }).start()
    const contested = createGroup()
    contested.add('secondary', { spinner: 'line' }).start()
    expect(output().at(-1)).toBe('\x1b[2K\r- secondary\n- primary')
    primary.stop()

    write.mockClear()
    const group = createGroup()
    const child = group.add('short', { spinner: 'line' }).start()
    child.color = 'red'
    child.prefix = 'p'
    child.suffix = 's'
    child.text = 'a message that cannot fit'
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 12 })
    vi.advanceTimersByTime(80)
    expect(output().at(-1)).toContain('\x1b[?25h')
    child.stop()
  })

  it('contains initial, demotion, and final-write failures without retaining a lease', () => {
    const initial = createGroup()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    const retry = initial.add('retry', { spinner: 'line' }).start()
    expect(vi.getTimerCount()).toBe(0)
    retry.start()
    expect(vi.getTimerCount()).toBe(1)
    retry.succeed()

    const demoted = createGroup()
    const wide = demoted.add('wide', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 6 })
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    vi.advanceTimersByTime(80)
    expect(vi.getTimerCount()).toBe(0)
    wide.start()

    Object.defineProperty(stderr, 'columns', { configurable: true, value: 80 })
    const final = createGroup().add('final', { spinner: 'line' }).start()
    write
      .mockImplementationOnce(() => {
        throw new Error('stderr unavailable')
      })
      .mockImplementationOnce(() => {
        throw new Error('stderr unavailable')
      })
    expect(() => final.succeed()).not.toThrow()
  })

  it('does not retain a scheduler when a child-add redraw fails', () => {
    const group = createGroup()
    group.add('first', { spinner: 'line' }).start()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })

    const retry = group.add('retry', { spinner: 'line' }).start()

    expect(vi.getTimerCount()).toBe(0)
    write.mockImplementation(acceptWrite(write) as never)
    retry.start()
    expect(vi.getTimerCount()).toBe(1)
  })

  it('does not restore frame row ownership after a stream synchronously stops the group', () => {
    const group = createGroup()
    const child = group.add('work', { spinner: 'line' })
    let reentrant = true
    write.mockImplementation(() => {
      if (reentrant) {
        reentrant = false
        group.stop()
      }
      return true
    })

    child.start()

    expect(vi.getTimerCount()).toBe(0)
    write.mockImplementation(acceptWrite(write) as never)
    child.start()
    expect(vi.getTimerCount()).toBe(1)
  })

  it('does not restore a disabled cursor after an initial interactive write fails', () => {
    const group = createGroup({ hideCursor: false } as never)
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    const child = group.add('retry', { spinner: 'line' }).start()

    expect(output()).toEqual(['- retry'])
    expect(vi.getTimerCount()).toBe(0)
    expect(output().join('')).not.toContain('\x1b[?25')

    child.start()
    expect(output()).toEqual(['- retry', '- retry'])
    expect(vi.getTimerCount()).toBe(1)
  })

  it('handles mixed terminal rows, scheduler intervals, mutations, and group static branches', () => {
    const group = createGroup()
    const done = group.add('done', { spinner: 'line' }).start()
    const slow = group.add('slow', { spinner: { frames: ['A', 'B'], interval: 160 } }).start()
    group.add('fast', { spinner: 'line' }).start()
    done.succeed()
    expect(slow.start()).toBe(slow)
    vi.advanceTimersByTime(80)
    slow.stop()
    group.add('single', { spinner: { frames: ['S'] } }).start()
    expect(vi.getTimerCount()).toBe(0)

    const idle = createGroup().add('idle')
    idle.info()
    expect(output().some((line) => line.includes('ℹ idle'))).toBe(true)

    const staticGroup = createGroup({ terminal: 'static', static: 'text' })
    staticGroup.add('first').start()
    staticGroup.add('second').start()

    const mutable = createGroup()
    const child = mutable.add('short', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 10 })
    child.text = 'too wide'
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies configured color to group frames and statuses only', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    const child = createGroup().add('color', { color: 'red', spinner: 'line' }).start()
    expect(output()[0]).toContain('\x1b[31m')
    child.succeed()
    expect(output().at(-1)).toContain('\x1b[32m')
  })

  it('aborts mixed rows on write failure and suppresses silent demotion output', () => {
    const failing = createGroup()
    const terminal = failing.add('done', { spinner: 'line' }).start()
    const active = failing.add('active', { spinner: 'line' }).start()
    terminal.succeed()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    active.log('failure')

    write.mockClear()
    const silent = createGroup({ static: 'silent' })
    const child = silent.add('wide', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 6 })
    vi.advanceTimersByTime(80)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[?25h')
    child.stop()
  })
})
