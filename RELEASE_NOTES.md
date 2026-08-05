# Asyra Release Notes

This file tracks releases for Asyra. Previous releases under Asyra (v0.1.0,
etc.) are not included here.

## Framework 0.2.5 pre-publication release readiness result: READY

Framework Release Gate 5 produced a reproducible pre-publication `READY` result
for the already-versioned `0.2.5` candidate. All 19 public packages can be
packed, installed, typechecked, built, and exercised by clean consumers and by
the generated Asyra Design template from project-local artifacts. Public
registry availability is not proven. This result does not authorize merge,
tagging, registry publication, deployment, or a formal release.

The candidate supports:

- Core and Preset 2D initialization through public ESM entrypoints;
- transaction, rollback, undo/redo, save, and app-owned load migration;
- Group group/ungroup through canonical public APIs;
- explicitly composed Collaboration and convergent remote apply;
- explicitly composed AI action plans through registered app actions;
- side-effect-free operation when Collaboration or AI is not enabled.

The supported runtime is Node.js 24.x with Yarn 4.3.1. Declarations are
validated with TypeScript 5.8.3, and the React surface targets React 19. The
formal browser evidence uses the current Chromium supplied by Playwright 1.57.

Production 3D and HYBRID profiles, auto-layout, and unit-aware aggregation are
not included. See
[`docs/ai/framework/RELEASE_SUPPORT.md`](docs/ai/framework/RELEASE_SUPPORT.md)
for the exact package set, support matrix, migration/deprecation table,
security boundaries, and reproducible readiness commands.
