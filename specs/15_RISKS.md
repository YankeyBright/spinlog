# Risks And Mitigations

## Stream Write Failure

**Risk:** stderr becomes unavailable during cosmetic output.

**Mitigation:** Catch synchronous writes, clear the active timer, attempt cursor restoration, move an active cycle to `stopped`, preserve terminal state and wrapped promise settlement, and permit explicit retry. Do not install a global stream error listener.

## Terminal Control Injection

**Risk:** User-controlled spinner fields contain line breaks, ANSI, OSC, or other terminal control characters.

**Mitigation:** Strip VT sequences and normalize remaining controls only at the rendering boundary. Preserve assigned values, keep output single-line, and use the spinner color option rather than embedded styling.

## Host Shutdown Interference

**Risk:** A composable library changes signal defaults or preempts application cleanup.

**Mitigation:** Install no process-lifecycle listener and invoke no termination API. Explicit spinner methods own cleanup; the application owns shutdown policy.

## Abrupt Cursor Leakage

**Risk:** An uncatchable termination can occur while the interactive cursor is hidden.

**Mitigation:** Restore in every explicit lifecycle path, keep process ownership with the application, document the limitation, and avoid claiming cleanup for uncatchable termination.

## Unicode False Positive

**Risk:** A terminal renders braille or status symbols incorrectly.

**Mitigation:** Provide a line spinner and ASCII statuses. On Windows, require `WT_SESSION` before selecting Unicode automatically.

## Nested Color Bleed

**Risk:** Closing an inner style resets its enclosing style.

**Mitigation:** Reopen the parent style after an inner close and behavior-test nested foreground, background, modifier, and reset combinations.

## Timer Leak

**Risk:** An active interval keeps the process alive or continues rendering after settlement.

**Mitigation:** Centralize cleanup and prove every stop and terminal transition clears the timer. Never create a timer in non-interactive execution.

## Contract Drift

**Risk:** Documentation, declarations, and checkers evolve into different APIs.

**Mitigation:** Keep one closed JSON behavior model, deterministically project the declaration contract, reject extra and missing surface, and mutation-test the policy validator.

## Size Creep

**Risk:** The runtime grows beyond the frozen 2,560-byte gzip ceiling.

**Mitigation:** Enforce the exact level-9 gzip limit in CI and through an independent Size Limit check. The final pre-publication contract was revised to 2,560 bytes only after deterministic runtime validation, the style-only subpath, and the direct build measured 2,279 bytes; future expansion must revise Phase 0 rather than bypassing either gate.

## Release Workflow Compromise

**Risk:** Build infrastructure is modified even though publishing uses OIDC.

**Mitigation:** Keep publication technically absent until Phase 5. Then pin actions to immutable commits, minimize permissions, disable persisted checkout credentials, protect the release environment, prohibit long-lived publish tokens, and verify provenance after publication.
