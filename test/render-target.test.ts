import { EventEmitter } from 'node:events'
import type { Writable } from 'node:stream'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog from '../src/index.js'
import {
  acquireInteractiveLease,
  releaseInteractiveLease,
  writeInteractiveFrame,
  type InteractiveLease,
} from '../src/renderer.js'
import { resolveRenderTarget } from '../src/text.js'

type WriteOutcome = 'written' | 'backpressured' | 'failed'

/** A deliberately small Writable-shaped EventEmitter for stream-target behavior. */
class FakeTarget extends EventEmitter {
  readonly writes: string[] = []
  readonly isTTY = true
  columns: number | undefined
  rows: number | undefined
  #outcomes: WriteOutcome[] = []
  #pendingCallbacks: Array<(error?: Error | null) => void> = []

  constructor(columns = 80, rows = 24) {
    super()
    this.columns = columns
    this.rows = rows
  }

  plan(...outcomes: WriteOutcome[]): void {
    this.#outcomes.push(...outcomes)
  }

  write(value: string, callback?: (error?: Error | null) => void): boolean {
    this.writes.push(String(value))
    const outcome = this.#outcomes.shift() ?? 'written'
    if (outcome === 'failed') throw new Error('synthetic write failure')
    if (outcome === 'backpressured' && callback !== undefined) {
      this.#pendingCallbacks.push(callback)
    } else {
      callback?.()
    }
    return outcome !== 'backpressured'
  }

  emit(event: string | symbol, ...arguments_: unknown[]): boolean {
    const emitted = super.emit(event, ...arguments_)
    if (event === 'drain') {
      for (const callback of this.#pendingCallbacks.splice(0)) callback()
    }
    return emitted
  }

  asWritable(): Writable {
    return this as unknown as Writable
  }
}

function createLease(
  frame = '- active',
): InteractiveLease & { readonly failed: ReturnType<typeof vi.fn> } {
  const failed = vi.fn()
  return {
    currentFrame: () => frame,
    stopAfterRenderFailure: failed,
    failed,
  }
}

describe('explicit render targets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('CI', '')
    vi.stubEnv('FORCE_COLOR', '0')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TERM', 'xterm-256color')
    vi.stubEnv('WT_SESSION', 'test-session')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('isolates leases by stream while coordinating spinner, progress, logs, and flow on one stream', () => {
    const primary = new FakeTarget()
    const independent = new FakeTarget()
    const spinner = spinlog('work', {
      stream: primary.asWritable(),
      spinner: 'line',
      terminal: 'interactive',
      color: false,
      unicode: false,
    }).start()
    const sameTargetProgress = spinlog
      .progress('copy', {
        total: 2,
        stream: primary.asWritable(),
        terminal: 'interactive',
        color: false,
        unicode: false,
        width: 5,
        style: 'ascii',
      })
      .start()
    const independentProgress = spinlog
      .progress('other', {
        total: 1,
        stream: independent.asWritable(),
        terminal: 'interactive',
        color: false,
        unicode: false,
        width: 5,
        style: 'ascii',
      })
      .start()

    expect(primary.writes).toEqual(['\x1b[?25l- work', '\x1b[2K\r[-----] 0% copy\n- work'])
    expect(independent.writes).toEqual(['\x1b[?25l[-----] 0% other'])

    spinlog.intro('next', {
      stream: primary.asWritable(),
      color: false,
      unicode: false,
      indent: 2,
    })
    spinner.log('checkpoint')
    expect(independent.writes).toHaveLength(1)
    expect(primary.writes.slice(2)).toEqual([
      '\x1b[2K\r  >  next\n- work',
      '\x1b[2K\rcheckpoint\n- work',
    ])

    sameTargetProgress.increment().succeed()
    expect(primary.writes.at(-1)).toBe('\x1b[2K\r+ 100% copy\n- work')

    independentProgress.succeed()
    expect(independent.writes.at(-1)).toBe('\x1b[2K\r+ 100% other\n\x1b[?25h')
    spinner.stop()
  })

  it('honors color, Unicode, cursor, indent, width, style, and positive increment policies', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    const target = new FakeTarget()
    const spinner = spinlog('work', {
      stream: target.asWritable(),
      spinner: 'line',
      terminal: 'interactive',
      color: false,
      unicode: false,
      hideCursor: false,
      indent: 2,
    }).start()
    expect(target.writes).toEqual(['  - work'])
    spinner.succeed()
    expect(target.writes.at(-1)).toBe('\x1b[2K\r  + work\n')

    const progress = spinlog
      .progress('copy', {
        total: 100,
        value: 5,
        stream: target.asWritable(),
        terminal: 'interactive',
        color: false,
        unicode: false,
        hideCursor: false,
        indent: 2,
        width: 5,
        style: 'ascii',
      })
      .start()
    expect(target.writes.at(-1)).toBe('  [-----] 5% copy')
    progress.increment(15)
    expect(target.writes.at(-1)).toBe('\x1b[2K\r  [#----] 20% copy')
    expect(() => progress.increment(0)).toThrow('amount must be a positive safe integer')
    expect(() => progress.increment(-1)).toThrow('amount must be a positive safe integer')
    progress.succeed()

    const output = target.writes.join('')
    expect(output).not.toContain('\x1b[?25')
    expect(output).not.toContain('\x1b[36m')
    expect(output).not.toContain('\x1b[32m')
  })

