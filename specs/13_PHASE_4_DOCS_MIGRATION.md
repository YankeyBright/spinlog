# Phase 4: Documentation and Migration

Phase 4 begins only after Phase 2 runtime behavior and Phase 3 measurements exist.

## Public Documentation

- Describe the exact default factory, named styles, types, options, transitions, idempotency, promise semantics, environment policy, streams, and process ownership.
- State the measured artifact size as an exact byte count bounded by 1,228 gzip bytes.
- Document zero consumer runtime dependencies and absent lifecycle scripts without claiming zero risk or certification.
- Publish provenance, signature, and SBOM verification only after those registry artifacts exist.
- Use `import spinlog, { green } from 'spinlog'`; do not document a named factory export.

## Migration

- Clearly state that spinlog is not API-compatible with Chalk or Ora.
- Map only behavior supported by the frozen contract.
- Reject or flag custom streams, custom animations, advanced colors, concurrency, and other deferred behavior.
- Keep codemod dependencies and execution outside the runtime package.
- Test transforms against representative fixtures before publishing migration claims.

## Definition Of Done

Every documented example passes against the built package, every capability claim has a behavior test, every size/security claim has a reproducible command, and migration tooling adds nothing to the npm runtime graph.
