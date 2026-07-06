# Asyra CAD App Context

This folder is the app-level planning context for **Asyra CAD**.

Asyra CAD is a planned CAD-like canvas tool built on the Asyra framework. It is
not an active implementation context yet, so this folder currently records
roadmap-level app plans only.

## Read Order

1. `PLANS.md`
2. `plans/*`

## Scope

These docs are for **app-level Asyra CAD behavior and roadmap planning** only.
Framework-level contracts belong to `docs/ai/framework/*`.

Asyra CAD inherits project-wide framework hard rules even while it is still in
planning. In particular, `docs/ai/framework/rules/no-patch-fixes.md` applies to
future CAD implementation work: do not add CAD-specific patch render/output,
fallback product paths, or scenario exceptions to hide a pipeline defect.

When Asyra CAD becomes an active app, expand this folder with app essentials,
architecture, API surfaces, workflows, rules, modules, features, and decision
history following the `asyra-design/` app context pattern.