  it('keeps a multi-row group, its logs, and another root surface local to their streams', () => {
    const groupStream = new FakeTarget(80, 5)
    const rootStream = new FakeTarget()
    const group = spinlog.group({
      stream: groupStream.asWritable(),
      terminal: 'interactive',
      color: false,
      unicode: false,
    })
    const child = group.add('group task', { spinner: 'line' }).start()
    const root = spinlog('root task', {
      stream: rootStream.asWritable(),
      spinner: 'line',
      terminal: 'interactive',
      color: false,
      unicode: false,
    }).start()

    expect(groupStream.writes).toEqual(['\x1b[?25l- group task'])
    expect(rootStream.writes).toEqual(['\x1b[?25l- root task'])
    child.log('group checkpoint')
    expect(groupStream.writes.at(-1)).toBe('\x1b[2K\rgroup checkpoint\n- group task')
    expect(rootStream.writes).toHaveLength(1)

    child.succeed()
    expect(groupStream.writes.at(-1)).toBe('\x1b[2K\r+ group task\n\x1b[?25h')
    root.stop()
  })

  it('coalesces cosmetic frames through drain and retains drain listeners until queued output drains', () => {
    const stream = new FakeTarget()
    const target = resolveRenderTarget(stream.asWritable())
    const lease = createLease()
    stream.plan('backpressured')

    expect(acquireInteractiveLease(target, lease)).toBe(true)
    expect(writeInteractiveFrame(target, lease, 'frame-0')).toBe(true)
    expect(writeInteractiveFrame(target, lease, 'frame-1')).toBe(true)
    expect(writeInteractiveFrame(target, lease, 'frame-2')).toBe(true)
    expect(stream.writes).toEqual(['frame-0'])
    expect(stream.listenerCount('drain')).toBe(1)

    stream.emit('drain')
    expect(stream.writes).toEqual(['frame-0', 'frame-2'])
    expect(stream.listenerCount('drain')).toBe(0)

    stream.plan('backpressured')
    expect(writeInteractiveFrame(target, lease, 'frame-3')).toBe(true)
    expect(stream.listenerCount('drain')).toBe(1)
    releaseInteractiveLease(target, lease)
    expect(stream.listenerCount('drain')).toBe(1)
    stream.emit('drain')
    expect(stream.writes).toEqual(['frame-0', 'frame-2', 'frame-3'])
    expect(stream.listenerCount('drain')).toBe(0)

    const spinnerTarget = new FakeTarget()
    spinnerTarget.plan('backpressured')
    const spinner = spinlog('draining', {
      stream: spinnerTarget.asWritable(),
      spinner: 'line',
      terminal: 'interactive',
      color: false,
      unicode: false,
    }).start()
    expect(spinnerTarget.listenerCount('drain')).toBe(1)
    spinner.stop()
    expect(spinnerTarget.listenerCount('drain')).toBe(1)
    spinnerTarget.emit('drain')
    expect(spinnerTarget.listenerCount('drain')).toBe(0)
  })

  it('makes the target-local flush boundary wait for accepted backpressure', async () => {
    const stream = new FakeTarget()
    stream.plan('backpressured')

    spinlog.intro('queued', { stream: stream.asWritable(), color: false, unicode: false })
    let settled = false
    const pending = spinlog.flush({ stream: stream.asWritable() }).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    stream.emit('drain')
    await pending
    expect(settled).toBe(true)
  })

  it('releases a failed target lease and lets a spinner recover on a later write', () => {
    const stream = new FakeTarget()
    const target = resolveRenderTarget(stream.asWritable())
    const lease = createLease()
    stream.plan('failed')

    expect(acquireInteractiveLease(target, lease)).toBe(true)
    expect(writeInteractiveFrame(target, lease, 'broken')).toBe(false)
    expect(lease.failed).toHaveBeenCalledOnce()
    expect(stream.listenerCount('drain')).toBe(0)
    const retryLease = createLease()
    expect(acquireInteractiveLease(target, retryLease)).toBe(true)
    releaseInteractiveLease(target, retryLease)

    const recovery = new FakeTarget()
    recovery.plan('failed', 'written', 'written')
    const spinner = spinlog('recover', {
      stream: recovery.asWritable(),
      spinner: 'line',
      terminal: 'interactive',
      unicode: false,
      color: false,
    })
    spinner.start().start()
    expect(recovery.writes.at(-1)).toBe('\x1b[?25l- recover')
    spinner.stop()
  })

  it('retries cursor restoration after an explicit stop write fails', () => {
    const spinnerTarget = new FakeTarget()
    const spinner = spinlog('spinner', {
      stream: spinnerTarget.asWritable(),
      spinner: 'line',
      terminal: 'interactive',
      color: false,
      unicode: false,
    }).start()
    spinnerTarget.plan('failed', 'written')
    spinner.stop()

    expect(spinnerTarget.writes.slice(-2)).toEqual(['\x1b[2K\r\x1b[?25h', '\x1b[?25h'])

    const progressTarget = new FakeTarget()
    const progress = spinlog
      .progress('progress', {
        total: 1,
        stream: progressTarget.asWritable(),
        terminal: 'interactive',
        color: false,
        unicode: false,
        width: 5,
        style: 'ascii',
      })
      .start()
    progressTarget.plan('failed', 'written')
    progress.stop()

    expect(progressTarget.writes.slice(-2)).toEqual(['\x1b[2K\r\x1b[?25h', '\x1b[?25h'])
  })

  it('stops a static group after a failed write so the child can retry', () => {
    const target = new FakeTarget()
    target.rows = undefined
    target.plan('failed')
    const child = spinlog
      .group({ stream: target.asWritable(), color: false, unicode: false })
      .add('retry', { spinner: 'line' })
      .start()

    expect(target.writes).toEqual(['- retry\n'])
    child.start()
    expect(target.writes).toEqual(['- retry\n', '- retry\n'])
  })
})
