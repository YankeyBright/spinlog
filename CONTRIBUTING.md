# Contributing

Thank you for improving `spinlog`. Changes should remain small, reviewable, and consistent with the frozen contracts under `specs/`.

## Development

Use Node.js `^22.13.0 || ^24.0.0 || ^26.0.0` and install the exact lockfile without lifecycle hooks:

```bash
npm ci --ignore-scripts
npm run check:phases
npm audit --audit-level=low
```

Run `npm run format` before opening a pull request. Runtime changes require behavior tests, 100% per-file coverage, declaration parity, packed-consumer verification, and an explicit contract update when public behavior changes.

Release and benchmark gates resolve Git from approved absolute locations rather than `PATH`. For a nonstandard Git installation, set `SPINLOG_GIT_EXECUTABLE` to its absolute executable path; relative values are rejected.

## Terminal Smoke Test

Before approving a terminal UX release candidate, run the packed package in Windows Terminal, macOS Terminal or iTerm, and a mainstream Linux terminal. Confirm immediate animation, flow-line and `spinner.log()` redraw, automatic unknown-profile fallback, narrow-width static fallback, `'text'` and `'silent'` output modes, terminal settlement, and cursor restoration after `stop()`, a terminal method, and `Symbol.dispose`. Record terminal name and version with the release evidence; this manual check complements, but does not replace, the headless ANSI transcript suite.

## Change Discipline

- Do not add runtime, optional, or peer dependencies.
- Do not add npm lifecycle scripts or CommonJS output.
- Do not weaken coverage, size, package-payload, stream, or process-ownership controls.
- Keep post-MVP APIs out of v1 unless the phase contract is deliberately revised first.
- Update `CHANGELOG.md` for user-visible changes.
- Do not create release tags from a pull request. Publication is currently blocked while terminal UX evidence is revalidated; the manual release workflow is verification-only.

## Security

Do not report suspected vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) and use a private GitHub Security Advisory.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
