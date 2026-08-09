# Jobs to be Done (JTBD)

*RULE: This document contains only verbatim quotes OR explicitly labeled hypotheses. Real `spinlog` user quotes must replace HYPOTHESIS sections after interviews.*

*Scope note: References to prompts, progress bars, groups, intro/outro helpers, or structured output are post-MVP aspirations only. They are not v1 commitments.*

## 1. Happy Case
**Situation:** Library works perfectly, solves immediate pain.

> **Verbatim public proxy quote (ora ecosystem):** "Elegant terminal spinner"
> 
> **[HYPOTHESIS]:** "finally dropped both chalk and ora for one import, bundle is 1.1kb and my CI logs are clean"

**Job to be Done:**
When I am building a CLI, I want to replace my fragmented color+spinner stack with one import that is provably tiny, so I can ship faster and stop thinking about transitive deps.

## 2. Frustrated / Error Case
**Situation:** Terminal corruption or CI failure.

> **Verbatim public quotes (ora ecosystem):**
> "Prevent the cursor you have hidden interactively from remaining hidden if the process crashes."
> "Note: discardStdin puts stdin into raw mode. In raw mode, Ctrl+C no longer generates SIGINT from the terminal."
> "Force enable/disable the spinner. If not specified, the spinner will be enabled if the stream is being run inside a TTY context... and/or not in a CI environment."
>
> **[HYPOTHESIS A]:** "hit ctrl+c and my cursor was gone, had to run reset"
> **[HYPOTHESIS B]:** "my github actions log is full of ⠋⠙⠹ characters, had to disable ora manually"

**Job to be Done:**
When my CLI crashes or runs in CI, I want the tool to auto-restore the cursor and degrade to static text, so I don't corrupt the user's terminal or flood logs with ANSI garbage.

## 3. Critical Invariant Case
**Situation:** Enforcing zero-dependency, SBOM, and lifecycle constraints.

> **Verbatim public quotes (enterprise supply chain defense):**
> "Zero lifecycle scripts — no preinstall, postinstall, or prepare in package.json."
> "Zero runtime dependencies — only Node.js built-ins. No transitive dependency tree to attack."
>
> **[HYPOTHESIS A]:** "security audit failed because ora pulls 8 transitive deps, we need zero-dep with sbom.json"
> **[HYPOTHESIS B]:** "we block any package with postinstall script, does spinlog have one? need to prove no lifecycle scripts"

**Job to be Done:**
When I am passing an enterprise procurement audit (NIST SSDF, EU CRA), I want a CLI primitive that can prove exactly zero dependencies and zero lifecycle scripts via a valid SBOM, so my adoption doesn't get blocked. 
*(Protects Invariants: "exactly zero dependencies in package.json", "NEVER use lifecycle scripts")*

## 4. Learning / Repeat-Use Case
**Situation:** Realizing they can replace their entire fragmented stack with one tool.

> **[HYPOTHESIS A]:** "wait does spinlog do progress bars too? I can delete cli-progress as well"
> **[HYPOTHESIS B]:** "if it does colors + spinner + prompt in <1.2kb, I can remove inquirer, chalk, ora all at once"
> **[HYPOTHESIS C]:** "just realized I can use spinlog.group() instead of listr2, that's 40kb saved"

**Job to be Done:**
When I have successfully used spinlog for one task (e.g. spinning), I want to easily discover that I can use the exact same tiny engine for progress bars and prompts, so I can collapse my entire cosmetic CLI stack into one audited dependency.
