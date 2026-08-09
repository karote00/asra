# Framework Package Patch Release Plan

## Status

Active for the fixed Framework package allowlist after the repository runtime,
source, and registry prerequisites pass.

Publication may run from a clean exact source commit on `main` or a non-main
feature branch. Branch identity is not readiness evidence and publication does
not authorize merge.

## Goal

Publish the current Framework package versions produced by canonical Changesets
materialization. Version values come from the fixed-allowlist package manifests
and the reviewed Changesets plan; this document never duplicates them.

Normal development uses ordinary scoped patch Changesets. The all-package
generator remains exceptional and requires explicit authorization for a family
realignment or complete-suite partial-publication recovery.

## Release Set

The Framework publication set is the fixed public allowlist owned by
`scripts/framework-release-packages.js`. Re-query every allowlisted name and
manifest-derived version directly from the public npm registry during each
publication run. A dated inventory is history only and cannot be reused as
current evidence.

Registry history must record any previously published or missing package
versions and material source differences without reconstructing, overwriting,
or publishing an old version from newer source.

Root `asyra`, private `@asyra/asyra-design`, every `create-app/*` CLI package,
and every generated template are excluded from Framework Changesets and
publication. Their versions remain owned by their later release stages.

## Changeset Contract

- Changesets may select only changed packages in the fixed Framework allowlist.
- Normal Framework changes use `patch`; a `major` or `minor` family change
  requires explicit user authorization.
- Review the generated Changeset and `yarn changeset status` before running the
  canonical version command.
- `yarn changeset version` materializes the package versions and internal
  dependency ranges. A consumed Changeset is not expected to remain pending.
- Root, private apps, CLI packages, generated templates, and other workspaces
  must never appear in the Changesets release plan.
- `scripts/changeset-all-patch.js` is exceptional and must not replace ordinary
  scoped Changesets.

## Required Inspector

The release Inspector must define one owner for:

1. current public registry inventory;
2. historical registry-baseline classification;
3. Changeset scope and version-topology resolution;
4. canonical version materialization and changelogs;
5. exact artifact validation;
6. clean exact publication source acceptance;
7. Framework publication through Changesets;
8. public registry verification;
9. registry-only consumer proof and partial-publication recovery; and
10. release records and the final decision.

The Inspector consumes versions from manifests and generated evidence. It must
not encode a numeric release family, baseline, target, or recovery version.

## Execution Plan

### 1. Freeze source and registry state

- Use a clean exact source commit under the repository-supported runtime.
- Verify npm identity and scope access without exposing credentials.
- Query every allowlisted package directly from the public registry.
- Record public versions, missing versions, metadata, dependency ranges, and
  integrity against the current source manifests.
- Treat historical mismatches as evidence only; never republish old versions
  from current source.

### 2. Resolve the Changeset release scope

- Review the ordinary scoped Changesets or the explicitly authorized
  exceptional generator output.
- Require every selected package to belong to the fixed Framework allowlist.
- Require patch entries for normal development.
- Reject duplicate, missing, private, root, CLI, generated-template, or other
  workspace entries.
- Use `yarn changeset status` as the version-plan authority.

### 3. Materialize Framework versions

- Run `yarn changeset version` exactly once for the reviewed plan.
- Read the resulting target version of each selected package from its manifest.
- Preserve generated changelogs and internal dependency updates.
- Verify unselected Framework packages and excluded owners remain unchanged.
- Do not regenerate a create-app template as part of Framework versioning.

### 4. Validate Framework artifacts before publication

- Build and pack every package required by the publication selection and its
  fixed-allowlist consumer proof.
- Validate names, versions, exports, types, license, contents, exact internal
  ranges, sizes, checksums, and clean-install behavior.
- Run required package/root tests, lint, dependency checks, Inspectors, E2E,
  performance, visual, and disabled-side-effect gates.
- Local tarballs are artifact proof only, never public-registry proof.

### 5. Freeze the publication source

- Use scoped commits for Changeset/version output, release automation, and
  direct tests or documents.
- Rebuild every candidate artifact from one clean exact source commit.
- Record the source commit, branch, publication manifest, dependency order, and
  checksums.
- Require CI, E2E, Framework readiness, and scoped release gates to pass for
  that source. The agent never merges the PR.

### 6. Publish the manifest-derived Framework selection

- Present the exact unpublished Framework package manifest and checksums.
- Obtain explicit authorization before the first registry write.
- Convert workspace-only internal ranges through the existing workspace-version
  owner to each dependency's manifest-derived publishable version.
- Restore development `workspace:*` ranges after publication on success or
  failure.
- Run `yarn changeset publish` once. Changesets owns the multi-package publish
  operation and successful package tags.
- Do not publish root, private apps, CLI packages, generated templates, or
  packages outside the fixed allowlist.

### 7. Verify the public registry

- Re-query every published `name@version` directly from the public registry.
- Verify metadata, dependency ranges, dist integrity, and installability against
  the approved manifest and artifact evidence.
- Push successful package tags only after the complete expected registry result
  is verified and tag push is explicitly authorized.

### 8. Run registry-only consumer proof

- Install every fixed-allowlist package at the exact public manifest-derived
  version required by the candidate.
- Use no tarball, workspace, link, portal, source-directory install, registry
  substitution, or resolution.
- Run install, typecheck, build, initialization, transaction, undo/redo,
  save/load migration, Group, Collaboration, AI, and disabled-side-effect gates.

## Partial Publication Policy

Registry publication is irreversible:

- If no package succeeds, correct the external or artifact failure and retry the
  same reviewed target versions.
- If some packages succeed and all artifacts remain correct, preserve those
  immutable versions and resume only the unpublished selection.
- If a source or artifact defect appears after any successful publication, fix
  the canonical owner, generate one complete all-package patch Changeset, and
  advance the complete Framework suite to the next patch version derived by
  Changesets.
- Never overwrite a successful version or accept a mixed final recovery set.

## Definition of Done

- Current registry inventory is queried for every fixed-allowlist package.
- The reviewed Changeset plan contains only authorized Framework entries and
  canonical version materialization succeeds.
- A clean exact source commit reproduces the approved artifacts and checksums.
- Every expected public `name@version` record matches the reviewed manifest.
- Registry-only consumer proof passes under the supported runtime.
- Root, private apps, CLI packages, and generated templates remain excluded.
- The final report contains one decision: `READY` or `BLOCKED`.
