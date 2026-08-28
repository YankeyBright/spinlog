import type { RenderTarget } from './text.js'

/** An interactive surface that owns one target's current physical frame. */
export interface InteractiveLease {
  currentFrame(): string
  /** Clears the complete owned surface and leaves the cursor at its first row. */
  clearFrame?(): string
  /**
   * Revalidate surface geometry before the next physical frame is accepted.
   * Return false after any required local demotion or lease release.
   */
  prepareFrame?(): boolean
  /** Called after a write containing this surface's frame has been accepted. */
  didWriteFrame?(): void
  stopAfterRenderFailure(): void
}

export interface OutputTask {
  readonly kind: 'permanent' | 'cosmetic'
  readonly bytes: number
  /** Assigned internally when a permanent task enters a target queue. */
  readonly sequence?: number
  readonly render: (state: TargetState) => string | undefined
  /** Returns false when accepted-frame bookkeeping has failed. */
  readonly didWrite?: () => boolean
  readonly fail?: () => void
  /** The interactive owner affected by this task, if one was captured. */
  readonly owner?: () => InteractiveLease | undefined
  /** True when rendering locally stopped the surface without a stream write. */
  readonly failed?: () => boolean
  /** True once when this task must yield to re-entrant demotion output. */
  readonly defer?: () => boolean
}

export interface FlushWaiter {
  /** The last permanent task accepted before this flush call. */
  readonly watermark: number
  readonly resolve: () => void
  readonly reject: (reason: Error) => void
}

export type TargetEvent = 'drain' | 'finish' | 'close' | 'error'
export type TargetListener = (...args: never[]) => void

export interface TargetState {
  readonly target: RenderTarget
  lease: InteractiveLease | undefined
  blocked: boolean
  listeners: Partial<Record<TargetEvent, TargetListener>>
  permanent: OutputTask[]
  queuedBytes: number
  inFlight: OutputTask | undefined
  /** Last monotonic sequence accepted for this target. */
  sequence: number
  /** Accepted permanent tasks whose Node write callback has not run. */
  pending: Set<OutputTask>
  /** Keeps an error listener through Node's callback-then-error ordering. */
  awaitingError: boolean
  cosmetic: OutputTask | undefined
  waiters: FlushWaiter[]
  /** An overflow or target error delivered once to the next flush when no waiter saw it. */
  failure: Error | undefined
  draining: boolean
  rejecting: boolean
}
