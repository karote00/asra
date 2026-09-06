# Package and Release Validation

This workflow owns the repository automation contract between workspace
manifests, Turbo, generated app templates, CI, and the explicit release
command.

## PR Checks and Vercel Deployment Status

The PR checks list combines GitHub Actions CI with statuses reported by the
Vercel Git integration. Vercel deployments can run alongside CI; a successful
Vercel check does not mean the test jobs passed or the PR was merged.

| Check | Meaning |
| --- | --- |
| `Vercel – asyra-framework` | Deployment status for the Framework website. On a feature-branch PR, this is a Preview deployment. |
| `Vercel – asyra-design` | Deployment status for Asyra Design. On a feature-branch PR, this is a Preview deployment. |
| `Vercel Preview Comments` | Updates the PR preview comment; it is not a third deployment. |

Pushing a feature/PR branch can create or update Preview deployments. Merging
the reviewed PR into the configured Production branch, `main`, can trigger
the automatic Production deployment. The Git integration reacts to branch
updates, so direct pushes to `main` must not be used to bypass PR review.

Vercel's generic `Deployment has completed` message does not distinguish
Preview from Production. Open the check's deployment details and verify
**Environment**, **Source branch/commit**, and **Domains**. A completed Preview
deployment does not update the Production site.

The Framework website enables Git deployments in
`apps/asyra-framework-site/vercel.json` and filters build inputs through
`scripts/vercel-ignore-build.mjs` within that app. This behavior was enabled
by PR #129 on August 28, 2026. As of September 5, 2026, the Asyra Design
provider setting for skipping unaffected projects is disabled, so a
website-only PR can also create a Design Preview. This is an observed provider
setting, not an instruction to change deployment behavior.

References:

- <a href="https://github.com/karote00/asyra/pull/129" target="_blank" rel="noopener noreferrer">PR #129: Framework website Git deployment configuration</a>
- <a href="https://vercel.com/docs/git/vercel-for-github" target="_blank" rel="noopener noreferrer">Vercel for GitHub</a>

## Workspace Build Graph

Each framework package keeps its canonical package-specific build command,
such as `build:factory` or `build:collaboration`. Asyra Design uses
`react:build`.

`scripts/gen-turbo.js` derives package-qualified Turbo tasks and exact
package-qualified dependencies from workspace manifests. A dependency edge has
the form:

```text
@asyra/asyra-design#react:build
-> @asyra/collaboration#build:collaboration
```

Package-specific task names must not use a `^build:<package>` dependency.
Turbo interprets `^` as the named task on every dependency package, which is
not the Asyra package-specific task contract.

Commands:

```bash
yarn gen:turbo        # intentionally rewrite turbo.json
yarn gen:turbo:check  # verify the committed graph without changing files
yarn react:build      # check the graph, then build the app dependency closure
```

Any root, app, CI, E2E, or deployment command that directly depends on a
package-specific Turbo task must first pass `gen:turbo:check` or call a root
command that does.

`dev:all` discovers `packages/*` from their manifests and starts every package
`dev` command plus the Asyra Design dev server in parallel. It does not validate
the Turbo graph or build workspace packages; existing `dist` outputs are a
precondition. A fresh clone must use this sequence from the repository root:

```bash
yarn install
yarn react:build
yarn dev:all
```

After `yarn clean`, recreate the outputs before restarting the watchers:

```bash
yarn react:build
yarn dev:all
```

`clean` remains a Turbo workspace command; every package that emits `dist` must
provide `clean`.

## Script Tests

`yarn test:scripts` verifies:

- the committed Turbo graph against workspace manifests;
- root/CI/deployment command wiring;
- release command ordering and restoration behavior;
- the non-mutating generated-template synchronization command contract;
- monorepo unit, integration, and contract test placement through
  `scripts/__tests__/test-file-placement.test.mjs`.

`yarn deps:validate` separately verifies declared workspace dependencies for
source imports. It does not replace build, clean, generated-template, or
release validation.

Package tarball, entrypoint, and clean-consumer validation is deliberately
owned by Framework Release Gate 5. It must cover every published framework
package under one release contract rather than introducing a package-specific
publication rule for Collaboration.

Gate 5 uses these artifact-only commands:

```bash
yarn release:packages --prebuilt
yarn release:consumer
yarn release:template --prod=asyra-design
yarn release:records
```

`release:packages` creates and validates exactly 19 tarballs in the ignored
project-local artifact directory. `release:consumer` and `release:template`
install only those tarballs in isolated Yarn `node_modules` consumers; neither
may resolve monorepo workspaces, aliases, private source paths, or hoisted
dependencies. `release:records` freezes the candidate versions, public support
documents, package READMEs, Changesets configuration, and the distinction
between readiness and publication.

