# Framework Package 0.5.0 Release Plan

## Status

Active after:

1. PR #110 is owner-reviewed and merged;
2. the Node.js 24 runtime and Vercel validation plan is `READY`;
3. the local exact-version installation research result is accepted; and
4. work starts from a clean feature branch based on the latest local `main`
   after `git pull --ff-only`.

If Node.js 24 fails locally, in CI, or on Vercel, this plan must not begin
publication.

The public `0.2.5` packages are a historical partial release from before the
current cross-package changes. Their manifests are not expected to match the
current `main` manifests that still carry the same local version. Record that
registry state as release-history evidence; do not reconstruct or publish the
seven historically missing `0.2.5` packages from the current source.

## Goal

Establish `0.5.0` as the first public baseline produced from the current
19-package Framework source set. The current source represents a deliberately
accumulated large change whose local manifests were not incremented during
development.

For this exceptional release only, materialize the fixed 19 Framework packages
at local baseline `0.4.0`, generate one synchronized `minor` Changeset, and let
the canonical Changesets version command advance the complete Framework set to
`0.5.0`.

After `0.5.0`, normal development must add ordinary scoped Changesets as changes
are made. The all-package generator is not a routine versioning shortcut. It
may be used again only for an explicitly approved large version realignment or
the complete-suite recovery required after a defective partial publication.

## Release Set

The Framework publication set is the fixed 19-package allowlist owned by
`scripts/framework-release-packages.js`. Re-query all 19 names directly from
the public npm registry during each publication run. No dated registry
inventory may be reused as current evidence.

The initial inventory must separately record:

- the 12 historical Framework packages that already expose `0.2.5`;
- the seven Framework packages that do not expose `0.2.5`; and
- manifest or dependency-contract differences between public `0.2.5` records
  and the current source.

This inventory is evidence only. No `0.2.5` package is published by this plan.

The root `asyra` version and private `@asyra/asyra-design` version are excluded.
Their versions remain unchanged until the user specifies them after Framework
package publication succeeds.

`create-asyra-design-app` is excluded from the generator, version
materialization, artifact set, and publication. Its existing version and
committed template remain unchanged; template verification and publication
belong exclusively to the later create-app release plan.

## Changeset Contract

- The absence of pending Changesets before this exceptional release is
  intentional.
- `scripts/changeset-all-patch.js` is the canonical one-shot generator only for
  an explicitly approved large version realignment or complete-suite recovery.
- The script requires an explicit `--type patch|minor|major` argument and reads
  exactly the fixed 19-package allowlist. It must reject missing, duplicate,
  private, root, create-app, or other workspace entries.
- This release runs
  `node scripts/changeset-all-patch.js --type minor` exactly once after all 19
  Framework manifests have been materialized at `0.4.0`.
- Do not replace it with manually accumulated per-package Changesets.
- Review the generated Changeset and `yarn changeset status` before versioning.
- Every generated entry must be `minor`, and `yarn changeset version` must
  produce exactly `0.5.0` for all 19 packages.
- Root `asyra` and private `@asyra/asyra-design` must not appear.
- `create-asyra-design-app` and every package outside the fixed allowlist must
  not appear.
- After this release, use ordinary scoped Changesets during normal development;
  do not invoke this generator merely to avoid maintaining Changesets.

## Required Inspector

Before implementation, create a release Inspector with one owner for:

1. public registry inventory;
2. historical `0.2.5` mismatch classification;
3. exact local `0.4.0` baseline materialization;
4. special all-package `minor` Changeset generation;
5. `0.5.0` version materialization and changelogs;
6. `0.5.0` artifact validation;
7. reviewed and merged publication source;
8. Framework package publication through Changesets;
9. public registry verification;
10. registry-only clean consumer and partial-publication recovery; and
11. release records and final decision.

## Execution Plan

### 1. Freeze source and registry state

- Work from reviewed, merged, latest `main` on Node.js 24.
- Verify npm authentication and scope access without exposing credentials.
- Query every package/version directly from the public registry.
- Freeze one Git commit and one exact package list.
- Record the historical 12-present/seven-missing `0.2.5` split and compare
  public manifests with the current source.
