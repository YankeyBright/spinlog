import type { Writable } from 'node:stream'

import type { InteractiveLease, OutputTask, TargetState } from './renderer-types.js'
import type { RenderTarget } from './text.js'
import { writeToTarget } from './text.js'

const MAX_PENDING_PERMANENT_LINES = 64
const MAX_PENDING_PERMANENT_BYTES = 64 * 1024

/** Output is scheduled independently for each Writable identity. */
const targets = new WeakMap<Writable, TargetState>()

export function acquireTargetLease(target: RenderTarget, lease: InteractiveLease): boolean {
  const state = getTargetState(target)
  if (state.lease === undefined) {
    state.lease = lease
    return true
  }
  return state.lease === lease
}

export function releaseTargetLease(target: RenderTarget, lease: InteractiveLease): void {
  const state = targets.get(target.stream)
  if (state?.lease !== lease) return
  state.lease = undefined
  settleIfIdle(state)
}

export function flushTargetQueue(target: RenderTarget): Promise<void> {
  const state = targets.get(target.stream)
  if (state === undefined) return Promise.resolve()
  if (state.overflow !== undefined) {
    const error = state.overflow
    state.overflow = undefined
    settleIfIdle(state)
    return Promise.reject(error)
  }
  if (!state.blocked && state.permanent.length === 0 && state.inFlightPermanent === undefined) {
    settleIfIdle(state)
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => state.waiters.push({ resolve, reject }))
}

export function enqueuePermanentTask(state: TargetState, task: OutputTask): boolean {
  if (state.rejectingWrites) return false

  // A ready target does not buffer its first task. Attempting that write before
  // applying backlog limits keeps the queue bound from becoming an input-size cap.
  const canWriteImmediately =
    !state.blocked &&
    !state.draining &&
    state.permanent.length === 0 &&
    state.inFlightPermanent === undefined
  if (!canWriteImmediately && exceedsPermanentLimit(state, task)) {
    overflow(state)
    task.fail?.()
    return false
  }

  state.permanent.push(task)
  state.permanentBytes += task.bytes
  return drainOutput(state)
}

export function enqueueCosmeticTask(state: TargetState, task: OutputTask): boolean {
  if (state.rejectingWrites) return false
  state.cosmetic = task
  return drainOutput(state)
}

export function targetState(target: RenderTarget): TargetState {
  return getTargetState(target)
}

function exceedsPermanentLimit(state: TargetState, task: OutputTask): boolean {
  const inFlightCount = state.inFlightPermanent === undefined ? 0 : 1
  const inFlightBytes = state.inFlightPermanent?.bytes ?? 0
  return (
    state.permanent.length + inFlightCount >= MAX_PENDING_PERMANENT_LINES ||
    state.permanentBytes + inFlightBytes + task.bytes > MAX_PENDING_PERMANENT_BYTES
  )
}

function getTargetState(target: RenderTarget): TargetState {
  const current = targets.get(target.stream)
  if (current !== undefined) return current
  const created: TargetState = {
    target,
    lease: undefined,
    blocked: false,
    drainListener: undefined,
    finishListener: undefined,
    closeListener: undefined,
    permanent: [],
    permanentBytes: 0,
    inFlightPermanent: undefined,
    cosmetic: undefined,
    waiters: [],
    overflow: undefined,
    draining: false,
    rejectingWrites: false,
  }
  targets.set(target.stream, created)
  return created
}

function drainOutput(state: TargetState): boolean {
  if (state.blocked || state.draining) return true
  let accepted = true
  state.draining = true
  try {
    while (!state.blocked) {
      const task = takeNextTask(state)
      if (task === undefined) break
      if (!processOutputTask(state, task)) accepted = false
    }
  } finally {
    state.inFlightPermanent = undefined
    state.draining = false
    settleIfIdle(state)
  }
  return accepted
}

function processOutputTask(state: TargetState, task: OutputTask): boolean {
  const queuedBeforeRender = state.permanent.length
  const value = task.render(state)
  state.inFlightPermanent = undefined

  if (task.defer?.()) {
    requeueDeferredTask(state, task, queuedBeforeRender)
    return true
  }
  if (value === undefined) return task.failed?.() !== true

  const result = writeToTarget(state.target, value)
  if (result.status === 'failed') {
    failTask(state, task, new Error('spinlog target write failed'))
    return false
  }
  if (task.didWrite?.() === false) {
    failTask(state, task, new Error('spinlog frame bookkeeping failed'))
    return false
  }
  if (result.status === 'backpressured') return startBackpressureWait(state, task)
  return true
}

function startBackpressureWait(state: TargetState, task: OutputTask): boolean {
  state.blocked = true
  if (waitForTargetReady(state)) return true
  failTask(state, task, new Error('spinlog target cannot wait for drain'), true)
  return false
}

