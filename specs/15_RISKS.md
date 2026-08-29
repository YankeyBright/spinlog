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

**Mitigation:** Restore in every explicit lifecycle path and through `Symbol.dispose`, keep process ownership with the application, document the limitation, and avoid claiming cleanup for uncatchable termination.

## Unicode False Positive

**Risk:** A terminal renders braille or status symbols incorrectly.

**Mitigation:** Provide a line spinner and ASCII statuses. On Windows, require `WT_SESSION` before selecting Unicode automatically.

## Nested Color Bleed

**Risk:** Closing an inner style resets its enclosing style.

**Mitigation:** Use one explicit ANSI metadata table for SGR codes, categories, and restoration strategy; behavior-test nested foreground, background, modifier, and reset combinations.

## External Stream Interleaving

**Risk:** An application writes directly to stderr while a spinner owns the interactive line.

**Mitigation:** Coordinate only spinlog-owned intro/outro, instance `spinner.log()`, and static lines. Do not monkey-patch host streams or install global listeners; document that applications use `spinner.log()` or settle active spinners before unrelated permanent output.

## Limited Terminal Profiles

**Risk:** `stderr.isTTY` identifies an attached terminal but does not prove cursor-control or SGR behavior.

**Mitigation:** Use a conservative profile allowlist for automatic animation and default SGR. Offer only an explicit, TTY-only `terminal: 'interactive'` caller assertion, retaining the `TERM=dumb` refusal and never enabling color from the override.

## Timer Leak

**Risk:** An active interval keeps the process alive or continues rendering after settlement.

**Mitigation:** Centralize cleanup and prove every stop and terminal transition clears the timer. Never create a timer in non-interactive execution.

## Contract Drift

**Risk:** Documentation, declarations, and checkers evolve into different APIs.

**Mitigation:** Keep one closed JSON behavior model, deterministically project the declaration contract, reject extra and missing surface, and mutation-test the policy validator.

## Size Creep

**Risk:** The runtime grows beyond the frozen 10,496-byte gzip ceiling.

**Mitigation:** Enforce the exact level-9 gzip limit in CI and through an independent Size Limit check. The ceiling was revised to 10,496 bytes for coordinated rendering, custom frames, groups, progress, terminal-width safety, bounded output queues, and the flush boundary; future expansion must revise Phase 0 rather than bypassing either gate.

## Release Workflow Compromise

**Risk:** Build infrastructure is modified even though publishing uses OIDC.

**Mitigation:** The Phase 5 bootstrap uses immutable action commits, minimum permissions, disabled persisted checkout credentials, GitHub artifact attestation, exact npm integrity comparison, and human 2FA for the one-time publish. Future releases use a protected environment and npm Trusted Publishing OIDC; stable promotion remains a separate policy change.
