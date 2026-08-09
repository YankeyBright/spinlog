# Competitive Landscape & Dependency Economics

> Scope note: This is historical market research, not a source of truth for v1 scope or current competitor versions. Prompts, progress bars, task groups, intro/outro helpers, and structured logging are post-MVP opportunities only; `docs/mvp-contract.md` defines the v1 boundary.

## Market Segments

### A. Color Libraries

**chalk (v6.0.0, July 2026)**
- Now zero-dep, chainable API (`chalk.red.bold()`), TrueColor/RGB/HEX support
- Requires Node **22+**. Industry standard but high-value target (Sept 2025 compromise)
- Same maintainer as yoctocolors + ora — single point of failure for account takeover
- **What spinlog absorbs:** Nested color handling, NO_COLOR/FORCE_COLOR, bold/dim/underline/italic/strikethrough

**picocolors (Zero-dep)**
- Fastest benchmarks, ~3.5kB unpacked. Used by PostCSS, Stylelint
- **Color only** — no spinner, no tasks, no prompts. No SBOM/provenance
- **What spinlog absorbs:** Raw speed. Coloring must be essentially free in performance

**yoctocolors (Zero-dep, Sindre Sorhus)**
- "Yocto"-scale coloring. Tree-shakeable named exports. ESM-first
- Same author as chalk/ora — compromised account takes out entire stack
- **What spinlog absorbs:** Tree-shakeability. Individual color functions importable selectively

**ansis (Zero-dep)**
- TrueColor (RGB/HEX), nested template literals, chained syntax. Matches picocolors benchmarks
- Still color only. Lesser known
- **What spinlog absorbs:** Rich color features CAN coexist with speed

**Node.js `util.styleText` (Built-in, Node 22+)**
- Zero supply chain risk by definition. Respects NO_COLOR/FORCE_COLOR
- **Requires Node 22+**. No spinner, no animation, no prompts, no progress. Not tree-shakeable
- **Key insight:** Validates "colors don't need a library" thesis but leaves a vacuum for everything else

### B. Spinner Libraries

**ora (v9.4.1, July 2026)**
- The standard. Promise wrapping, 80+ spinner styles, dynamic text updates, prefix/suffix
- Requires Node **20+**. **8+ deps:** chalk, cli-cursor, cli-spinners, is-interactive, is-unicode-supported, log-symbols, stdin-discarder, string-width
- Same maintainer as chalk/yoctocolors — single point of failure
- **What spinlog absorbs:** Promise integration, dynamic mutations, succeed/fail/warn/info, prefix/suffix, CI degradation

**nanospinner (~1kB)**
- Tiniest spinner. CJS + ESM. TypeScript types
- **NOT truly zero-dep**: depends on `picocolors`. No state transitions, no promise wrapping, no color API
- **What spinlog absorbs:** Proof a spinner CAN be ~1kB. We ship colors too = strictly more complete

### C. Task Runners & Multi-Step CLI

**listr2 (v11.0.0, July 2026)**
- Full-featured: concurrent/sequential tasks, subtasks, rollback, retry, skip, interactive prompts
- Used by Angular CLI, Prisma. Multiple renderers. Type-safe context
- **5+ deps** including ansi-escapes, cli-truncate, colorette, eventemitter3, wrap-ansi. >70kB unpacked
- Overkill for most use cases. No SBOM/provenance
- **What spinlog absorbs:** Sequential task grouping. "Collapsing finished tasks" UX pattern. Task context passing

**tasuku (Minimal task runner)**
- Zero-config, "Vitest-like" clean output. Beautiful minimal aesthetic
- Limited features. No concurrent tasks, no rollback, no subtasks
- **What spinlog absorbs:** Most devs only need sequential tasks with clean output — not full listr2

### D. Interactive Prompts

**@clack/prompts (The Modern Standard)**
- Beautiful: text, password, confirm, select, multiselect, autocomplete, date picker, spinner
- Used by create-t3-app, create-next-app. Intro/outro flow. Built-in validation. TypeScript-first
- No built-in colors. No progress bars. No structured logging. Separate packages
- **What spinlog absorbs:** `confirm(y/n)` and `text` prompt patterns. Intro/outro flow concept

**inquirer / @inquirer/prompts**
- The original. Complex validation, nested prompts, plugin ecosystem
- Historically heavy (RxJS). Overkill for simple confirm/text
- **What spinlog absorbs:** Only the most common patterns: confirm and text input

