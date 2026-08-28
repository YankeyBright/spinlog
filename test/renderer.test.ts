import { EventEmitter, once } from 'node:events'
import { Writable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acquireInteractiveLease,
  type InteractiveLease,
  flushTarget,
  releaseInteractiveLease,
  writeCoordinatedLine,
  writeInteractiveFrame,
  writeTarget,
} from '../src/renderer.js'
import { enqueuePermanentTask, targetState } from '../src/renderer-queue.js'
import { type RenderTarget, resolveRenderTarget } from '../src/text.js'

function lease(frame = '- active', hooks: Partial<InteractiveLease> = {}) {
  return {
    currentFrame: () => frame,
    stopAfterRenderFailure: vi.fn(),
    ...hooks,
  } satisfies InteractiveLease
}

function createTarget(write: (value: string) => boolean) {
  const stream = {
    write(value: string, callback?: (error?: Error | null) => void) {
      const result = write(value)
      callback?.()
      return result
    },
  }
  return resolveRenderTarget(stream as unknown as Writable)
}

describe('interactive terminal lease', () => {
  const owners: Array<readonly [RenderTarget, InteractiveLease]> = []

  afterEach(() => {
    for (const [target, owner] of owners.splice(0)) releaseInteractiveLease(target, owner)
    vi.restoreAllMocks()
  })

  it('permits one owner and redraws it after coordinated permanent output', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const first = lease()
    const second = lease('- secondary')
    owners.push([target, first], [target, second])

    expect(acquireInteractiveLease(target, first)).toBe(true)
    expect(acquireInteractiveLease(target, first)).toBe(true)
    expect(acquireInteractiveLease(target, second)).toBe(false)
    expect(writeInteractiveFrame(target, first, '\x1b[?25l- active')).toBe(true)
    expect(writeCoordinatedLine(target, 'status\n')).toBe(true)
    expect(write.mock.calls.map(([value]) => String(value))).toEqual([
      '\x1b[?25l- active',
      '\x1b[2K\rstatus\n- active',
    ])

    releaseInteractiveLease(target, second)
    releaseInteractiveLease(target, first)
    expect(writeCoordinatedLine(target, 'plain\n')).toBe(true)
    expect(write).toHaveBeenLastCalledWith('plain\n')
  })

  it('passes a non-owner frame through without taking the active surface', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const owner = lease()
    const nonOwner = lease('- fallback')
    owners.push([target, owner], [target, nonOwner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, nonOwner, 'fallback\n')).toBe(true)
    expect(write).toHaveBeenCalledWith('fallback\n')
    expect(writeCoordinatedLine(target, 'status\n')).toBe(true)
    expect(write).toHaveBeenLastCalledWith('\x1b[2K\rstatus\n- active')
  })

  it('preflights owned frames and records an accepted physical frame', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const prepareFrame = vi.fn(() => true)
    const didWriteFrame = vi.fn()
    const owner = lease('- active', { didWriteFrame, prepareFrame })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(true)
    expect(prepareFrame).toHaveBeenCalledOnce()
    expect(didWriteFrame).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith('frame')

    expect(writeCoordinatedLine(target, 'status\n')).toBe(true)
    expect(prepareFrame).toHaveBeenCalledTimes(2)
    expect(didWriteFrame).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith('\x1b[2K\rstatus\n- active')
  })

  it('writes a direct permanent line when preflight rejects without releasing the lease', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const owner = lease('- active', { prepareFrame: () => false })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(write).toHaveBeenCalledWith('persisted\n')
  })

  it('writes a direct permanent line when preflight releases its lease', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    let owner: InteractiveLease
    owner = lease('- active', {
      prepareFrame: () => {
        releaseInteractiveLease(target, owner)
        return true
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(write).toHaveBeenCalledWith('persisted\n')
  })

  it('contains a frame-reconstruction exception while preserving the permanent line', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const owner = lease('- active', {
      currentFrame: () => {
        throw new Error('frame unavailable')
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(write).toHaveBeenCalledWith('persisted\n')
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
  })

  it('preserves a permanent line when failed frame reconstruction already released its lease', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    let owner: InteractiveLease
    owner = lease('- active', {
      currentFrame: () => {
        releaseInteractiveLease(target, owner)
        throw new Error('frame unavailable')
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(write).toHaveBeenCalledWith('persisted\n')
  })

  it('drops an outdated cosmetic frame when preflight demotes and writes a direct line', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const currentFrame = vi.fn(() => '- active')
    let owner: InteractiveLease
    const prepareFrame = vi.fn(() => {
      releaseInteractiveLease(target, owner)
      return false
    })
    owner = {
      currentFrame,
      prepareFrame,
      stopAfterRenderFailure: vi.fn(),
    }
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(prepareFrame).toHaveBeenCalledOnce()
    expect(currentFrame).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('persisted\n')
  })

  it('writes a permanent line directly when frame reconstruction releases its lease', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    let owner: InteractiveLease
    owner = {
      currentFrame: () => {
        releaseInteractiveLease(target, owner)
        return '- stale'
      },
      stopAfterRenderFailure: vi.fn(),
    }
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(write).toHaveBeenCalledWith('persisted\n')
  })

  it('does not flush a pending frame after geometry preflight demotes it', () => {
    const writes: string[] = []
    let drainListener: (() => void) | undefined
    let allowFrame = true
    let target: RenderTarget
    let owner: InteractiveLease
    const didWriteFrame = vi.fn()
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn(),
      write: vi.fn((value: string) => {
        writes.push(value)
        return false
      }),
    }
    target = resolveRenderTarget(stream as unknown as Writable)
    owner = lease('- active', {
      didWriteFrame,
      prepareFrame: () => {
        if (allowFrame) return true
        releaseInteractiveLease(target, owner)
        return false
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame-0')).toBe(true)
    expect(didWriteFrame).toHaveBeenCalledOnce()
    expect(writeInteractiveFrame(target, owner, 'frame-1')).toBe(true)
    expect(didWriteFrame).toHaveBeenCalledOnce()

    allowFrame = false
    drainListener?.()
    expect(writes).toEqual(['frame-0'])
    expect(didWriteFrame).toHaveBeenCalledOnce()
  })

  it('notifies an accepted backpressured frame before waiting for drain', () => {
    let drainListener: (() => void) | undefined
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => false),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)
    const didWriteFrame = vi.fn()
    const owner = lease('- active', { didWriteFrame })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(true)
    expect(didWriteFrame).toHaveBeenCalledOnce()
    expect(drainListener).toEqual(expect.any(Function))
  })

  it('does not make flush wait for cosmetic-only backpressure', async () => {
    let drainListener: (() => void) | undefined
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => false),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)
    const owner = lease()
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(true)
    await expect(flushTarget(target)).resolves.toBeUndefined()
    expect(drainListener).toEqual(expect.any(Function))
  })

  it('registers drain after accepted frame bookkeeping releases its lease', () => {
    const stream = {
      on: vi.fn(),
      removeListener: vi.fn(),
      write: vi.fn(() => false),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)
    let owner: InteractiveLease
    owner = lease('- active', {
      didWriteFrame: () => releaseInteractiveLease(target, owner),
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(true)
    expect(stream.on).toHaveBeenCalledWith('drain', expect.any(Function))
    const retry = lease('- retry')
    owners.push([target, retry])
    expect(acquireInteractiveLease(target, retry)).toBe(true)
  })

  it('contains geometry and frame-notification hook failures', () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const preflightFailure = lease('- active', {
      prepareFrame: () => {
        throw new Error('geometry unavailable')
      },
    })
    owners.push([target, preflightFailure])

    expect(acquireInteractiveLease(target, preflightFailure)).toBe(true)
    expect(writeInteractiveFrame(target, preflightFailure, 'frame')).toBe(false)
    expect(write).not.toHaveBeenCalled()
    expect(preflightFailure.stopAfterRenderFailure).toHaveBeenCalledOnce()

    const rejectedPreflight = lease('- active', { prepareFrame: () => false })
    owners.push([target, rejectedPreflight])
    expect(acquireInteractiveLease(target, rejectedPreflight)).toBe(true)
    expect(writeInteractiveFrame(target, rejectedPreflight, 'frame')).toBe(false)
    expect(rejectedPreflight.stopAfterRenderFailure).toHaveBeenCalledOnce()

    const notificationFailure = lease('- active', {
      didWriteFrame: () => {
        throw new Error('frame bookkeeping unavailable')
      },
    })
    owners.push([target, notificationFailure])
    expect(acquireInteractiveLease(target, notificationFailure)).toBe(true)
    expect(writeInteractiveFrame(target, notificationFailure, 'frame')).toBe(false)
    expect(write).toHaveBeenCalledWith('frame')
    expect(notificationFailure.stopAfterRenderFailure).toHaveBeenCalledOnce()
  })

  it('stops the owning renderer after a synchronous coordinated write failure', () => {
    const write = vi.fn(() => {
      throw new Error('target unavailable')
    })
    const target = createTarget(write)
    const owner = lease()
    owners.push([target, owner])

    acquireInteractiveLease(target, owner)
    expect(writeCoordinatedLine(target, 'flow\n')).toBe(false)
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith('\x1b[2K\rflow\n- active')

    releaseInteractiveLease(target, owner)
    expect(writeCoordinatedLine(target, 'plain\n')).toBe(false)
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
  })

  it('fails only its owner when a backpressured target cannot register drain', () => {
    const stream = {
      on: vi.fn(() => {
        throw new Error('drain listeners unavailable')
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => false),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)
    const owner = lease()
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(false)
    expect(stream.on).toHaveBeenCalledWith('drain', expect.any(Function))
    expect(stream.removeListener).toHaveBeenCalledWith('drain', expect.any(Function))
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()

    const retry = lease('- retry')
    owners.push([target, retry])
    expect(acquireInteractiveLease(target, retry)).toBe(true)
  })

  it('rejects flush waiters when queued permanent output later fails', async () => {
    let drainListener: (() => void) | undefined
    let writes = 0
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => {
        writes += 1
        if (writes === 1) return false
        throw new Error('target unavailable')
      }),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)

    expect(writeTarget(target, 'first\n')).toBe(true)
    expect(writeTarget(target, 'second\n')).toBe(true)
    const pending = flushTarget(target)
    drainListener?.()
    await expect(pending).rejects.toThrow('spinlog target write failed')
  })

  it('rejects re-entrant cleanup writes when a target cannot register drain', () => {
    let target: RenderTarget
    const stream = {
      on: vi.fn(() => {
        throw new Error('drain listeners unavailable')
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => false),
    }
    target = resolveRenderTarget(stream as unknown as Writable)
    let owner: InteractiveLease
    owner = lease('- active', {
      stopAfterRenderFailure: () => {
        acquireInteractiveLease(target, owner)
        writeInteractiveFrame(target, owner, 'cleanup')
        writeTarget(target, 'cleanup\n')
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(false)
    expect(stream.write).toHaveBeenCalledTimes(1)
  })

  it('bounds queued permanent output and reports the overflow through flush', async () => {
    let drainListener: (() => void) | undefined
    let firstWrite = true
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => {
        if (firstWrite) {
          firstWrite = false
          return false
        }
        return true
      }),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    for (let index = 0; index < 64; index += 1) {
      expect(writeTarget(target, `queued-${index}\n`)).toBe(true)
    }
    expect(writeTarget(target, 'overflow\n')).toBe(false)
    await expect(flushTarget(target)).rejects.toMatchObject({ name: 'SpinlogBackpressureError' })
    drainListener?.()
  })

  it('writes a permanent task larger than the backlog byte limit when the target is ready', async () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const output = 'x'.repeat(64 * 1024 + 1)

    expect(writeTarget(target, output)).toBe(true)
    expect(write).toHaveBeenCalledWith(output)
    await expect(flushTarget(target)).resolves.toBeUndefined()
  })

  it('waits for a successful write callback even when write returns true', async () => {
    let complete: (() => void) | undefined
    const stream = new Writable({
      highWaterMark: 1024,
      write(_chunk, _encoding, callback) {
        complete = callback
      },
    })
    const target = resolveRenderTarget(stream)

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    let settled = false
    const pending = flushTarget(target).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    expect(stream.listenerCount('error')).toBe(1)
    complete?.()
    await pending

    expect(stream.listenerCount('drain')).toBe(0)
    expect(stream.listenerCount('finish')).toBe(0)
    expect(stream.listenerCount('close')).toBe(0)
    expect(stream.listenerCount('error')).toBe(0)
  })

  it('settles a flush watermark without waiting for permanent output accepted afterward', async () => {
    const callbacks: Array<() => void> = []
    const stream = new Writable({
      highWaterMark: 1024,
      write(_chunk, _encoding, callback) {
        callbacks.push(callback)
      },
    })
    const target = resolveRenderTarget(stream)

    expect(writeTarget(target, 'first\n')).toBe(true)
    const firstFlush = flushTarget(target)
    expect(writeTarget(target, 'second\n')).toBe(true)

    callbacks.shift()?.()
    await expect(firstFlush).resolves.toBeUndefined()

    let secondSettled = false
    const secondFlush = flushTarget(target).then(() => {
      secondSettled = true
    })
    await Promise.resolve()
    expect(secondSettled).toBe(false)
    callbacks.shift()?.()
    await secondFlush
  })

  it('keeps an earlier flush watermark through re-entrant permanent reordering', async () => {
    const callbacks: Array<() => void> = []
    const stream = {
      on: vi.fn(),
      removeListener: vi.fn(),
      write: vi.fn((_value: string, callback?: (error?: Error | null) => void) => {
        callbacks.push(() => callback?.())
        return true
      }),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)
    let firstPass = true
    let watermark: Promise<void> | undefined
    let owner: InteractiveLease
    owner = lease('- active', {
      prepareFrame: () => {
        if (!firstPass) return true
        firstPass = false
        watermark = flushTarget(target)
        releaseInteractiveLease(target, owner)
        expect(writeTarget(target, 're-entrant\n')).toBe(true)
        return false
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'original\n')).toBe(true)
    if (watermark === undefined) throw new Error('expected the re-entrant flush to be captured')

    let settled = false
    const pending = watermark.then(() => {
      settled = true
    })
    callbacks.shift()?.()
    await Promise.resolve()
    expect(settled).toBe(false)

    callbacks.shift()?.()
    await pending
    expect(stream.write.mock.calls.map(([value]) => value)).toEqual(['re-entrant\n', 'original\n'])
  })

  it('rejects pending output on a target error and removes its temporary error listener', async () => {
    let complete: (() => void) | undefined
    const stream = new Writable({
      autoDestroy: false,
      write(_chunk, _encoding, callback) {
        // Keep the accepted write pending until the target emits an error.
        complete = callback
      },
    })
    const hostErrors = vi.fn()
    stream.on('error', hostErrors)
    const target = resolveRenderTarget(stream)
    const cause = new Error('target failed')

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    const pending = flushTarget(target)
    stream.emit('error', cause)

    await expect(pending).rejects.toMatchObject({
      name: 'SpinlogTargetError',
      cause,
    })
    expect(hostErrors).toHaveBeenCalledWith(cause)
    expect(stream.listenerCount('error')).toBe(1)
    expect(stream.listenerCount('finish')).toBe(0)
    expect(stream.listenerCount('close')).toBe(0)

    // A callback retained by a failed target is stale and must be harmless.
    complete?.()
  })

  it('replays an unobserved target error to the next flush once', async () => {
    const stream = new Writable({
      autoDestroy: false,
      write() {
        // The error below ends Spinlog ownership of this accepted output.
      },
    })
    const hostErrors = vi.fn()
    stream.on('error', hostErrors)
    const target = resolveRenderTarget(stream)
    const cause = new Error('target failed before flush')

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    stream.emit('error', cause)

    await expect(flushTarget(target)).rejects.toMatchObject({
      name: 'SpinlogTargetError',
      cause,
    })
    await expect(flushTarget(target)).resolves.toBeUndefined()
    expect(hostErrors).toHaveBeenCalledWith(cause)
  })

  it('rejects a pending flush once when a write callback reports an error', async () => {
    let complete: ((error?: Error | null) => void) | undefined
    const stream = new Writable({
      autoDestroy: false,
      write(_chunk, _encoding, callback) {
        complete = callback
      },
    })
    const hostErrors = vi.fn()
    stream.on('error', hostErrors)
    const target = resolveRenderTarget(stream)
    const cause = new Error('write callback failed')

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    const pending = flushTarget(target)
    complete?.(cause)

    await expect(pending).rejects.toMatchObject({
      name: 'SpinlogTargetError',
      cause,
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(hostErrors).toHaveBeenCalledWith(cause)
    expect(stream.listenerCount('error')).toBe(1)
  })

  it('handles a synchronous callback error without an accompanying error event', async () => {
    const stream = new EventEmitter()
    const cause = new Error('synchronous callback failed')
    const write = vi.fn((_value: string, callback?: (error?: Error | null) => void) => {
      callback?.(cause)
      return true
    })
    Object.assign(stream, { write })
    const target = resolveRenderTarget(stream as unknown as Writable)

    expect(writeTarget(target, 'accepted\n')).toBe(false)
    const staleError = stream.listeners('error').at(0) as ((error: Error) => void) | undefined

    await expect(flushTarget(target)).rejects.toMatchObject({
      name: 'SpinlogTargetError',
      cause,
    })
    await Promise.resolve()
    staleError?.(new Error('stale error'))

    expect(stream.listenerCount('error')).toBe(0)
    expect(stream.listenerCount('finish')).toBe(0)
    expect(stream.listenerCount('close')).toBe(0)
  })

  it('abandons a delayed callback after permanent frame bookkeeping fails', async () => {
    let complete: (() => void) | undefined
    const stream = new EventEmitter()
    const write = vi.fn((_value: string, callback?: (error?: Error | null) => void) => {
      complete = callback
      return true
    })
    Object.assign(stream, { write })
    const target = resolveRenderTarget(stream as unknown as Writable)
    const owner = lease('- active', {
      didWriteFrame: () => {
        throw new Error('frame bookkeeping failed')
      },
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(false)
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()

    complete?.()
    await expect(flushTarget(target)).resolves.toBeUndefined()
    expect(stream.listenerCount('error')).toBe(0)
  })

  it('settles a backpressured flush when the target finishes normally', async () => {
    const stream = new Writable({
      highWaterMark: 1,
      write(_chunk, _encoding, callback) {
        queueMicrotask(callback)
      },
    })
    const target = resolveRenderTarget(stream)

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    const pending = flushTarget(target)
    const finished = once(stream, 'finish')
    stream.end()

    await expect(pending).resolves.toBeUndefined()
    await finished
    expect(stream.listenerCount('drain')).toBe(0)
    expect(stream.listenerCount('finish')).toBe(0)
    expect(stream.listenerCount('close')).toBe(0)
  })

  it('rejects queued output when a backpressured target finishes before it can be written', async () => {
    const stream = new Writable({
      highWaterMark: 1,
      write(_chunk, _encoding, callback) {
        queueMicrotask(callback)
      },
    })
    const target = resolveRenderTarget(stream)

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    expect(writeTarget(target, 'never-written\n')).toBe(true)
    const pending = flushTarget(target)
    stream.end()

    await expect(pending).rejects.toMatchObject({ name: 'SpinlogTargetError' })
  })

  it('rejects a backpressured flush when the target closes prematurely', async () => {
    const stream = new Writable({
      highWaterMark: 1,
      write() {
        // Intentionally retain the callback until destroy closes the target.
      },
    })
    const target = resolveRenderTarget(stream)
    const owner = lease('- active', {
      stopAfterRenderFailure: vi.fn(() => {
        throw new Error('cleanup unavailable')
      }),
    })
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeTarget(target, 'accepted\n')).toBe(true)
    const pending = flushTarget(target)
    stream.destroy()

    await expect(pending).rejects.toMatchObject({ name: 'SpinlogTargetError' })
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
    expect(stream.listenerCount('drain')).toBe(0)
    expect(stream.listenerCount('finish')).toBe(0)
    expect(stream.listenerCount('close')).toBe(0)
  })

  it('resolves flush immediately for a live target without queued permanent output', async () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)
    const owner = lease()
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    await expect(flushTarget(target)).resolves.toBeUndefined()
  })

  it('settles an internal permanent task that deliberately renders no output', async () => {
    const write = vi.fn(() => true)
    const target = createTarget(write)

    expect(
      enqueuePermanentTask(targetState(target), {
        kind: 'permanent',
        bytes: 0,
        render: () => undefined,
      }),
    ).toBe(true)

    await expect(flushTarget(target)).resolves.toBeUndefined()
    expect(write).not.toHaveBeenCalled()
  })

  it('keeps a re-entrant flush pending while its accepted task is rendering', async () => {
    const target = createTarget(() => true)
    let pending: Promise<void> | undefined

    expect(
      enqueuePermanentTask(targetState(target), {
        kind: 'permanent',
        bytes: 0,
        render: () => {
          pending = flushTarget(target)
          return undefined
        },
      }),
    ).toBe(true)

    await expect(pending).resolves.toBeUndefined()
  })

  it('keeps a re-entrant flush pending while earlier permanent tasks remain queued', async () => {
    const target = createTarget(() => true)
    const state = targetState(target)
    let pending: Promise<void> | undefined
    state.draining = true

    expect(
      enqueuePermanentTask(state, {
        kind: 'permanent',
        bytes: 0,
        render: () => 'first\n',
        didWrite: () => {
          pending = flushTarget(target)
          return true
        },
      }),
    ).toBe(true)
    expect(
      enqueuePermanentTask(state, {
        kind: 'permanent',
        bytes: 0,
        render: () => 'second\n',
      }),
    ).toBe(true)
    state.draining = false

    expect(
      enqueuePermanentTask(state, {
        kind: 'permanent',
        bytes: 0,
        render: () => 'third\n',
      }),
    ).toBe(true)

    await expect(pending).resolves.toBeUndefined()
  })

  it('retains an earlier watermark behind later re-entrant permanent work', async () => {
    const target = createTarget(() => true)
    const state = targetState(target)
    state.sequence = 1
    state.permanent.push(
      { kind: 'permanent', bytes: 0, sequence: 2, render: () => 'later\n' },
      { kind: 'permanent', bytes: 0, sequence: 1, render: () => 'earlier\n' },
    )

    let settled = false
    const pending = flushTarget(target).then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    state.permanent.length = 0
    expect(writeTarget(target, 'recovery\n')).toBe(true)
    await pending
  })

  it('stops the active lease when a failed pending task has a different owner', async () => {
    let complete: (() => void) | undefined
    const stream = new EventEmitter()
    const write = vi.fn((_value: string, callback?: (error?: Error | null) => void) => {
      complete = callback
      return true
    })
    Object.assign(stream, { write })
    const target = resolveRenderTarget(stream as unknown as Writable)
    const active = lease('- active')
    const other = lease('- other')
    owners.push([target, active], [target, other])

    expect(acquireInteractiveLease(target, active)).toBe(true)
    expect(
      enqueuePermanentTask(targetState(target), {
        kind: 'permanent',
        bytes: 1,
        render: () => 'accepted\n',
        owner: () => other,
      }),
    ).toBe(true)
    const pending = flushTarget(target)
    stream.emit('error', new Error('target failed'))

    await expect(pending).rejects.toMatchObject({ name: 'SpinlogTargetError' })
    expect(active.stopAfterRenderFailure).toHaveBeenCalledOnce()
    expect(other.stopAfterRenderFailure).not.toHaveBeenCalled()
    complete?.()
  })

  it('stops a matching owner after a target error when its task has no failure hook', async () => {
    const stream = new EventEmitter()
    const write = vi.fn((_value: string, _callback?: (error?: Error | null) => void) => true)
    Object.assign(stream, { write })
    const target = resolveRenderTarget(stream as unknown as Writable)
    const owner = lease('- active')
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(
      enqueuePermanentTask(targetState(target), {
        kind: 'permanent',
        bytes: 1,
        render: () => 'accepted\n',
        owner: () => owner,
      }),
    ).toBe(true)
    const pending = flushTarget(target)
    stream.emit('error', new Error('target failed'))

    await expect(pending).rejects.toMatchObject({ name: 'SpinlogTargetError' })
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
  })

  it('stops a matching owner after close when its task has no failure hook', async () => {
    const stream = new EventEmitter()
    const write = vi.fn((_value: string, _callback?: (error?: Error | null) => void) => true)
    Object.assign(stream, { write })
    const target = resolveRenderTarget(stream as unknown as Writable)
    const owner = lease('- active')
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(
      enqueuePermanentTask(targetState(target), {
        kind: 'permanent',
        bytes: 1,
        render: () => 'accepted\n',
        owner: () => owner,
      }),
    ).toBe(true)
    const pending = flushTarget(target)
    stream.emit('close')

    await expect(pending).rejects.toMatchObject({ name: 'SpinlogTargetError' })
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
  })

  it('coalesces frames through drain, ignores stale callbacks, and preserves permanent output', () => {
    const writes: string[] = []
    const results = [false, true, false, false, false]
    let drainListener: (() => void) | undefined
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn((_event: string, listener: () => void) => {
        if (drainListener === listener) drainListener = undefined
      }),
      write: vi.fn((value: string) => {
        writes.push(value)
        return results.shift() ?? true
      }),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)
    const owner = lease()
    owners.push([target, owner])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame-0')).toBe(true)
    const staleListener = drainListener
    expect(writeInteractiveFrame(target, owner, 'frame-1')).toBe(true)
    drainListener?.()
    expect(writes).toEqual(['frame-0', 'frame-1'])
    staleListener?.()
    expect(writes).toEqual(['frame-0', 'frame-1'])

    expect(writeInteractiveFrame(target, owner, 'frame-2')).toBe(true)
    drainListener?.()
    expect(writes).toEqual(['frame-0', 'frame-1', 'frame-2'])

    expect(writeInteractiveFrame(target, owner, 'frame-3')).toBe(true)
    expect(writeCoordinatedLine(target, 'persisted\n')).toBe(true)
    expect(writes).toEqual(['frame-0', 'frame-1', 'frame-2', 'frame-3'])
    drainListener?.()
    expect(writes).toEqual([
      'frame-0',
      'frame-1',
      'frame-2',
      'frame-3',
      '\x1b[2K\rpersisted\n- active',
    ])
  })

  it('ignores stale finish and close callbacks after drain recovery', async () => {
    const listeners = new Map<string, () => void>()
    let writeCallback: ((error?: Error | null) => void) | undefined
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener)
      }),
      removeListener: vi.fn(),
      write: vi.fn((_value: string, callback?: (error?: Error | null) => void) => {
        writeCallback = callback
        return false
      }),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    const pending = flushTarget(target)
    const staleFinish = listeners.get('finish')
    const staleClose = listeners.get('close')

    listeners.get('drain')?.()
    writeCallback?.()
    staleFinish?.()
    staleClose?.()

    await expect(pending).resolves.toBeUndefined()
    expect(stream.write).toHaveBeenCalledOnce()
  })

  it('does not flush an obsolete pending frame after re-entrant stream cleanup', () => {
    const write = vi.fn(() => false)
    let target: RenderTarget
    let first: InteractiveLease
    let drainListener: (() => void) | undefined
    let replaced = false
    const replacement = lease('- replacement')
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'drain') drainListener = listener
      }),
      removeListener: vi.fn(() => {
        if (replaced) return
        replaced = true
        releaseInteractiveLease(target, first)
        expect(acquireInteractiveLease(target, replacement)).toBe(true)
      }),
      write,
    }
    target = resolveRenderTarget(stream as unknown as Writable)
    first = lease()
    owners.push([target, first], [target, replacement])

    expect(acquireInteractiveLease(target, first)).toBe(true)
    expect(writeInteractiveFrame(target, first, 'obsolete')).toBe(true)
    drainListener?.()
    expect(write).toHaveBeenCalledOnce()
  })

  it('does not stop a replacement owner after re-entrant drain registration failure', () => {
    const write = vi.fn(() => false)
    let target: RenderTarget
    let owner: InteractiveLease
    const replacement = lease('- replacement')
    const stream = {
      on: vi.fn(() => {
        releaseInteractiveLease(target, owner)
        expect(acquireInteractiveLease(target, replacement)).toBe(true)
        throw new Error('target closed during registration')
      }),
      removeListener: vi.fn(),
      write,
    }
    target = resolveRenderTarget(stream as unknown as Writable)
    owner = lease()
    owners.push([target, owner], [target, replacement])

    expect(acquireInteractiveLease(target, owner)).toBe(true)
    expect(writeInteractiveFrame(target, owner, 'frame')).toBe(false)
    expect(owner.stopAfterRenderFailure).not.toHaveBeenCalled()
  })
})
