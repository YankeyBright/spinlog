# Risks and Strategic Mitigations

**1. Browser Sandbox Crash**
Risk: `process` undefined -> ReferenceError
Mitigation: 
```ts
const isNode = typeof process !== 'undefined' && process.stderr?.write
if (!isNode) return { start:()=>{}, succeed:()=>{} } // no-op
```
Wrap all process.env access in try/catch.

**2. Stream Write Failure**
Risk: stderr closed
Mitigation: try/catch around write, fallback to no-op. Never throw.

**3. OIDC Build Compromise**
Risk: Attacker compromises CI workflow itself (not token)
Mitigation:
- Pin all actions to SHA hash, not tags
- Require 2 reviewers for .github/workflows/*
- Use ephemeral runners only
- No secrets in env, use OIDC

**4. Size Creep**
Risk: Adding colors/frames exceeds 1228 bytes
Mitigation: CI size gate is impassable. Hard fail. Document that new features must replace old or be tree-shakable.

**5. Cursor Leak on Kill -9**
Risk: SIGKILL cannot be trapped
Mitigation: Document limitation. For SIGINT/SIGTERM we guarantee restore via sync writeSync. Recommend users use wrapper: `process.on('exit', ()=>showCursor())` as backup.

**6. Unicode Support False Positive**
Risk: Terminal claims unicode but renders tofu
Mitigation: Use conservative heuristic: win32 -> ascii unless WT_SESSION set. Allow override via `options.spinner = 'dots'`.

**7. Nested Color Bleed**
Risk: Common bug in naive impl
Mitigation: Test matrix explicitly covers `red('a '+blue('b')+' c')` -> must end with red, not default.

**8. Interval Leak**
Risk: forget stop() -> process hangs
Mitigation: Ensure `succeed/fail/etc` always clearInterval, and in non-TTY path never create interval.
