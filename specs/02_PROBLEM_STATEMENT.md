# Problem Statement

## The Supply-Chain Cost Of Cosmetic CLI Output

Terminal colors and spinners are common CLI needs, but applications often add multiple runtime packages to provide them. Every runtime dependency introduces maintenance, update, availability, and supply-chain review work. A dependency-free library does not remove all risk, but it removes a specific class of runtime dependency and transitive-dependency risk.

## The v1 Opportunity

`spinlog` supplies the color-and-spinner layer of a CLI stack with:

- no runtime, optional, or peer dependency map;
- ESM-only support for the Node.js 22 and 24 LTS majors;
- side-effect-free, stream-free style helpers and spinner-owned output routed exclusively to `stderr`;
- a small gzip-constrained bundle; and
- package, SBOM, and provenance evidence that can be checked by automated review.

## Scope Discipline

v1 does not attempt to replace task runners, prompt libraries, progress renderers, or structured logging systems. Those features create distinct input, state, output, and compatibility requirements. They remain deferred until the core terminal primitive is proven and independently specified.

## Security Position

The project uses a minimal published package surface, package allowlisting, lifecycle-script prohibition, a validated runtime SBOM, and npm OIDC provenance. These controls provide evidence and reduce exposure; they are not a substitute for secure development practices, account security, code review, or formal compliance certification.
