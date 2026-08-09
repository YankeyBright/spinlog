# Stream Policy

This document defines the strict policies for terminal output streams in spinlog v1.

- **Spinner animation**: Writes only to `stderr`.
- **Colorized cosmetic output**: Writes only to `stderr`.
- **Standard output (`stdout`)**: Is never touched in v1. It remains clean for user data or JSON piping.
- **Environment degradation**: CI and non-TTY environments must degrade to static readable lines.
- **Future structured logging**: May write JSON to `stdout`, but only when explicitly enabled.
- **Resilience**: Terminal write failures must never crash user programs.
