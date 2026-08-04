# Framework Package Patch Release Plan

## Status

Queued after:

1. PR #106 is reviewed and merged;
2. the Node.js 24 runtime and Vercel validation plan is `READY`;
3. the local exact-version installation research result is accepted; and
4. work starts from a clean feature branch based on the latest local `main`
   after `git pull --ff-only`.

If Node.js 24 fails locally, in CI, or on Vercel, this plan must not begin
publication.

## Goal

Establish one consistent public baseline for every Framework package, then use
the repository's intentional all-package Changeset flow to advance patch
versions together and publish a reproducible, registry-installable Framework
package set.

Until the complete process is proven, every release increment is patch-only.
The first synchronized Framework target after `0.2.5` is `0.2.6`. A correct
minor release is deferred until the release process is stable and separately
approved.

## Release Set

The Framework publication set is the fixed 19-package allowlist owned by
`scripts/framework-release-packages.js`.

Public npm registry state verified on 2026-08-05:

- already available at `0.2.5`: `core`, `design-system`, `factory`,
  `input-system`, `props-manager`, `reactive-events`, `render`, `scene-tree`,
  `selection`, `system-context`, `ui-context`, and `utils`;
- not yet available at `0.2.5`: `ai-agent-runtime`, `collaboration`,
  `feature-system`, `persistence`, `preset`, `render-engine`, and
  `render-engine-pixi`.

The root `asyra` version and private `@asyra/asyra-design` version are excluded.
Their versions remain unchanged until the user specifies them after Framework
package publication succeeds.

`create-asyra-design-app` is a public workspace and is intentionally discovered
by `scripts/changeset-all-patch.js`. Its patch version may therefore be
materialized by the synchronized Changeset, but its template verification and
registry publication belong exclusively to the later create-app release plan.

## Changeset Contract

- The absence of pending Changesets before this release is intentional.
- `scripts/changeset-all-patch.js` is the canonical one-shot generator for the
  synchronized patch Changeset after a long interval of cross-package changes.
- Do not replace it with manually accumulated per-package Changesets.
- Review the generated Changeset and `yarn changeset status` before versioning.
- Root `asyra` and private `@asyra/asyra-design` must not appear.
- No package outside the script's declared public-workspace behavior may be
  silently added or removed.

## Required Inspector

Before implementation, create a release Inspector with one owner for:

1. public registry inventory;
2. missing-`0.2.5` package artifact preparation;
3. initial `0.2.5` publication;
4. registry verification;
5. all-package Changeset generation;
6. version materialization and changelogs;
7. patch artifact validation;
8. Framework package publication;
9. registry-only clean consumer;
10. partial-publication recovery;
11. release records and final decision.

## Execution Plan

### 1. Freeze source and registry state

- Work from reviewed, merged, latest `main` on Node.js 24.
- Verify npm authentication and scope access without exposing credentials.
- Query every package/version directly from the public registry.
- Freeze one Git commit and one exact package list.

### 2. Validate the seven unpublished `0.2.5` packages

- Build and pack the seven missing packages from their current `0.2.5`
  manifests.
- Validate contents, exports, types, licenses, internal dependency ranges, and
  clean installation.
- Publish in dependency-safe order, including `render-engine` before
  `render-engine-pixi`, and both before `preset`.
- Registry publication requires an explicit final authorization immediately
  before the first publish command.
- After each publish, verify registry name, version, metadata, tarball
  integrity, and installability.

### 3. Prove the common `0.2.5` baseline

- Require all 19 Framework packages to resolve as `0.2.5` from the public
  registry.
- Install all 19 by package name and version in a clean consumer with no
  workspace, `file:`, link, portal, or resolution substitution.
- Run typecheck, build, public Core/Preset/Collaboration/AI flows, and
  side-effect isolation checks.
- Do not continue to patch bump until this common baseline passes.

### 4. Generate the synchronized patch Changeset

- Run `scripts/changeset-all-patch.js` once.
- Inspect the generated package list and summary.
- Run `yarn changeset status`.
- Reject duplicate, missing, private, root, or unintended release entries.

### 5. Materialize patch versions

- Run `yarn changeset version`.
- Expect the 19 Framework packages to move from `0.2.5` to `0.2.6`.
- Preserve generated package changelogs and internal dependency updates.
- Keep root `asyra` and private `@asyra/asyra-design` unchanged.
- Test-first re-scope the Gate 5 release-record validator so the Framework
  candidate version belongs to the 19-package release set and no longer forces
  root `asyra` or private Asyra Design to share that version. Do not bump either
  excluded owner merely to satisfy the old validator assumption.
- Do not regenerate the create-app template in this plan.

### 6. Validate the new patch artifacts before publication

- Run the accepted local exact-version test method.
- Build and pack exactly the 19 Framework packages.
- Validate metadata, contents, types, imports, internal ranges, and checksums.
- Install the complete artifact set into a clean consumer and run all public
  Framework flows under Node.js 24.
- Run required package/root tests, lint, dependency checks, Inspectors, E2E,
  performance, and visual gates.

### 7. Review and merge the version PR

- Use scoped commits for Changeset/version output, release documentation, and
  any test-only version synchronization.
- Do not publish from an unmerged feature branch.
- After merge, recreate and revalidate the artifacts from clean latest `main`.

### 8. Publish the synchronized Framework patch

- Present the exact 19-package publication manifest and checksums.
- Obtain explicit publication authorization.
- Publish only the 19 validated Framework artifacts.
- Verify each public registry record before advancing.
- Do not publish `create-asyra-design-app`, root `asyra`, or private
  `@asyra/asyra-design` in this step.

### 9. Run registry-only consumer proof

- Install the new patch versions by package name from the public registry.
- Use no local tarballs, workspace aliases, hoisting assumptions, or
  resolutions.
- Run install, typecheck, build, initialization, transaction/undo/redo,
  save/load migration, Group, Collaboration, AI, and disabled-side-effect
  checks.

## Partial Publication Policy

Registry publication is irreversible:

- If publication fails before any package succeeds, correct the external or
  artifact failure and retry the same target version.
- If some packages succeed, never overwrite them. Resume only the unpublished
  packages at the same target version when the artifacts remain correct.
- If a source or artifact defect is discovered after any target package was
  published, fix the canonical owner, generate a new all-package patch
  Changeset, advance the complete suite again (for example `0.2.6` to
  `0.2.7`), and republish all Framework packages.
- Do not create mixed Framework target versions as the final result.

## Definition of Done

- All 19 Framework packages first have a verified public `0.2.5` baseline.
- The canonical all-package Changeset flow advances the Framework suite by one
  patch.
- The reviewed, merged commit produces the same validated artifacts that are
  published.
- All 19 new patch versions install from the public registry and pass the
  registry-only consumer proof on Node.js 24.
- Root `asyra` and private `@asyra/asyra-design` remain unchanged.
- Generated template and create-app publication remain deferred.
