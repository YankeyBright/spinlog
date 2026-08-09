# Personas

## 1. The CLI Developer
- **Goal:** Replace a fragmented color+spinner stack with one tiny import to ship faster without transitive dependencies.
- **Pain:** Terminal cursor corruption on crashes (`SIGINT`) and unreadable logs when their CLI runs in CI environments.
- **Trigger phrases:** 
  - *"Elegant terminal spinner"*
  - *"hit ctrl+c and my cursor was gone, had to run reset"*
  - *"my github actions log is full of ⠋⠙⠹ characters, had to disable ora manually"*
- **Tech level:** High (Writes Node.js scripts, automation, and CLIs)
- **Target Job:** Happy Case (Speed/DX) & Frustrated Case (Resilience)

## 2. The Enterprise Security Auditor
- **Goal:** Prove zero dependencies and zero lifecycle scripts via SBOM and signatures to pass strict enterprise procurement audits (NIST SSDF, EU CRA).
- **Pain:** Packages like `ora` pulling 8 transitive dependencies, triggering automated scanners and blocking adoption.
- **Trigger phrases:**
  - *"Zero lifecycle scripts — no preinstall, postinstall, or prepare in package.json."*
  - *"Zero runtime dependencies — only Node.js built-ins. No transitive dependency tree to attack."*
  - *"security audit failed because ora pulls 8 transitive deps"*
- **Tech level:** High (Specialized in supply chain security, compliance scanners, CI/CD gates)
- **Target Job:** Critical Invariant Case (Compliance Enforcement)