function takeNextTask(state: TargetState): OutputTask | undefined {
  const permanent = state.permanent.shift()
  if (permanent !== undefined) {
    state.permanentBytes -= permanent.bytes
    state.inFlightPermanent = permanent
    return permanent
  }
  const cosmetic = state.cosmetic
  state.cosmetic = undefined
  return cosmetic
}

/** Keep re-entrant demotion output immediately before the deferred caller line. */
function requeueDeferredTask(
  state: TargetState,
  task: OutputTask,
  queuedBeforeRender: number,
): void {
  const reentrant = state.permanent.splice(queuedBeforeRender)
  state.permanent.unshift(...reentrant, task)
  state.permanentBytes += task.bytes
}

/** Stop only the lease that still owns this target, then discard unsafe work. */
function failTask(
  state: TargetState,
  task: OutputTask,
  error: Error,
  suppressReentrantOutput = false,
): void {
  const owner = task.owner?.()
  const ownsTarget = owner === undefined || state.lease === owner
  if (owner !== undefined && ownsTarget) state.lease = undefined
  clearPending(state)
  rejectWaiters(state, error)
  state.rejectingWrites = suppressReentrantOutput
  try {
    if (ownsTarget) task.fail?.()
  } finally {
    state.rejectingWrites = false
  }
}

function waitForTargetReady(state: TargetState): boolean {
  const drain = () => {
    if (state.drainListener !== drain) return
    removeBackpressureListeners(state)
    state.blocked = false
    drainOutput(state)
  }
  const finish = () => {
    if (state.finishListener !== finish) return
    const hasUnwrittenPermanent = state.permanent.length > 0
    terminateBlockedTarget(
      state,
      hasUnwrittenPermanent
        ? targetLifecycleError('finished before queued output could be written')
        : undefined,
    )
  }
  const close = () => {
    if (state.closeListener !== close) return
    terminateBlockedTarget(state, targetLifecycleError('closed before queued output drained'))
  }

  state.drainListener = drain
  state.finishListener = finish
  state.closeListener = close
  try {
    state.target.stream.on('drain', drain)
    state.target.stream.on('finish', finish)
    state.target.stream.on('close', close)
    return true
  } catch {
    removeBackpressureListeners(state)
    return false
  }
}

function terminateBlockedTarget(state: TargetState, error: Error | undefined): void {
  const lease = state.lease
  state.lease = undefined
  clearPending(state)
  if (lease !== undefined) failLease(lease)
  if (error === undefined) {
    resolveWaiters(state)
  } else {
    rejectWaiters(state, error)
  }
  settleIfIdle(state)
}

function targetLifecycleError(message: string): Error {
  const error = new Error(`spinlog target ${message}`)
  error.name = 'SpinlogTargetError'
  return error
}

function removeBackpressureListeners(state: TargetState): void {
  const listeners = [
    ['drain', state.drainListener],
    ['finish', state.finishListener],
    ['close', state.closeListener],
  ] as const
  state.drainListener = undefined
  state.finishListener = undefined
  state.closeListener = undefined
  for (const [event, listener] of listeners) {
    if (listener === undefined) continue
    try {
      state.target.stream.removeListener(event, listener)
    } catch {
      // A non-standard target must not prevent target-local cleanup.
    }
  }
}

function overflow(state: TargetState): void {
  const error = new Error(
    `spinlog target queue exceeded ${MAX_PENDING_PERMANENT_LINES} lines or ${MAX_PENDING_PERMANENT_BYTES} bytes`,
  )
  error.name = 'SpinlogBackpressureError'
  state.overflow = error
  rejectWaiters(state, error)
}

function clearPending(state: TargetState): void {
  removeBackpressureListeners(state)
  state.blocked = false
  state.permanent.length = 0
  state.permanentBytes = 0
  state.cosmetic = undefined
}

function rejectWaiters(state: TargetState, error: Error): void {
  for (const waiter of state.waiters.splice(0)) waiter.reject(error)
}

function resolveWaiters(state: TargetState): void {
  for (const waiter of state.waiters.splice(0)) waiter.resolve()
}

function failLease(lease: InteractiveLease): void {
  try {
    lease.stopAfterRenderFailure()
  } catch {
    // Cosmetic failures never take host application control flow.
  }
}

function settleIfIdle(state: TargetState): void {
  if (state.draining || state.inFlightPermanent !== undefined) return
  if (state.blocked || state.permanent.length > 0) return
  resolveWaiters(state)
  if (
    state.lease === undefined &&
    state.cosmetic === undefined &&
    state.drainListener === undefined &&
    state.finishListener === undefined &&
    state.closeListener === undefined
  ) {
    targets.delete(state.target.stream)
  }
}