---

## Competitive Positioning Map

```
                    MORE FEATURES
                         │
         listr2 ●        │        ● clack
                         │
         ora ●           │
                         │
    ─────────────────────┼──────────────────── FEWER DEPS
         MORE DEPS       │
                         │
      nanospinner ●      │     ● yoctocolors
                         │     ● picocolors
                         │     ● ansis
                         │
                    FEWER FEATURES

              ★ SPINLOG TARGET: Top-right quadrant
              Max features + Zero dependencies
              (Nobody occupies this space today)
```

---

## Why Each Competitor Can't Be "The Toolkit"

| Competitor | Structural Blocker |
|---|---|
| chalk | Color only. Will never add spinners — scope-locked |
| picocolors / yoctocolors | Color only. Philosophy prevents feature expansion |
| ansis | Color only. Same scope limitation |
| `util.styleText` | Node core will **never** ship spinners/tasks. Node 22+ only |
| ora | 8+ deps. Same maintainer as chalk = single point of failure |
| nanospinner | Depends on picocolors. No colors, no state transitions, no tasks |
| listr2 | 5+ deps. No built-in colors or prompts. Complex API |
| clack | Separate packages. No built-in colors. No progress bars |
| inquirer | Prompts only. Heavy. No spinner, no colors, no tasks |

---

## Feature Absorption Matrix

| Feature | Source Competitor | spinlog Priority | Phase |
|---|---|---|---|
| Color functions (red, green, blue, etc.) | chalk, picocolors | ✅ Core | Phase 2 |
| Bold, dim, underline, italic, strikethrough | chalk, ansis | ✅ Core | Phase 2 |
| Nested color handling (no bleed) | chalk, yoctocolors | ✅ Core | Phase 2 |
| NO_COLOR / FORCE_COLOR detection | all | ✅ Core | Phase 2 |
| Tree-shakeable named exports | yoctocolors, picocolors | ✅ Core | Phase 2 |
| Spinner with 80ms tick | ora | ✅ Core | Phase 2 |
| succeed/fail/warn/info transitions | ora | ✅ Core | Phase 2 |
| Dynamic text/color/prefix/suffix mutation | ora | ✅ Core | Phase 2 |
| CI/non-TTY graceful degradation | ora, nanospinner | ✅ Core | Phase 2 |
| Cursor hide/show + signal trap | ora, cli-cursor | ✅ Core | Phase 2 |
| Promise wrapping (`.promise()`) | ora | ✅ Core | Phase 2 |
| Sequential task grouping | listr2, tasuku | ⭐ Edge | Post-MVP |
| Inline progress bars | cli-progress, listr2 | ⭐ Edge | Post-MVP |
| Basic confirm/text prompts | clack, inquirer | ⭐ Edge | Post-MVP |
| Intro/outro flow helpers | clack | ⭐ Edge | Post-MVP |
| Dual-stream structured logging | *nobody has this* | 🔥 Unique | Post-MVP |
| npm OIDC provenance configuration | *nobody does this* | 🔥 Unique | Phase 1 |
| CycloneDX SBOM shipped with release | *nobody does this* | 🔥 Unique | Phase 3 |

---

## Comparison Table

| Architecture | Transitive Depth | Unpacked | Min+Gzip | Node Req | Security |
|---|---|---|---|---|---|
| Legacy (chalk+ora) | 8+ | >125kB | ~14.8kB | 20-22+ | Vast surface, single maintainer |
| Modern Heavyweights (clack/listr2) | 5+ | >70kB | ~10kB | 18+ | Large surface, complex |
| Micro-stack (picocolors+nanospinner) | 1 | ~15kB | ~4.1kB | 14+ | Fragmented DX, non-zero risk |
| Micro-color only (yocto/pico/ansis) | 0 | ~7kB | ~1.4kB | 18+ | Secure but color-only |
| `util.styleText` (native) | 0 | 0kB | 0kB | **22+** | Zero risk, but color-only |
| **spinlog** | **0** | **<2.5kB** | **<1.2kB** | **18+** | **Full toolkit, zero risk, SBOM + provenance** |

**How to win:** Aggressive inlining of ANSI constants, ESM-only, no sourcemaps, `sideEffects: false`, unified API surface, cryptographic provenance no competitor ships.
