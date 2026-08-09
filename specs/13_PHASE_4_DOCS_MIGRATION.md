# Phase 4: Documentation and Migration

**README Must Highlight (top badges):**
- Zero Dependencies badge
- No Lifecycle Scripts badge
- npm provenance / Sigstore attestation badge
- Size badge <1.2kB
- ESM only

**Sections:**

1. **Security First:**
   ```
   npm audit signatures  # verifies Sigstore
   ```
   Show how to verify: `npm view spinlog dist.attestations`

2. **Why spinlog vs ora/chalk:** table from competitive analysis

3. **Quick Start:**
   ```ts
   import { spinlog } from 'spinlog'
   const s = spinlog('Loading').start()
   s.succeed('Done')
   ```

4. **API Reference:** all methods, colors, options

5. **Enterprise Compliance:** SBOM location, provenance, NO_COLOR support

6. **Migration Guide + Codemod:**

   Codemod idea (jscodeshift):
   - `ora('text').start()` -> `spinlog('text').start()`
   - `chalk.red(text)` -> `spinlog.red(text)`
   - `ora({text, color}).start()` -> `spinlog(text,{color}).start()`

   *Note:* The codemod script should be provided as a separate package or standalone script (e.g., `npx @spinlog/migrate`) to avoid adding dependencies like `jscodeshift` to the main zero-dep package.

   Snippet:
   ```ts
   // before
   import ora from 'ora'; import chalk from 'chalk';
   ora(chalk.red('hi')).start()
   // after
   import { spinlog } from 'spinlog';
   spinlog(spinlog.red('hi')).start()
   ```

**DoD:** README passes enterprise auditor check - can verify zero deps via `npm ls`, no scripts via `cat package.json`, provenance via `npm audit signatures`.
