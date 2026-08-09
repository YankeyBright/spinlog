# Package Identity

This document locks in the core identity and metadata for the spinlog package.

- **Package name**: `spinlog`
- **Runtime**: Node >=18
- **Module format**: ESM only
- **License**: MIT
- **Author**: spinlog contributors
- **Repository URL**: https://github.com/spinlog/spinlog
- **Keywords**: cli, spinner, terminal, ansi, colors, esm, zero-dependency, supply-chain, sbom

The runtime compatibility floor is independent from the release environment: consumers are supported on Node >=18, while supply-chain generation and OIDC publishing run on Node 24. npm trusted publishing requires the `repository.url` in `package.json` to match the configured GitHub repository and workflow filename exactly.
