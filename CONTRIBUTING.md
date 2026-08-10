# Contributing

Thank you for improving `spinlog`. Changes should remain small, reviewable, and consistent with the frozen contracts under `specs/`.

## Development

Use Node.js `^22.13.0 || ^24.0.0` and install the exact lockfile without lifecycle hooks:

```bash
npm ci --ignore-scripts
npm run check:phases
npm audit --audit-level=low
```

Run `npm run format` before opening a pull request. Runtime changes require behavior tests, 100% per-file coverage, declaration parity, packed-consumer verification, and an explicit contract update when public behavior changes.

## Change Discipline

- Do not add runtime, optional, or peer dependencies.
- Do not add npm lifecycle scripts or CommonJS output.
- Do not weaken coverage, size, package-payload, stream, or process-ownership controls.
- Keep post-MVP APIs out of v1 unless the phase contract is deliberately revised first.
- Update `CHANGELOG.md` for user-visible changes.

## Security

Do not report suspected vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) and use a private GitHub Security Advisory.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
