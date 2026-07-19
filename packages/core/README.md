# Core

`@asyra/core` coordinates framework lifecycle, persistence, app load hooks,
package validation, and canonical state apply.

## App-owned load migration

Register synchronous app migrations with `core.registerLoadHook(...)`. Hooks
run from a registration snapshot taken at load start on that Core instance; a
hook registered during execution begins with the next load. The first hook
receives the unnormalized raw document as `unknown`, so app code narrows version eligibility.
Every successful hook must return a `VersionedLoadDocument`; package fields stay
raw until the complete chain reaches package-owner validation.

The app owns its connected linear migration chain and domain transforms. A
copyable app helper can validate the complete batch and install one conditional
dispatcher that repeatedly follows the current version; when no matching
version exists, the document passes through unchanged. The helper permits one
non-empty installation per Core instance, treats empty batches as no-ops, and
keeps its instance-isolated installation guard app-owned. Core rejects Promise or
invalid hook results before validation through `LoadHookExecutionError`, and
contains an eventual rejected Promise behind that single synchronous failure.
It does not infer app schema history, enforce an app target version, or provide
a second migration pipeline.

After migration, Props Manager, Scene Tree, and System Context each produce a
validation/fallback result as an owner-issued, instance-bound, one-shot
artifact. Core obtains all artifacts before updating the version, then returns
each complete artifact to its package apply facade without rerunning validators.
Migration or validation failure cannot apply a canonical prefix. Direct and
provider-backed loads share this exact ordering and only nullish input means no
document.

Load diagnostics run only after successful apply and only when warnings exist.
Every hook receives detached diagnostics and post-apply load evidence assembled
from normalized/validated apply inputs and applied managed-system serialization.
The detached evidence is not a canonical state artifact or state owner. Mutation
or failure remains observational and cannot change canonical state, load success,
or later hooks in that emission. Core assembles evidence only when diagnostics
and an observer exist; assembly failure skips emission and preserves load success.

See `docs/examples/app-owned-versioned-load-migration.mjs` for a reusable
connected-registry example.
