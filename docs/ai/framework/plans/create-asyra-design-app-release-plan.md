# `create-asyra-design-app` Formal Release Plan

## Status

Queued after the Framework package patch release is completely available and
verified from the public registry.

The user will separately specify the next root `asyra` and private
`@asyra/asyra-design` versions before this plan changes either version.

The current pre-publication candidate keeps the root, private app, and CLI
identity versions unchanged while updating the canonical app's Framework
dependency set to the already published `0.5.0` baseline. Missing identity
version decisions block publication, not bounded template and clean-consumer
candidate validation.

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
- The user has specified the next root Asyra and Asyra Design versions.
- The intended CLI version from the synchronized Changeset is confirmed.
- Work starts from reviewed, merged, latest `main`.

The root, private app, and CLI identity-version prerequisites must be satisfied
before the publication segment. They are not permission to infer or materialize
an identity-version bump during candidate preparation.

## Required Inspector

Before implementation, create a create-app release Inspector with one owner
for:

1. root and Asyra Design version decision;
2. canonical app source;
3. generator transformation;
4. generated template identity and dependency versions;
5. CLI package artifact;
6. clean CLI invocation;
7. registry-only generated-app install;
8. build/test/startup behavior;
9. CLI registry publication;
10. post-publication `npm create` smoke;
11. release records and final decision.

The executable Inspector authority is
`create-asyra-design-app-release-flow-inspector.data.cjs`. Candidate work must
stop at the matching owner boundary; publication owners remain unexecuted until
their explicit prerequisites and authorization are satisfied.

## Execution Plan

### 1. Apply user-specified versions

- Update root `asyra` and private `@asyra/asyra-design` only to the versions
  explicitly selected by the user.
- For the current candidate, keep those identity versions and the CLI identity
  version unchanged, and update the canonical app's required `@asyra/*`
  Framework dependencies to exact public `0.5.0`.
- Confirm the CLI package version produced or selected by the release sequence.
- Keep Framework package versions equal to the already published patch set.

### 2. Generate the template

- Run the official `release:app --prod=asyra-design` route.
- Do not hand-edit generated output.
- Verify generated `package.json`:
  - version equals canonical Asyra Design version;
  - required `@asyra/*` dependencies equal publicly available Framework
    versions;
  - no workspace, link, portal, path, tarball, or monorepo alias remains;
  - Node.js 24 and the approved package-manager contract are present.
- Review the complete generated diff.

### 3. Verify synchronization and CLI artifact

- Run the non-mutating template synchronization check.
- Pack `create-asyra-design-app` itself.
- Validate package metadata, `bin`, bundled template, README, license, ignored
  files, and version.
- Invoke the packed CLI from a project-local clean directory.

### 4. Run the real user installation path

- Let the generated project install its unchanged exact Framework version
  declarations from the public registry.
- Do not use `file:` substitutions, resolutions, workspace packages, local
  registry overrides, or hoisted monorepo dependencies for the final proof.
- Run install, typecheck, production build, formal local tests, startup smoke,
  Core/Preset initialization, and documented example flows.
- Verify disabled Collaboration and AI create no provider/network/secret/model
  side effects.

### 5. Review and merge the create-app release PR

- Keep root/app version changes, generated output, CLI version/records, and
  validation changes in reviewable scoped commits.
- Do not publish before the PR is reviewed, green, and merged.

### 6. Publish `create-asyra-design-app`

- Repack from clean latest `main`.
- Present the exact CLI tarball, version, checksum, and dependency set.
- Obtain explicit publication authorization.
- Publish only the CLI package.

### 7. Verify public CLI behavior

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
- Root, Asyra Design, or CLI identity version has not been explicitly selected
  when the publication segment begins.
- Any P0/P1/P2 finding remains.

## Definition of Done

- Root Asyra and Asyra Design use the user-selected versions.
- Generated template version equals Asyra Design version.
- Generated dependencies resolve only to the published Framework patch set.
- The packed CLI creates a fully usable clean project through the real user
  path.
- The reviewed CLI version is published and the public command passes an
  independent clean smoke test.
- No manual generated-template fix, registry substitution, tag, deployment, or
  unrelated release is hidden in the result.
