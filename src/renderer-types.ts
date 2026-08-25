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
  readonly resolve: () => void
  readonly reject: (reason: Error) => void
}

export interface TargetState {
  readonly target: RenderTarget
  lease: InteractiveLease | undefined
  blocked: boolean
  drainListener: (() => void) | undefined
  finishListener: (() => void) | undefined
  closeListener: (() => void) | undefined
  permanent: OutputTask[]
  permanentBytes: number
  inFlightPermanent: OutputTask | undefined
  cosmetic: OutputTask | undefined
  waiters: FlushWaiter[]
  overflow: Error | undefined
  draining: boolean
  rejectingWrites: boolean
}
