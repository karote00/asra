# `create-asyra-design-app` Formal Release Plan

## Status

Queued after the applicable Framework `0.5.n` patch set is completely
available and verified from the public registry.

The user selected `create-asyra-design-app@0.5.0` for this CLI release. Root
`asyra` remains unchanged throughout this plan and moves to `0.5.0` only in the
later root release stage. The user will separately specify any private
`@asyra/asyra-design` identity change before this plan changes that version.

The current pre-materialization candidate keeps root, private app, and CLI
identity manifests unchanged while updating the canonical app's Framework
dependency set to the registry-verified `0.5.n` versions. After the generated
template contract passes, the CLI package is manually materialized at `0.5.0`
without a Changeset before its final artifact and consumer proof.

## Goal

Generate the Asyra Design template only from its canonical source, prove that a
real clean user can install and use the generated app with publicly available
Framework package versions, and formally publish
`create-asyra-design-app`.

## Ownership Contract

- `apps/asyra-design` is the canonical app source.
- The generated template inherits the Asyra Design package version.
- The official generator replaces `@asyra/*` workspace ranges with the current
  Framework package manifest versions.
- `create-app/asyra-design/template` is generated output and must never receive
  hand-written product fixes.
- `create-app/asyra-design` owns the CLI package, bundled template, binary, CLI
  documentation, and its own release version.
- The public registry owns the final Framework dependency resolution proof.

## Prerequisites

- Node.js 24 local, CI, and Vercel plan is `READY`.
- Every required Framework patch version is publicly installable.
- Registry-only Framework clean consumer passes.
- Any requested private Asyra Design identity change is explicitly selected;
  otherwise its current version remains authoritative.
- The manually owned CLI target is explicitly confirmed as `0.5.0`.
- Work starts from a clean exact source commit on `main` or a non-main feature
  branch.

The private app identity decision must be satisfied before a changed private
app version can enter generation. Root is deliberately deferred until after
the CLI release. The CLI target is explicit, but it cannot be materialized
before the generated-template contract passes.

## Required Inspector

Before implementation, create a create-app release Inspector with one owner
for:

1. root, Asyra Design, and CLI version decision;
2. canonical app source;
3. generator transformation;
4. generated template identity and dependency versions;
5. manual CLI version materialization;
6. CLI package artifact;
7. clean CLI invocation;
8. registry-only generated-app install;
9. build/test/startup behavior;
10. CLI registry publication;
11. post-publication `npm create` smoke;
12. release records and final decision.

The executable Inspector authority is
`create-asyra-design-app-release-flow-inspector.data.cjs`. Candidate work must
stop at the matching owner boundary; publication owners remain unexecuted until
their explicit prerequisites and authorization are satisfied.

## Execution Plan

### 1. Record user-specified versions

- Keep root `asyra` unchanged; it is the final release owner after this CLI
  plan, never an input to the CLI version transition.
- Keep private `@asyra/asyra-design` unchanged unless the user explicitly
  selects another app identity version.
- Record the CLI target as `create-asyra-design-app@0.5.0`, but keep its
  manifest unchanged until generated-template verification passes.
- Update the canonical app's required `@asyra/*` Framework dependencies to the
  exact registry-verified versions in the public `0.5.n` patch set.

### 2. Generate the template

- Run the official `release:app --prod=asyra-design` route.
- Do not hand-edit generated output.
- Verify generated `package.json`:
  - version equals canonical Asyra Design version;
  - required `@asyra/*` dependencies equal the registry-verified Framework
    `0.5.n` versions;
  - no workspace, link, portal, path, tarball, or monorepo alias remains;
  - Node.js 24 and the approved package-manager contract are present.
- Review the complete generated diff.

### 3. Materialize the CLI version

- Only after generated-template identity and dependency verification passes,
  manually set `create-app/asyra-design/package.json` to `0.5.0`.
- Do not create a Changeset release entry for the CLI, root, private app, or
  generated template.
- Keep root `asyra`, private app identity, and generated-template identity
  unchanged during CLI materialization.

### 4. Verify synchronization and CLI artifact

- Run the non-mutating template synchronization check.
- Pack `create-asyra-design-app` itself.
- Validate package metadata, `bin`, bundled template, README, license, ignored
  files, and version.
- Invoke the packed CLI from a project-local clean directory.

### 5. Run the real user installation path

- Let the generated project install its unchanged exact Framework version
  declarations from the public registry.
- Do not use `file:` substitutions, resolutions, workspace packages, local
  registry overrides, or hoisted monorepo dependencies for the final proof.
- Run install, typecheck, production build, formal local tests, startup smoke,
  Core/Preset initialization, and documented example flows.
- Verify disabled Collaboration and AI create no provider/network/secret/model
  side effects.

### 6. Freeze the create-app publication source

- Keep any app identity change, generated output, CLI version/records, and
  validation changes in reviewable scoped commits; root remains untouched.
- A clean, fully validated feature branch may publish before its PR is merged.
  Publication does not authorize merge or imply that unfinished PR work is
  complete.

### 7. Publish `create-asyra-design-app`

- Repack from the clean exact source commit selected for publication.
- Present the exact CLI tarball, version, checksum, and dependency set.
- Obtain explicit publication authorization.
- Publish only the CLI package.

### 8. Verify public CLI behavior

- Run the documented public `npm create`/`npx` command at the published CLI
  version in a clean directory.
- Confirm the generated app version and Framework dependencies.
- Install from the public registry, build, test, and start the generated app.
- Record the command, versions, and reproducible evidence.

## Stop Conditions

- Any required Framework version is unavailable or resolves incorrectly.
- The generated template differs from canonical generator output.
- The generator requires a manual template repair.
- The CLI tarball omits required files or includes repository-only state.
- Real registry install, build, tests, or startup fails.
- The CLI is not exactly `0.5.0`, or a required private Asyra Design identity
  decision remains unresolved when the publication segment begins.
- Any P0/P1/P2 finding remains.

## Definition of Done

- Root `asyra` remains unchanged for its later final release stage; private
  Asyra Design uses its unchanged or explicitly selected version.
- `create-asyra-design-app` is manually materialized and reviewed at `0.5.0`
  without a Changeset release entry.
- Generated template version equals Asyra Design version.
- Generated dependencies resolve only to the published Framework patch set.
- The packed CLI creates a fully usable clean project through the real user
  path.
- The reviewed CLI version is published and the public command passes an
  independent clean smoke test.
- No manual generated-template fix, registry substitution, tag, deployment, or
  unrelated release is hidden in the result.
