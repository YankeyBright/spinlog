# Post-MVP Features (Deferred)

This document lists features that have been deliberately deferred from the spinlog v1 release, along with the reasoning behind their deferral.

- **`spinlog.group()`**: Deferred because task orchestration expands state complexity beyond the core spinner primitive.
- **`spinlog.progress()`**: Deferred because progress rendering should reuse the proven spinner renderer once it's battle-tested.
- **`spinlog.confirm()` and `spinlog.text()`**: Deferred because raw stdin handling and cross-platform prompt behavior require careful hardening and are a separate domain.
- **`spinlog.intro()` and `spinlog.outro()`**: Deferred because they are cosmetic polish, not core trust primitives.
- **`structured: true` mode**: Deferred because stdout behavior must be extremely deliberate and thoroughly designed.
