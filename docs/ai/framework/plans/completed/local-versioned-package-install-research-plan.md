# Local Exact-Version Package Installation Research Plan

## Status

Completed on 2026-08-06 with final conclusion `TARBALL_SUFFICIENT`.

The research phase remained read-only. Follow-up tarball, generated-app, Chrome,
and repair work was performed only after the user separately authorized each
step. No dependency, binary, local registry, third-party tool, package version,
package publication, registry state, or public release was added or mutated.

Local tarballs are accepted as sufficient pre-publication evidence for exact
packed identity, all 19 internal dependency resolutions, generated create-app
installation, production build and startup, and packed-only consumer behavior.
They do not prove public-registry availability or public-registry operations.

## Completion Record

### Research baseline

- Read-only baseline: `origin/main`
  `02a6ba7bfa4b1cf56f7c35f49e8179650dab2a71`.
- Release sequence authority:
  `docs/ai/framework/PLANS.md`.
- Existing Gate 5 owner:
  `scripts/release/validate-framework-release-package-artifacts.mjs`, including
  its packed-artifact validator, clean-consumer preparation, and generated
  template consumer substitution.

### Actual Gate 5 owner flow

1. Pack the 19 public Framework packages and inspect the archive manifests,
   included files, declarations, exports, executable entrypoints, and
   dependency metadata.
2. Create a project-local clean consumer whose root dependency and every
   transitive `@asyra/*` dependency resolve to the matching `file:` tarball.
3. Install with an isolated project-local cache and reject workspace, link,
   portal, source-directory, and symlink resolution.
4. Generate the Asyra Design consumer through the packed
   `create-asyra-design-app` CLI.
5. Let the first unmodified registry install prove that unpublished exact
   package names are unavailable, then use the official consumer-preparation
   owner to substitute all 19 Asyra dependency resolutions with their packed
   tarballs.
6. Install, test, build, start, and exercise that packed-only generated
   application in the same way a normal engineer uses the generated project.

The final generated consumer resolved all 19 packages at version `0.2.5` from
tarballs with zero package symlinks. Its focused formal gates passed 98 of 98,
its client, collaboration server, document backend, overlay, standalone
production startup, and two-Actor browser flow passed, and the official
generated-template synchronization check passed.

### Proof matrix

| Evidence | Proves | Does not prove |
| --- | --- | --- |
| Local tarballs | Packed `name`/`version`, archive contents, exports, declarations, scripts, exact internal metadata, all 19 transitive resolutions, clean install, tests, build, startup, and create-app substitution | Public `name@version` availability, dist-tags, authentication, public metadata, CDN or propagation |
| Isolated local npm-compatible registry | Local registry `name@version` lookup, publish order, metadata, and otherwise-unmodified dependency resolution | Public npm availability, public credentials, public dist-tags, CDN or propagation |
| Workspace/link/portal/source-directory installs | Source-tree developer integration only | Packed artifact identity, packed contents, clean consumer isolation, or release usability |
| Public registry | Actual public `name@version`, dist-tags, authentication, metadata, public install path, CDN and propagation | Future unpublished artifacts before publication |

### Decision and rationale

`TARBALL_SUFFICIENT`

The tarball route exercises the exact bytes that will be published, preserves
the declared package identity, resolves every unpublished internal package from
its corresponding packed artifact, and proves the generated application can
install, build, start, and collaborate without workspace leakage. A local
registry would add only simulated registry lookup semantics and would still not
prove the public-registry properties that matter after publication. Its service,
configuration, publication ordering, cleanup, and maintenance cost is therefore
not justified before the Framework patch release.

### Remaining blind spots

- An unmodified dependency such as `"@asyra/core": "0.2.6"` cannot resolve by
  package name until that version exists in a configured registry.
- Public npm package visibility, dist-tags, authentication, metadata, CDN
  availability, propagation, and a real public-registry create-app install must
  wait until publication.
- The committed generated template was regenerated and synchronized for this
  proof, but intentional artifact cleanup remains owned by the formal
  `create-asyra-design-app` release plan.
