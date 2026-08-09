# Project Brief: spinlog

## Problem

Node.js CLIs often combine separate color and spinner packages, adding runtime dependencies for purely cosmetic terminal behavior. Security-conscious teams need a small alternative with a clear output-stream policy and auditable package payload.

## Audience

- **CLI developers:** Need colors and spinner feedback that works in interactive terminals and degrades cleanly in CI.
- **Security and compliance reviewers:** Need a runtime package with no dependency tree, no package lifecycle hooks, a runtime SBOM, and npm provenance evidence.

## v1 Scope

`spinlog` v1 provides colors, a spinner, state transitions, live mutation, and a promise wrapper. Cosmetic output defaults exclusively to `stderr`.

## Success Metric

The published package can replace the color-and-spinner role of `chalk` plus `ora` while maintaining zero runtime, optional, and peer dependencies; an ESM-only Node >=18 runtime; and a gzip size at or below 1,228 bytes.

## Explicit Non-Goals

Progress bars, prompts, task groups, intro/outro helpers, and structured JSON logging are post-MVP. The project does not claim to replace `listr2`, `clack`, or `inquirer` in v1.
