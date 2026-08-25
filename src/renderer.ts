import {
  acquireTargetLease,
  enqueueCosmeticTask,
  enqueuePermanentTask,
  flushTargetQueue,
  releaseTargetLease,
  targetState,
} from './renderer-queue.js'
import type { InteractiveLease, OutputTask } from './renderer-types.js'
import { CLEAR_LINE } from './terminal-control.js'
import type { RenderTarget } from './text.js'

export type { InteractiveLease } from './renderer-types.js'

/** Acquire one interactive surface for a target. */
export function acquireInteractiveLease(target: RenderTarget, lease: InteractiveLease): boolean {
  return acquireTargetLease(target, lease)
}

/** Release an interactive surface only when it owns the supplied target. */
export function releaseInteractiveLease(target: RenderTarget, lease: InteractiveLease): void {
  releaseTargetLease(target, lease)
}

/** Resolve after already-accepted permanent output for a target has drained. */
export function flushTarget(target: RenderTarget): Promise<void> {
  return flushTargetQueue(target)
}

/** Write an active frame while coalescing superseded frames through backpressure. */
export function writeInteractiveFrame(
  target: RenderTarget,
  lease: InteractiveLease,
  value: string,
): boolean {
  const state = targetState(target)
  if (state.lease !== lease) return enqueuePermanentTask(state, rawTask(value))

  let failed = false
  return enqueueCosmeticTask(state, {
    kind: 'cosmetic',
    bytes: 0,
    render: (active) => {
      if (active.lease !== lease) return undefined
      if (!prepareLease(lease)) {
        if (active.lease === lease) {
          active.lease = undefined
          failLease(lease)
          failed = true
        }
        return undefined
      }
      return value
    },
    didWrite: () => notifyLease(lease),
    fail: () => failLease(lease),
    owner: () => lease,
    failed: () => failed,
  })
}

/** Insert a permanent line above only the interactive surface owned by target. */
export function writeCoordinatedLine(
  target: RenderTarget,
  value: string,
  onFailure?: () => void,
): boolean {
  const state = targetState(target)
  let reconstructedLease: InteractiveLease | undefined
  let deferred = false
  return enqueuePermanentTask(state, {
    kind: 'permanent',
    bytes: Buffer.byteLength(value),
    render: (active) => {
      const lease = active.lease
      if (lease === undefined) return value
      if (!prepareLease(lease)) {
        // A surface may write its static fallback while preflighting. Let that
        // re-entrant output settle before the caller's permanent line.
        if (active.lease !== lease) {
          deferred = true
          return undefined
        }
        return value
      }
      if (active.lease !== lease) return value
      try {
        const frame = lease.currentFrame()
        if (active.lease !== lease) return value
        reconstructedLease = lease
        return `${clearActiveFrame(active.target, lease)}${value}${frame}`
      } catch {
        if (active.lease === lease) {
          active.lease = undefined
          failLease(lease)
        }
        return value
      }
    },
    didWrite: () => reconstructedLease === undefined || notifyLease(reconstructedLease),
    fail: () => {
      if (reconstructedLease !== undefined) failLease(reconstructedLease)
      onFailure?.()
    },
    owner: () => reconstructedLease,
    defer: () => {
      const shouldDefer = deferred
      deferred = false
      return shouldDefer
    },
  })
}

/** Queue an ordered non-frame write for a target-owned lifecycle transition. */
export function writeTarget(target: RenderTarget, value: string, onFailure?: () => void): boolean {
  return enqueuePermanentTask(targetState(target), { ...rawTask(value), fail: onFailure })
}

/** Clear the supplied target surface before replacing its rendered contents. */
export function clearActiveFrame(_target: RenderTarget, lease: InteractiveLease): string {
  return lease.clearFrame?.() ?? CLEAR_LINE
}

function rawTask(value: string): OutputTask {
  return { kind: 'permanent', bytes: Buffer.byteLength(value), render: () => value }
}

function prepareLease(lease: InteractiveLease): boolean {
  try {
    return lease.prepareFrame?.() !== false
  } catch {
    return false
  }
}

function notifyLease(lease: InteractiveLease): boolean {
  try {
    lease.didWriteFrame?.()
    return true
  } catch {
    return false
  }
}

function failLease(lease: InteractiveLease): void {
  try {
    lease.stopAfterRenderFailure()
  } catch {
    // Cosmetic failures never take host application control flow.
  }
}
