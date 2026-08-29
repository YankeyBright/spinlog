import type { Writable } from 'node:stream'

import type {
  InteractiveLease,
  OutputTask,
  TargetEvent,
  TargetListener,
  TargetState,
} from './renderer-types.js'
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

/**
 * Resolve after every permanent task accepted before this call has either
 * completed its Node write callback or been deliberately discarded.
 */
export function flushTargetQueue(target: RenderTarget): Promise<void> {
  const state = targets.get(target.stream)
  if (state === undefined) return Promise.resolve()
  if (state.failure !== undefined) {
    const error = state.failure
    state.failure = undefined
    settleIfIdle(state)
    return Promise.reject(error)
  }
  const watermark = state.sequence
  if (!hasPendingPermanentBefore(state, watermark)) {
    settleIfIdle(state)
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    state.waiters.push({ watermark, resolve, reject })
    settleFlushWaiters(state)
  })
}

export function enqueuePermanentTask(state: TargetState, task: OutputTask): boolean {
  if (state.rejecting) return false

  // A ready target does not buffer its first task. Attempting that write before
  // applying backlog limits keeps the queue bound from becoming an input-size cap.
  const canWriteImmediately =
    !state.blocked &&
    !state.draining &&
    state.permanent.length === 0 &&
    state.inFlight === undefined
  if (!canWriteImmediately && exceedsPermanentLimit(state, task)) {
    overflow(state)
    task.fail?.()
    return false
  }

  const sequence = state.sequence + 1
  state.sequence = sequence
  state.permanent.push({ ...task, sequence })
  state.queuedBytes += task.bytes
  return drainOutput(state)
}

export function enqueueCosmeticTask(state: TargetState, task: OutputTask): boolean {
  if (state.rejecting) return false
  // Frames are replaceable: retaining only the newest cosmetic task prevents
  // a slow stream from replaying stale animation after backpressure clears.
  state.cosmetic = task
  return drainOutput(state)
}

export function targetState(target: RenderTarget): TargetState {
  return getTargetState(target)
}

function exceedsPermanentLimit(state: TargetState, task: OutputTask): boolean {
  const inFlightCount = state.inFlight === undefined ? 0 : 1
  const inFlightBytes = state.inFlight?.bytes ?? 0
  return (
    state.permanent.length + inFlightCount >= MAX_PENDING_PERMANENT_LINES ||
    state.queuedBytes + inFlightBytes + task.bytes > MAX_PENDING_PERMANENT_BYTES
  )
}

function getTargetState(target: RenderTarget): TargetState {
  const current = targets.get(target.stream)
  if (current !== undefined) return current
  const created: TargetState = {
    target,
    lease: undefined,
    blocked: false,
    listeners: {},
    permanent: [],
    queuedBytes: 0,
    inFlight: undefined,
    sequence: 0,
    pending: new Set<OutputTask>(),
    awaitingError: false,
    cosmetic: undefined,
    waiters: [],
    failure: undefined,
    draining: false,
    rejecting: false,
  }
  targets.set(target.stream, created)
  return created
}

function drainOutput(state: TargetState): boolean {
  if (state.blocked || state.draining) return true
  let accepted = true
  state.draining = true
  try {
    // Permanent lines always win over the latest cosmetic frame so logs remain
    // ordered while an interactive surface is being rebuilt around them.
    while (!state.blocked) {
      const task = takeNextTask(state)
      if (task === undefined) break
      if (!processOutputTask(state, task)) accepted = false
    }
  } finally {
    state.inFlight = undefined
    state.draining = false
    settleIfIdle(state)
  }
  return accepted
}

