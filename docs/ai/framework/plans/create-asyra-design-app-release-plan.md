# `create-asyra-design-app` Formal Release Plan

## Status

Queued after every Framework version required by the canonical app is publicly
available and verified. The CLI target is selected explicitly by the user and
is never inferred or duplicated as a constant in this plan.

Root `asyra` remains unchanged throughout this plan. A private
`@asyra/asyra-design` identity change also requires an explicit user decision.

## Goal

Generate the Asyra Design template only from its canonical source, prove that a
clean user can install and use it with the exact public Framework versions, and
publish only the manually versioned `create-asyra-design-app` CLI.

## Ownership Contract

- `apps/asyra-design` is the canonical app source.
- The generated template inherits the canonical app identity and version.
- The official generator replaces `@asyra/*` workspace ranges with the current
  Framework package manifest versions.
- `create-app/asyra-design/template` is generated output and never receives a
  hand-written fix.
- `create-app/asyra-design` owns the CLI package, bundled template, binary,
  documentation, and manually selected release version.
- The public registry owns the final Framework dependency-resolution proof.

## Prerequisites

- Repository runtime, CI, and deployment-preview prerequisites are `READY`.
- Every required Framework manifest version is publicly installable.
- Registry-only Framework clean-consumer proof passes.
- Private app identity remains unchanged unless the user explicitly selects a
  replacement.
- The user explicitly confirms the CLI target version.
- Work uses a clean exact source commit on `main` or a non-main feature branch.

The CLI target cannot be materialized before the generated-template contract
passes. Root remains deferred until after the CLI release.

## Required Inspector

The create-app release Inspector must define one owner for:

1. root, private app, Framework dependency, and CLI version decisions;
2. canonical app source;
3. generator transformation;
4. generated template identity and dependencies;
5. manual CLI version materialization;
6. CLI package artifact;
7. clean CLI invocation;
8. registry-only generated-app install;
9. build, test, startup, interaction, and visual behavior;
10. CLI registry publication;
11. post-publication public-command smoke; and
12. release records and final decision.

The executable authority is
`create-asyra-design-app-release-flow-inspector.data.cjs`.

## Execution Plan

### 1. Record user-specified versions

- Keep root unchanged for its later release stage.
- Keep private Asyra Design unchanged unless explicitly selected otherwise.
- Record the user-selected CLI target without changing its manifest yet.
- Update the canonical app's Framework dependencies to the exact
  registry-verified package versions.

### 2. Generate the template

- Run the official `release:app --prod=asyra-design` route.
- Do not hand-edit generated output.
- Verify that generated identity equals the canonical app identity, every
  Framework dependency equals its registry-verified manifest version, no local
  dependency form remains, and required runtime metadata is present.
- Review the complete generated diff.

### 3. Materialize the CLI version

- Only after generated-template verification passes, manually set
  `create-app/asyra-design/package.json` to the user-selected CLI target.
- Never create a Changeset entry for the CLI, root, private app, or generated
  template.
- Keep root, private app identity, and generated-template identity unchanged.

### 4. Verify synchronization and CLI artifact

- Run the non-mutating template synchronization check.
- Pack the CLI package.
- Validate version, metadata, binary, bundled template, README, license, public
  file inventory, and checksum.
- Invoke the packed CLI from a project-local clean directory.

### 5. Run the real user installation path

- Install the generated project's exact Framework dependencies from the public
  registry.
- Do not use file substitutions, resolutions, workspaces, local registries,
  tarballs, or hoisted monorepo dependencies.
- Run install, typecheck, production build, formal tests, startup, documented
  initialization, live interactions, and visual review.
- Verify disabled Collaboration and AI create no external side effects.

### 6. Freeze the create-app publication source

- Keep source, generated output, manual CLI version, records, and direct
  validation changes in reviewable scoped commits.
- A clean validated feature branch may publish before merge. Publication does
  not authorize merge or imply unfinished PR work is complete.

### 7. Publish `create-asyra-design-app`

- Repack from the clean exact source commit selected for publication.
- Present the exact CLI version, tarball, checksum, and dependency set.
- Obtain explicit authorization before publishing only the CLI package.

### 8. Verify public CLI behavior

- Invoke the exact published CLI version through `npx` from a clean
  project-local directory; a local CLI source or tarball is forbidden.
- Confirm generated identity and Framework dependencies.
- Repeat the complete pre-publication generated-app behavior matrix without a
  reduced smoke path: registry-only install, typecheck, production build, all
  formal tests, maintained E2E, startup, documented initialization, live
  element creation, drag, property edits, undo/redo, relevant Collaboration and
  AI behavior, disabled-side-effect checks, and inspected visual evidence.

## Stop Conditions

- A required Framework version is unavailable or resolves incorrectly.
- Generated output differs from the canonical generator result.
- A manual template repair is required.
- The CLI artifact omits required files or includes repository-only state.
- Registry-only install, build, tests, startup, interactions, or visual review
  fails.
- The CLI manifest does not equal the explicitly selected target when the
  publication segment begins.
- A required private identity decision or P0/P1/P2 finding remains unresolved.

## Definition of Done

- Root remains unchanged and private Asyra Design uses its unchanged or
  explicitly selected identity.
- The CLI is manually materialized at the explicitly selected target without a
  Changeset entry.
- Generated identity equals the canonical app identity.
- Generated dependencies resolve only to the reviewed public Framework
  versions.
- The packed CLI creates a usable clean project through the real user path.
- The reviewed CLI is published and its exact public `npx` command independently
  passes the complete generated-app behavior matrix.
- No generated-template hand edit, registry substitution, merge, deployment, or
  unrelated release is hidden in the result.
