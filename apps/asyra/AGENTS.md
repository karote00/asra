# Asyra App Agent Guide

This project is a minimal React shell for an Asyra Framework product.

Before editing:

1. Read [`README.md`](README.md) and the
   [Asyra GitHub project](https://github.com/karote00/asyra).
2. State the product behavior and its Framework, Preset, App, or backend owner.
3. Keep one bounded objective and name the checks that will prove it.

Product intent must enter through a registered Feature, canonical mutation must
use public Asyra APIs inside one intended transaction, and UI/rendering must
remain projections of canonical state. Keep domain schemas, workflows,
permissions, and UI in this App. Use public `@asyra/package-name` entrypoints;
never import package internals.

Fix the first incorrect owner step rather than adding fallback output or an
alternate state path. This starter intentionally does not prescribe a testing
framework; add one only when your product chooses its testing strategy.

Run at least:

```bash
yarn typecheck
yarn react:build
```
