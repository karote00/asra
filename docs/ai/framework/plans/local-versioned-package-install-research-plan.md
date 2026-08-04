# Local Exact-Version Package Installation Research Plan

## Status

Queued as a research-only plan. No implementation, dependency installation,
local registry setup, package mutation, or publication is authorized.

The general ecosystem answer is already known:

- a packed local tarball can be installed without publication and preserves the
  `name` and `version` declared inside its `package.json`;
- `@asyra/package@X.Y.Z` package-name resolution requires that version to exist
  in the configured registry;
- a private or local registry can simulate that resolution without publishing
  to the public npm registry, but operating one would be a separate
  implementation requiring explicit approval.

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

Local tarballs are sufficient to verify the future version embedded in the
actual artifacts and to run clean-consumer behavior before publication.
They are not sufficient to make an unmodified dependency declaration such as
`"@asyra/core": "0.2.6"` resolve by name from the public registry.

For that exact registry-style test without public publication, a local registry
is technically possible. The research plan must decide whether that extra proof
is worth its setup and approval cost; it must not implement the registry.

## Definition of Done

- The final report clearly separates artifact proof, local registry proof, and
  public registry proof.
- It answers whether the existing tarball substitution can safely validate
  create-app before publication.
- It recommends one bounded method and names every remaining blind spot.
- No project or external system was mutated.
