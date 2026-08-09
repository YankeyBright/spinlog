# Session Kickoff Routine

Do not ask me how I am doing or offer greetings. Execute this sequence silently and state "System Restored. Ready for Task [X]." when complete.

1. **Consult Specs:** Check `.agents/AGENTS.md` and the 16 root specification files (`specs/01_PROJECT_MANIFEST.md` to `specs/16_POST_MVP_FEATURES.md`) + `docs/` for low-level API design and architectural context.
2. **Query Episodic Memory:** Query `harness/episodic_memory.db` (`SELECT * FROM episodic_logs ORDER BY timestamp DESC LIMIT 5`) to read recent task logs, modified files, and past architectural decisions.
3. **Load State:** Read `harness/done.md` to understand the ultimate definition of done.
4. **Load Invariants:** Read `harness/invariants.md`. These are non-negotiable constraints.
5. **Analyze Progress:** Read `harness/plan.md`. Identify the last task marked `[x]` and the first task marked `[ ]`.
6. **Look First:** Read `harness/implementation-notes.md` (if it exists) to see what helper functions, ANSI escape logic, or SGR constants are already built so you do not duplicate zero-dependency logic.
7. **Engage Loop:** Prepare to execute the first incomplete task using the protocol defined in `harness/loops.md`.
