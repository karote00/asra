# Local Geometry Method SDK v0

Status: source-level local SDK, not a published package. Read the
[extension contract](extensions-v0.md), [original-part numerical contract](original-part-method-v1.md)
and [native primitive contract](numerical-method-v0.md)
before implementing a method. Public release still requires the release gates.

## Ownership and Entry Points

The App and production Worker import the single pre-start composition at
`apps/asyra-sim/src/extensions/installed-methods.ts`. It constructs an immutable
catalog using `createMethodCatalog`. Importing a project never adds a method.
To change composition, stop work, save, rebuild, and restart the deployment.
Do not modify Core, add runtime registration, or replace another catalog entry.

The source contracts live in `src/extensions/contracts.ts`:

- `InstalledMethodDescriptor`: identity, capabilities, manifest and parameter schema.
- `MethodRegistration`: descriptor plus trusted `execute(snapshot, context)` implementation.
- Optional `createExecutor()`: inert factory returning the same execute signature
  for one live Worker input lifetime. Omit it for stateless methods. Retain only
  bounded immutable preparation; every call uses fresh budgets/checkpoints and
  must agree with cold execution. The Worker owns disposal, never imported data.
- `MethodContext`: owned `signal`, cooperative `checkpoint()` and `emitPair(pair)`.
- `MethodEvidence` / `MethodPairEvidence`: geometry evidence protocol v1.

The independent working example is `src/analysis/methods/static-spheres.ts`.
It uses the shared domain pose implementation and analytical interval distances,
not the official method's convex-search implementation. Its adapter in the
installed catalog passes the same snapshot, checkpoints and pair emitter used
by the official method. No special result viewer is involved.

This SDK version is for the R0 geometry domain: complete original meshes and
explicitly authored native rigid boxes/spheres/capsules,
right-handed Y-up coordinates, meters/radians/seconds, and declared static or
serial-joint trajectory capabilities. It does not add arbitrary chemistry,
optics, dynamics, arbitrary new geometry kinds, or custom shaders by configuration.
Declare `mesh` in `geometryKinds` only when the method handles complete source
triangles and the declared solid semantics. Snapshot version 2 carries those
resolved meshes with matching source bindings. Version 1 is retained for native
inputs and historical records; old proxy evidence is never upgraded. Existing
primitive-only methods reject selected meshes rather than substituting shapes.
The original-part method is a distinct installed identity; the historical
continuous method and independent sphere example keep their original identities.

## Add a Private Method

1. Create a reviewed local module with its own descriptor and implementation.
   Use a unique stable ID, name and explicit version. Declare `origin: 'private'`,
   author/source, license, applicability and validation evidence truthfully.
2. Define bounded method-specific parameters. Return geometry evidence using
   the exact v1 protocol. Reuse the domain's kinematics; do not infer geometry
   from Three.js or introduce a second model hierarchy.
3. Add its `MethodRegistration` to the array passed to `createMethodCatalog` in
   `installed-methods.ts`. The catalog permits at most 32 methods and rejects
   duplicate IDs or case-insensitive names, even with a different version.
4. Run conformance, numerical and ordinary workflow tests, then rebuild and
   restart. Installation does not grant an official-validation label. Do not
   add a third-party solver or commercial runtime without reviewing its license,
   resource needs, network behavior and deployment approval.

An adapter has this shape; `descriptor` and `solve` are your reviewed module's
declaration and implementation, not platform-provided algorithms:

```ts
import type { MethodRegistration } from './contracts'

export const privateMethod: MethodRegistration = {
  descriptor,
  execute(snapshot, context) {
    return solve(snapshot, context)
  }
}
```

When adapting the sample, update its descriptor and identity checks together.
Relabeling a descriptor while invoking an implementation that requires another
method ID is rejected. Code may remain private; user data is not submitted to
Asyra automatically. A private build remains responsible for its own methods.

## Parameters and Capabilities

