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
import { type RenderTarget, resolveRenderTarget } from '../src/text.js'

function lease(frame = '- active', hooks: Partial<InteractiveLease> = {}) {
  return {
    currentFrame: () => frame,
    stopAfterRenderFailure: vi.fn(),
    ...hooks,
  } satisfies InteractiveLease
}

function createTarget(write: (value: string) => boolean) {
  const stream = { write }
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
    stream.end()

    await expect(pending).resolves.toBeUndefined()
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
    const stream = {
      on: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener)
      }),
      removeListener: vi.fn(),
      write: vi.fn(() => false),
    }
    const target = resolveRenderTarget(stream as unknown as Writable)

    expect(writeTarget(target, 'accepted\n')).toBe(true)
    const pending = flushTarget(target)
    const staleFinish = listeners.get('finish')
    const staleClose = listeners.get('close')

    listeners.get('drain')?.()
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