- Treat expected differences as evidence that `0.5.0` is the next coherent
  public baseline. Do not publish or overwrite any `0.2.5` package.

### 2. Materialize the exceptional local baseline

- Change exactly the fixed 19 Framework package versions from `0.2.5` to
  `0.4.0` in one bounded version-materialization operation.
- Do not change root `asyra`, private `@asyra/asyra-design`, or
  `create-asyra-design-app`.
- Verify that every Framework manifest is exactly `0.4.0`, excluded versions
  are unchanged, and no registry command has run.
- `0.4.0` is a local Changesets input baseline only and must never be
  published.

### 3. Generate the synchronized minor Changeset

- Run
  `node scripts/changeset-all-patch.js --type minor`
  exactly once.
- Inspect the generated package list and summary.
- Run `yarn changeset status`.
- Reject duplicate, missing, private, root, create-app, or unintended release
  entries.
- Require exactly 19 entries and require every entry to be `minor`.

### 4. Materialize `0.5.0`

- Run `yarn changeset version`.
- Expect the 19 Framework packages to move from `0.4.0` to `0.5.0`.
- Preserve generated package changelogs and internal dependency updates.
- Keep root `asyra` and private `@asyra/asyra-design` unchanged.
- Test-first re-scope the Gate 5 release-record validator so the Framework
  candidate version belongs to the 19-package release set and no longer forces
  root `asyra` or private Asyra Design to share that version. Do not bump either
  excluded owner merely to satisfy the old validator assumption.
- Do not regenerate the create-app template in this plan.

### 5. Validate the `0.5.0` artifacts before publication

- Run the accepted local exact-version test method.
- Build and pack exactly the 19 Framework packages.
- Validate metadata, contents, types, imports, internal ranges, and checksums.
- Install the complete artifact set into a clean consumer and run all public
  Framework flows under Node.js 24.
- Run required package/root tests, lint, dependency checks, Inspectors, E2E,
  performance, and visual gates.

### 6. Review and merge the version PR

- Use scoped commits for Changeset/version output, release documentation, and
  any test-only version synchronization.
- Do not publish from an unmerged feature branch.
- After merge, recreate and revalidate the artifacts from clean latest `main`.

### 7. Publish the synchronized Framework `0.5.0`

- Present the exact 19-package publication manifest and checksums.
- Obtain explicit publication authorization.
- Before `changeset publish`, convert workspace-only internal ranges through
  the existing workspace-version owner into the exact publishable `0.5.0`
  ranges validated by the artifact gate. Restore development workspace ranges
  after publication on success or failure.
- Assert that the unpublished public-workspace selection is exactly the fixed
  19-package allowlist.
- Run `yarn changeset publish --no-git-tag` once. Changesets owns the
  multi-package npm publication operation; this release does not create Git
  tags through that command.
- Verify all 19 public registry records immediately after the command returns,
  including name, version, metadata, dependency ranges, dist integrity, and
  installability.
- Do not publish `create-asyra-design-app`, root `asyra`, or private
  `@asyra/asyra-design` in this step.

### 8. Run registry-only consumer proof

- Install all 19 packages as public `name@0.5.0` from the registry.
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
  packages at `0.5.0` with `changeset publish` when the artifacts remain
  correct.
- If a source or artifact defect is discovered after any target package was
  published, fix the canonical owner, generate a new all-package patch
  Changeset, advance the complete suite from `0.5.0` to `0.5.1`, and republish
  all 19 Framework packages.
- Do not create mixed Framework target versions as the final result.

## Definition of Done

- The current public `0.2.5` inventory and source mismatch are recorded without
  publishing any additional `0.2.5` artifact.
- The exceptional all-package Changeset flow advances exactly the fixed 19
  Framework packages from local `0.4.0` to `0.5.0` with one `minor` Changeset.
- The reviewed, merged commit produces the same validated artifacts that are
  published.
- All 19 `0.5.0` versions install from the public registry and pass the
  registry-only consumer proof on Node.js 24.
- Root `asyra` and private `@asyra/asyra-design` remain unchanged.
- Generated template and create-app publication remain deferred.
- Normal post-`0.5.0` development uses ordinary scoped Changesets rather than
  the exceptional all-package generator.