`settings.parameters` supports up to 32 named scalar values. The installed
`parameterSchema` supports bounded numbers with units, booleans, and finite enum
choices. Every declared key is required; unknown keys and out-of-range values
block execution. Defaults are applied when the user explicitly selects a method,
not silently when loading an old experiment or historical result.

The common `distanceTolerance`, `timeTolerance` and `maxIterations` fields remain
part of geometry protocol v1. Declare exactly how your method uses them, or that
it does not. They do not imply an error guarantee. The static-sphere example's
additional absolute uncertainty widens bounds; it never acts as an epsilon that
converts touching into clearance.

Preflight checks the installed geometry/motion capabilities, parameter schema,
scope, units and global limits before allocating a Worker. More restrictive
input assumptions must be explicit in the descriptor and rejected by the method;
do not return a fabricated success for unsupported inputs. Extend declarative
admission through the snapshot owner if such assumptions need UI preflight.

## Execution and Output

The implementation receives a detached, recursively frozen snapshot with its
actual settings, trajectory, source units, scope, exclusions, rule and budget.
It must not modify canonical state. Synchronous and asynchronous implementations
use the same Worker host. Call `checkpoint()` between bounded pieces of work;
observe `signal` in asynchronous work. The parent also enforces wall-time and
forced termination after the 250 ms cooperative grace period.

Emit a pair only when its retained interval partition is ready. Each pair must
cover the complete requested time range using clear, finding or unresolved
leaves. An unevaluated interval is unresolved, not omitted. Bounds, witness time,
penetration, coverage and evaluation totals must agree. Preserve the shared
evidence budgets and leave room for unprocessed pairs. Once an invocation
settles, its emitter cannot publish more evidence.

The output names snapshot and method identity exactly. The platform validates
the envelope, selected pairs, interval continuity, bounds, counts and consistency
with earlier progress. An invalid output becomes a method error, not repaired
success. Schema conformance cannot prove the mathematical validity of privately
computed bounds. Numerical tests need independent oracles.

Method exceptions and uncaught Worker errors expose a failure stage or generic
description, not raw private paths or credentials. Do not intentionally include
secrets in manifest text, evidence reasons, or report metadata. A Worker is an
execution/termination boundary, not an exfiltration-proof sandbox. Review trusted
code and dependencies; `services` is a disclosure, not permission enforcement.

## History, Versions and Comparison

New snapshots retain the installed descriptor as inert provenance. Same-ID/version
declaration drift blocks execution until a new snapshot is created. Older
snapshots without that optional field stay readable without invented metadata.
Changing the method or settings produces a new experiment revision and run;
do not rewrite retained evidence or silently substitute a newer implementation.

Removing a module does not erase its project definitions or results. Existing
reports/replay remain available, but dependent runs require the exact installed
version. Compare method, parameters, declarations, scope and rule differences
explicitly; an App version alone is not method compatibility.

## Permanent Verification

Run from the repository root with the already-declared toolchain:

```sh
yarn workspace @asyra/asyra-sim test:local src/extensions src/analysis/__tests__
yarn workspace @asyra/asyra-sim test:local src/analysis/methods
yarn workspace @asyra/asyra-sim test:e2e src/analysis/__tests__/runner.browser.spec.ts
yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/methods.spec.ts
yarn workspace @asyra/asyra-sim typecheck
yarn workspace @asyra/asyra-sim lint
yarn workspace @asyra/asyra-sim build
```

`method-conformance.test.ts` exercises frozen inputs, exact dispatch, incompatible
versions, invalid outputs, false completeness, redacted exceptions, cancellation
and late emissions. Runner tests cover startup, crash, resource budgets, timeout,
retained partial evidence and disposal. The production browser suite also checks
an intentionally uncooperative extension's real Worker termination. The normal
UI suite covers selection, parameter edits, capability blocks, portable history
and missing-module reading. Add permanent cases for each private method's own
applicability boundaries; passing the sample's tests does not validate your math.
