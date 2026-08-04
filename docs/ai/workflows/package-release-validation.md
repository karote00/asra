# Package and Release Validation

This workflow owns the repository automation contract between workspace
manifests, Turbo, generated app templates, CI, and the explicit release
command.

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

The formal commands require Node.js 20.x to report `READY`. The explicit
`--allow-unsupported-node` option is local diagnostic evidence only and cannot
authorize the release decision.

## Generated App Template

`create-app/*` remains generated output.

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

`release:full` computes versions from already-present changesets, converts
workspace dependency ranges, generates the app template, passes
`release:validate`, and only then invokes registry publication. Once production
ranges have been applied, a `finally` path restores `workspace:*` whether
validation or publication succeeds or fails.

These commands do not create changesets and do not authorize a push, tag,
registry publication, or deployment unless the user explicitly invokes and
authorizes the corresponding remote operation.

The full ordinary app E2E suite remains an independent CI workflow because its
product-wide browser contract is broader than package publication. The
Collaboration E2E suite runs in a separate CI job so an ordinary-suite failure
cannot prevent the package-specific collaboration gate from reporting its own
result.