- The one-shot 7,076-element endpoint run proved 7,076 of 7,076 canonical and
  rendered elements on both Actors, all 15 publications, and no CPU-budget
  violation. Its terminal oracle still compared 239 progressive work units
  with 15 publications and therefore did not pass. That work-unit/publication
  contract is a separate performance-plan or Inspector decision; it is not
  accepted as a package artifact, dependency-resolution, install, build, or
  runtime failure.

### Release-sequence outcome

The Framework package patch release plan may begin after this closeout PR is
accepted and merged so that its only baseline is the resulting latest `main`.
This closeout does not authorize a version bump, Changeset, package publication,
registry mutation, tag, deployment, or create-app release.

## Goal

Determine which non-publication method gives Asyra enough confidence that a
future exact package version can be installed and used by clean consumers and
by the output of `create-asyra-design-app`.

## Questions

1. Can a consumer install the exact packed artifact while observing its future
   version identity?
2. Can all transitive `@asyra/*` dependencies resolve without public registry
   availability?
3. Can `create-asyra-design-app` exercise its real generated dependency
   declarations without modifying the committed generated template?
4. Which method proves artifact correctness, and which method additionally
   proves registry-style name/version resolution?
5. What remains impossible to prove until the public registry contains the
   version?

## Candidate Methods

### A. Local tarballs

Use `yarn pack` or `npm pack`, then install the resulting `.tgz` with a `file:`
specifier in a project-local clean consumer.

This can prove:

- packed `name` and `version`;
- included files, exports, declarations, dependency metadata, and executable
  entrypoints;
- install, typecheck, build, tests, and runtime behavior;
- absence of workspace aliases and source-directory links.

For a multi-package suite, every internal `@asyra/*` dependency must resolve to
the matching local tarball, typically through a generated consumer manifest and
temporary resolution overrides. This is the approach already used by Gate 5.

It cannot prove:

- that `@asyra/package@X.Y.Z` exists on the public registry;
- npm dist-tags, registry authentication, registry metadata, CDN availability,
  or public-registry propagation;
- that a completely unmodified generated app will resolve an unpublished
  version by package name.

### B. Local registry

Publish the candidate packages to an isolated local npm-compatible registry and
configure the clean consumer's `@asyra` scope to use that registry.

This can additionally exercise:

- package-name plus exact-version resolution;
- transitive semver resolution across all Asyra packages;
- registry metadata and publish/install ordering;
- an otherwise unmodified generated app against registry semantics.

This does not prove public npm availability. A tool such as Verdaccio is a
third-party dependency/service and must not be added or started without
explicit user approval.

### C. Workspace, link, portal, or source-directory installs

These methods are unsuitable as release evidence because they can expose source
files, symlinks, monorepo dependency state, or non-packed contents that public
consumers do not receive.

## Research Procedure

1. Map the existing Gate 5 tarball consumer and generated-template substitution
   behavior.
2. Compare npm and Yarn's documented local-tarball semantics with Asyra's exact
   internal dependency graph.
3. Define a proof matrix for artifact identity, transitive resolution,
   create-app behavior, registry behavior, and public availability.
4. Determine whether the existing tarball route is sufficient for pre-publish
   create-app testing.
5. If it is insufficient, recommend a local registry design without installing
   or implementing it.
6. End with one of:
   - `TARBALL_SUFFICIENT`;
   - `LOCAL_REGISTRY_RECOMMENDED`;
   - `PUBLICATION_REQUIRED`.

## Authoritative References

- npm install accepts local tarball package specs:
  https://docs.npmjs.com/cli/install/
- npm package specs distinguish local tarballs from registry
  `name@version` resolution:
  https://docs.npmjs.com/cli/v8/using-npm/package-spec/
- Yarn's `file:` protocol supports tarball-based local packages:
  https://yarnpkg.com/protocol/file
- Verdaccio describes an npm-compatible local/private registry:
  https://www.verdaccio.org/

## Current Working Conclusion

Accepted as `TARBALL_SUFFICIENT`. Local registry implementation is not
recommended for this release sequence.

## Definition of Done

- The final report clearly separates artifact proof, local registry proof, and
  public registry proof.
- It answers whether the existing tarball substitution can safely validate
  create-app before publication.
- It recommends one bounded method and names every remaining blind spot.
- The user reviewed and accepted the final conclusion before closeout.