Historical prerequisite decisions are resolved from Framework
`decisions/releases/unreleased.md` and all direct `vX.Y.Z.md` archive files,
independently of the current root version. New unreleased entries never hide
older completion records. Each prerequisite returns its matching `decisionPaths`
for provenance; missing required decisions still fail. This checks the existence
of historical authority, not current test execution or fresh release approval.
General package validation does not require an empty `unreleased.md`; clearing
that file belongs only to the release-cut lifecycle. No manually maintained
summary duplicates the historical source.

The formal commands require Node.js 24.x to report `READY`. The explicit
`--allow-unsupported-node` option is local diagnostic evidence only and cannot
authorize the release decision.

After publication, `yarn release:consumer:registry` derives every Framework
version from the current package manifests and installs the fixed allowlist
directly from the public npm registry. It permits no workspace, tarball, link,
portal, patch, source-directory, or resolution substitution, and records the
registry lockfile checksums before running the same typecheck, build, and
behavior gates as the artifact consumer.

## Generated App Template

Only `create-app/<app>/template` is generated output. The surrounding CLI
package remains directly maintained source.

```bash
yarn release:app --prod=asyra-design
yarn release:app:check --prod=asyra-design
yarn release:app:build --prod=asyra-design
```

The first command synchronizes the committed template from the source app. The
second generates into project-local `tmp/`, compares it with the committed
template, removes the temporary output, and never changes the committed
template. The third builds the framework dependency graph, compiles that
generated template against those local builds, and removes its temporary build
output. General feature/refactor PR CI does not require current template parity;
that would expand ordinary source work into generated output contrary to the
generated-artifact rule. `release:validate` owns the synchronization check and
reuses its immediately preceding clean framework build for the same template
compilation.

## Release Validation and Publication Boundary

```bash
yarn release:validate --prod=asyra-design
yarn release:framework --prod=asyra-design
yarn release:create-app --prod=asyra-design
yarn release:full --prod=asyra-design
```

`release:validate` runs, in order:

1. copy repository sources and version-controlled environment defaults into an
   ignored project-local isolated workspace, excluding `.git`, dependencies,
   build/test output, local `.env.local` overrides, and other temporary state;
2. immutable dependency installation;
3. Turbo graph check;
4. clean workspace build;
5. root production build;
6. lint and formal tests;
7. workspace dependency validation;
8. collaboration browser E2E on isolated ports;
9. generated-template synchronization check;
10. generated-template production build;
11. remove the isolated workspace whether validation passes or fails.

Release validation never cleans or builds the developer's active workspace, so
an active `dev:all`, app server, or package watcher is not interrupted and
cannot rewrite artifacts during validation.

`release:framework` captures the current Changesets status before version
materialization, rejects every release entry outside the fixed 19-package
Framework allowlist, converts workspace dependency ranges, publishes only the
captured Framework release set in dependency order, restores `workspace:*`,
and then proves the published set through the registry-only consumer.

`release:create-app` begins with that registry-only Framework proof, regenerates
and validates the selected app template, verifies the CLI pack inventory, and
publishes only `create-app/<app>`. It never discovers or publishes Framework
workspaces. `release:full` is the explicit synchronized orchestration: it runs
the Framework stage first and enters the create-app stage only after Framework
publication and registry verification succeed. Use `release:framework` alone
when the CLI does not need a release.

Once exact release ranges have been applied, the Framework stage restores
`workspace:*` in a `finally` path whether validation or publication succeeds or
fails. The generic unscoped `changeset publish` command is not a project release
entrypoint because it would also select any unrelated unpublished public
workspace, including a manually versioned create-app CLI.

These commands do not create changesets and do not authorize a push, tag,
registry publication, or deployment unless the user explicitly invokes and
authorizes the corresponding remote operation.

## Release Version Topology

Changesets version only fixed-allowlist Framework packages under `packages/*`.
Root `asyra`, private apps, `create-app/*` CLI packages, and generated templates
must never appear as Changeset release entries. A non-Framework code PR may use
an empty Changeset as its closeout record. Every pull request must carry that
pending record before completion. CI accepts a release pull request after
`changeset version` consumes its pending records only when at least one
allowlisted Framework package has both its generated manifest version and
changelog committed; deleting a Changeset alone never satisfies the gate.

Root `asyra` is the `a.b.0` main release identity. Framework packages iterate
within that family as `a.b.n`. Changing `a` or `b` requires explicit user
authorization and runs in the fixed order: public Framework packages and
registry proof, then the manually versioned create-app CLI, then root `asyra`.
The complete authority is
`docs/ai/framework/rules/release-version-topology.md`.

The full ordinary app E2E suite remains an independent CI workflow because its
product-wide browser contract is broader than package publication. The
Collaboration E2E suite runs in a separate CI job so an ordinary-suite failure
cannot prevent the package-specific collaboration gate from reporting its own
result.
