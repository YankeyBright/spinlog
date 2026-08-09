# `harness/loops.md` (The Autonomous Engine)

When executing a task, you MUST follow this strict 5-gate verification loop internally before presenting code or marking tasks complete.

---

## The 5 Gates (spinlog-specific)

### 1. Context Gate
Did I load the exact required docs for `spinlog`?

**Checklist:**
- [ ] Loaded `docs/phase-map.md` and the specification for the phase being changed
- [ ] Loaded `specs/01_PROJECT_MANIFEST.md` (zero-dep, 1,228B, ESM-only, Node >= 18)
- [ ] Loaded `specs/08_SECURITY_COMPLIANCE.md` (SSDF mapping, OIDC provenance, SBOM v1.5)
- [ ] Loaded `harness/invariants.md` (exact runnable gates)
- [ ] For Phase 2 runtime work, loaded `specs/05_TERMINAL_SPEC.md` and `specs/06_CORE_API_SPEC.md`

*Proof requirement:* For volatile external tooling or standards, consult the official primary documentation and record the version-sensitive conclusion in the implementation notes.

---

### 2. Invariant Gate
Does this code violate ANY rule in `harness/invariants.md`?
Run the checks that own the current phase before presenting code. All must exit 0.

```bash
npm run check:phase-map
npm run policy:check
npm run check:phase0

# Phase 1 package-shell work
npm run check:phase1

# Node >=20.18 supply-chain work
npm run check:phases
```

Phase 2 runtime work must additionally run behavior tests for stream discipline, terminal restoration, non-TTY behavior, and lifecycle cleanup. Foundation work must not require runtime files that do not exist yet.

*If any applicable check fails, loop back and fix. Do not present code.*

---

### 3. Execution Gate
Did I actually run the Proof Command from `harness/plan.md`?
**Rule:** You may NOT say "it should work". You must run the Proof Command and paste REAL terminal output.

*Example for task 1.2:*
```bash
npm run typecheck
npm run build
node scripts/check-phase1.mjs
```

*Example for task 2.3 after runtime implementation begins:*
```bash
npm run test -- test/spinner.test.ts
npm run test:coverage
```

**What to paste in response:**
```text
[Proof Command] $ npm run check:phase-map
[Output] phase-map=pass
[Result] PASS phase taxonomy
```
*If you cannot paste real output, you have NOT passed.*

---

### 4. Security Gate (spinlog Security Test)
Verify the controls implemented in the current phase:
- [ ] **Foundation Boundary:** `npm run check:phase-map` and `npm run check:phase0` pass.
- [ ] **Package Safety:** `npm run policy:check` proves zero runtime/optional/peer dependencies and no lifecycle scripts.
- [ ] **Supply Chain Safety:** On Node >=20.18, `npm run check:phase1:release` proves the runtime-only SBOM has zero components and release workflows use OIDC without long-lived npm tokens.
- [ ] **Runtime Safety (Phase 2 onward):** Behavior tests prove cursor restoration, non-TTY degradation, stderr-only cosmetic output, and timer/signal cleanup.

*If any security check fails, you MUST loop back.*

---

### 5. SRR Gate (Small, Reversible, Reviewable)
- [ ] Is the change set scoped to the requested outcome? *(Coordinated multi-file hardening is allowed when the user authorizes it.)*
- [ ] Can this be reverted with `git revert` in one commit?
- [ ] Is diff < 200 lines?
- [ ] Did you run the phase's proof command, plus `npm run build` and `npm run test` when source or toolchain behavior changed?

*If NO to any, split the task.*

---

## Completion Protocol

Once all 5 gates PASS:
1. Write real proof outputs into `harness/implementation-notes.md`:
   ```markdown
   ## Task 1.2 - deterministic builds
   - Context Gate: loaded `docs/phase-map.md` and the Phase 1 specification
   - Invariant Gate: `npm run check:phase-map` passed
   - Execution Gate: `npm run build` emitted ESM JavaScript and declarations
   - Security Gate: package policy and publish allowlist passed
   - SRR Gate: scoped toolchain change, reversible
   ```
2. Mark task `[x]` in `harness/plan.md` ONLY after pasting proof output above it.
3. Await user approval. Do NOT proceed to next task until approved.

> **Anti-Hallucination Rule:** If you write "looks good!" or "should work" without a Proof Command output, you have violated the loop. Go back to Gate 3.