function processOutputTask(state: TargetState, task: OutputTask): boolean {
  const queuedBeforeRender = state.permanent.length
  const value = task.render(state)

  if (task.defer?.()) {
    state.inFlight = undefined
    requeueDeferredTask(state, task, queuedBeforeRender)
    return true
  }
  if (value === undefined) {
    state.inFlight = undefined
    if (task.kind === 'permanent') settleFlushWaiters(state)
    return task.failed?.() !== true
  }

  if (task.kind === 'permanent') return processPermanentWrite(state, task, value)

  const result = writeToTarget(state.target, value)
  state.inFlight = undefined
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

function processPermanentWrite(state: TargetState, task: OutputTask, value: string): boolean {
  let result: ReturnType<typeof writeToTarget> | undefined
  let callbackError: Error | null | undefined
  state.pending.add(task)
  refreshTargetListeners(state)
  result = writeToTarget(state.target, value, (failure: Error | null = null) => {
    if (result === undefined) {
      callbackError = failure
      return
    }
    settlePermanentWrite(state, task, failure)
  })
  state.inFlight = undefined

  if (result.status === 'failed') {
    state.pending.delete(task)
    failTask(state, task, new Error('spinlog target write failed'))
    return false
  }

  if (callbackError !== undefined && !settlePermanentWrite(state, task, callbackError)) return false
  if (task.didWrite?.() === false) {
    failTask(state, task, new Error('spinlog frame bookkeeping failed'))
    return false
  }
  if (result.status === 'backpressured') return startBackpressureWait(state, task)
  refreshTargetListeners(state)
  return true
}

function settlePermanentWrite(
  state: TargetState,
  task: OutputTask,
  callbackError: Error | null,
): boolean {
  if (!state.pending.delete(task)) return true

  if (callbackError !== null) {
    // Node invokes a write callback before the matching error event. Keep a
    // temporary listener through the next microtask so that event is handled.
    state.awaitingError = true
    failTarget(state, targetWriteError(callbackError), task)
    queueMicrotask(() => {
      if (!state.awaitingError) return
      state.awaitingError = false
      refreshTargetListeners(state)
      settleIfIdle(state)
    })
    return false
  }

  settleFlushWaiters(state)
  refreshTargetListeners(state)
  settleIfIdle(state)
  return true
}

function startBackpressureWait(state: TargetState, task: OutputTask): boolean {
  state.blocked = true
  if (refreshTargetListeners(state)) return true
  failTask(state, task, new Error('spinlog target cannot wait for drain'), true)
  return false
}

function takeNextTask(state: TargetState): OutputTask | undefined {
  // The queue is FIFO for permanent output; at most one cosmetic frame follows
  // it, because cosmetic work is intentionally coalesced by enqueueCosmeticTask.
  const permanent = state.permanent.shift()
  if (permanent !== undefined) {
    state.queuedBytes -= permanent.bytes
    state.inFlight = permanent
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
  state.queuedBytes += task.bytes
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
  discardUnsafeOutput(state)
  rejectWaiters(state, error)
  state.rejecting = suppressReentrantOutput
  try {
    if (ownsTarget) task.fail?.()
  } finally {
    state.rejecting = false
  }
  settleIfIdle(state)
}

/** Handle an asynchronous stream error while Spinlog still owns output work. */
function failTarget(state: TargetState, error: Error, task: OutputTask | undefined): void {
  stopTarget(state, error, task, true, state.awaitingError)
}

function refreshTargetListeners(state: TargetState): boolean {
  const needsLifecycle = state.blocked || state.pending.size > 0 || state.awaitingError
  if (!needsLifecycle) {
    removeTargetListeners(state)
    return true
  }

  try {
    if (state.blocked) ensureDrainListener(state)
    else removeTargetListener(state, 'drain')
    ensureFinishListener(state)
    ensureCloseListener(state)
    ensureErrorListener(state)
    return true
  } catch {
    removeTargetListeners(state)
    // A target that cannot expose drain cannot safely accept backpressured work.
    return !state.blocked
  }
}

function ensureDrainListener(state: TargetState): void {
  if (state.listeners.drain !== undefined) return
  const drain = () => {
    if (state.listeners.drain !== drain) return
    removeTargetListener(state, 'drain')
    state.blocked = false
    drainOutput(state)
  }
  state.listeners.drain = drain
  addTargetListener(state, 'drain', drain)
}

function ensureFinishListener(state: TargetState): void {
  if (state.listeners.finish !== undefined) return
  const finish = () => {
    if (state.listeners.finish !== finish) return
    const hasUnwrittenPermanent = state.permanent.length > 0 || state.pending.size > 0
    if (hasUnwrittenPermanent) {
      terminateTarget(state, targetLifecycleError('finished before queued output could be written'))
      return
    }
    // A normal finish occurs after Node has completed accepted writes. Retain
    // the listener until any callback still visible to a non-standard target
    // settles, then target-local cleanup removes it.
    state.blocked = false
    removeTargetListener(state, 'drain')
    const lease = state.lease
    state.lease = undefined
    withRejectedWrites(state, () => failLease(lease))
    settleIfIdle(state)
  }
  state.listeners.finish = finish
  addTargetListener(state, 'finish', finish)
}

function ensureCloseListener(state: TargetState): void {
  if (state.listeners.close !== undefined) return
  const close = () => {
    if (state.listeners.close !== close) return
    terminateTarget(state, targetLifecycleError('closed before queued output drained'))
  }
  state.listeners.close = close
  addTargetListener(state, 'close', close)
}

function ensureErrorListener(state: TargetState): void {
  if (state.listeners.error !== undefined) return
  const error = (cause: Error) => {
    if (state.listeners.error !== error) return
    if (state.awaitingError) {
      state.awaitingError = false
      refreshTargetListeners(state)
      settleIfIdle(state)
      return
    }
    const task = state.pending.values().next().value
    failTarget(state, targetWriteError(cause), task)
  }
  state.listeners.error = error
  addTargetListener(state, 'error', error)
}

function addTargetListener(state: TargetState, event: TargetEvent, listener: TargetListener): void {
  state.target.stream.on(event, listener as never)
}

function terminateTarget(state: TargetState, error: Error): void {
  const task = state.inFlight ?? state.pending.values().next().value
  stopTarget(state, error, task, false, false)
}

function stopTarget(
  state: TargetState,
  error: Error,
  task: OutputTask | undefined,
  replayToNextFlush: boolean,
  retainErrorListener: boolean,
): void {
  const lease = state.lease
  const owner = task?.owner?.()
  state.lease = undefined
  discardUnsafeOutput(state)
  state.pending.clear()
  if (!retainErrorListener) state.awaitingError = false
  if (replayToNextFlush && state.waiters.length === 0) state.failure = error
  else rejectWaiters(state, error)
  withRejectedWrites(state, () => {
    if (lease !== undefined && owner !== lease) failLease(lease)
    task?.fail?.()
    if (lease !== undefined && owner === lease && task?.fail === undefined) failLease(lease)
  })
  if (retainErrorListener) refreshTargetListeners(state)
  else removeTargetListeners(state)
  settleIfIdle(state)
}

function targetWriteError(cause: Error): Error {
  const error = new Error('spinlog target write failed', { cause })
  error.name = 'SpinlogTargetError'
  return error
}

function targetLifecycleError(message: string): Error {
  const error = new Error(`spinlog target ${message}`)
  error.name = 'SpinlogTargetError'
  return error
}

function discardUnsafeOutput(state: TargetState): void {
  state.blocked = false
  removeTargetListener(state, 'drain')
  state.permanent.length = 0
  state.queuedBytes = 0
  state.inFlight = undefined
  state.cosmetic = undefined
  refreshTargetListeners(state)
}

function removeTargetListeners(state: TargetState): void {
  for (const event of ['drain', 'finish', 'close', 'error'] as const) {
    removeTargetListener(state, event)
  }
}

function removeTargetListener(state: TargetState, event: TargetEvent): void {
  const listener = state.listeners[event]
  delete state.listeners[event]
  if (listener === undefined) return
  try {
    state.target.stream.removeListener(event, listener as never)
  } catch {
    // A non-standard target must not prevent target-local cleanup.
  }
}

function overflow(state: TargetState): void {
  const error = new Error(
    `spinlog target queue exceeded ${MAX_PENDING_PERMANENT_LINES} lines or ${MAX_PENDING_PERMANENT_BYTES} bytes`,
  )
  error.name = 'SpinlogBackpressureError'
  state.failure = error
  rejectWaiters(state, error)
}

function rejectWaiters(state: TargetState, error: Error): void {
  for (const waiter of state.waiters.splice(0)) waiter.reject(error)
}

function settleFlushWaiters(state: TargetState): void {
  if (state.waiters.length === 0) return
  // Each waiter owns a sequence watermark, so output accepted after flush()
  // was called cannot delay that earlier promise.
  const pending = state.waiters.splice(0)
  for (const waiter of pending) {
    if (!hasPendingPermanentBefore(state, waiter.watermark)) waiter.resolve()
    else state.waiters.push(waiter)
  }
}

function hasPendingPermanentBefore(state: TargetState, watermark: number): boolean {
  const inFlight = state.inFlight
  if ((inFlight?.sequence ?? Infinity) <= watermark) {
    return true
  }
  for (const task of state.permanent) {
    if (Number(task.sequence) <= watermark) return true
  }
  for (const pending of state.pending) {
    if (Number(pending.sequence) <= watermark) return true
  }
  return false
}

function withRejectedWrites(state: TargetState, action: () => void): void {
  state.rejecting = true
  try {
    action()
  } finally {
    state.rejecting = false
  }
}

function failLease(lease: InteractiveLease | undefined): void {
  if (lease === undefined) return
  try {
    lease.stopAfterRenderFailure()
  } catch {
    // Cosmetic failures never take host application control flow.
  }
}

function settleIfIdle(state: TargetState): void {
  settleFlushWaiters(state)
  if (state.draining || state.inFlight !== undefined) return
  if (state.blocked || state.permanent.length > 0) return
  if (state.pending.size === 0 && !state.awaitingError) {
    refreshTargetListeners(state)
  }
  if (
    state.lease === undefined &&
    state.cosmetic === undefined &&
    state.pending.size === 0 &&
    !state.awaitingError &&
    Object.keys(state.listeners).length === 0 &&
    state.failure === undefined
  ) {
    // WeakMap cleanup is important for short-lived custom streams; no target
    // state should survive after all accepted work and listeners are gone.
    targets.delete(state.target.stream)
  }
}
