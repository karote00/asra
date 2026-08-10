# Asyra Public README and Entrypoint Alignment Plan

## Status

Active child plan of the
[Asyra Framework Website Program](asyra-framework-website-plan.md). This
workstream consumes the accepted public-documentation and executable-example
handoffs while remaining independent from Visual Reimagine and website UI
implementation.

Implementation requires an exact README inventory, canonical owner mapping,
content cases, generated-output route, link contract, and bounded Definition of
Done.

Architecture execution is governed by the
[Asyra Public README Flow Inspector](asyra-public-readme-and-entrypoint-alignment-flow-inspector.data.cjs)
and its contract test. Work advances one README owner step at a time; the
generated template is produced only through the retained create-app release
route.

## Goal

Make every public repository, package, App, CLI, and generated-app README a
concise, correct entry surface into the same Asyra release. README files explain
what the owned artifact is, how to start, where complete documentation and
examples live, and what support or contribution boundaries apply. They do not
duplicate complete manuals.

## Owned Surfaces

The exact candidate inventory includes:

- root `README.md`;
- all Framework package `packages/*/README.md` files in the manifest-derived
  release inventory, currently 19;
- `apps/asyra-design/README.md`;
- `apps/asyra-design/TEMPLATE.md` as the canonical generated-app README source;
- `create-app/asyra-design/README.md`; and
- `create-app/asyra-design/template/README.md`, only as canonical generated
  output.

Ownership remains local to each surface:

- root owns repository positioning, navigation, support, license, security,
  and contribution policy;
- each package owns its purpose, installation, minimal composition entry,
  public boundary, and links;
- Asyra Design owns real-product setup, optional/complete service paths,
  Framework-versus-App ownership, and extension entry;
- `release-configs/asyra-design.json` selects the canonical generated-app
  README source;
- the CLI owns the public creation command, generated-project expectations,
  and next steps; and
- the official generator owns generated-template README synchronization. A
  generated README is never hand-edited.

The frozen inventory contains exactly 24 surfaces: one root README, 19 package
READMEs derived from the Framework release inventory, one Asyra Design README,
one canonical generated-app README source, one CLI README, and one generated
README output.

## Executable README Cases

- the inventory equals the current manifest-derived 19-package release set and
  all 24 paths exist exactly once;
- every package README resolves its package manifest, public guide, approved
  public entrypoints, and at least one maintained executable example;
- root, App, canonical template source, CLI, and generated output each satisfy
  their owner-specific required sections without duplicating full guides;
- current browser/Core support, possible app domains, app-owned domain
  knowledge, Preset defaults, and future Headless/Core Kernel work remain
  distinct;
- root and downstream surfaces consistently state that external issues and
  contributions are not accepted;
- repository, documentation, example, security, license, support, and policy
  links resolve from their rendered owner context;
- generated output is byte-identical to the canonical source selected by
  `release-configs/asyra-design.json`; and
- stale versions, unknown packages or examples, private imports, unsupported
  public API names, broken links, or hand-edited generated output fail closed.

## Required Shared Contract

Every applicable README must use the same verified:

- Asyra product definition, current visual scope, and future non-visible
  Headless/Core Kernel boundary;
- Framework/Preset/App/domain ownership language;
- package and public-entrypoint inventory;
- `create-asyra-design-app` beginner positioning;
- supported runtime, version, installation, and public command facts;
- public documentation, executable-example, release, security, license, and
  support links; and
- contribution and issue policy.

The root declaration that the repository does not accept external issues or
contributions is mandatory and must not be removed or weakened. Package, App,
and CLI wording must not create conflicting contribution routes.

## Surface-Specific Content

### Root

- broad Framework positioning, including the non-visible and AI-facing future
  direction without claiming it as current runtime support;
- package, generated-app, public docs, examples, Asyra Design, Atlas, release,
  security, license, and roadmap navigation;
- verified quick-start choices; and
- the required no-issues/no-external-contributions policy.

### Framework packages

- package owner and explicit non-owner;
- install/import entry and one minimal supported composition path;
- lifecycle, optionality, and relationship summary where applicable;
- link to the complete package guide and maintained executable example; and
- exact support, license, security, and contribution-policy navigation.

### Asyra Design

- reference-product purpose and local-editable beginner path;
- separate complete Collaboration/persistence service path;
- App-owned domain behavior versus Framework composition;
- how developers and AI coding agents continue through public Framework docs;
  and
- verified deployment link only when its canonical owner is public.

### CLI and generated app

- exact public creation command and prerequisites;
- what the generated project contains and which services are optional;
- first run, first bounded extension, verification commands, and documentation
  links; and
- generated README provenance from the canonical source and generator.

## Coordination Contract

- README drafting starts after the shared terminology, route IDs, and example
  IDs are frozen, not after the entire website is complete.
- Public documentation supplies full-guide destinations; README supplies the
  concise entrance and must not fork guide semantics.
- Executable Examples supplies tested quick-start code and expected results.
- Candidate versions and links may remain generated/provisional until the
  public registry and deployment owners are verified.
- The final README freeze occurs inside the integrated Release Candidate, not
  as an isolated earlier milestone.
- After public release, only generated facts and verified links may change
  before final website deployment unless formal evidence reopens the owning
  content contract.

## Generated-App Contract

`create-app/asyra-design/template` is generated output. Update its canonical
`apps/asyra-design/TEMPLATE.md` source, selected by
`release-configs/asyra-design.json`, then run the official
`yarn release:app --prod=asyra-design` route and verify
`yarn release:app:check --prod=asyra-design`. Never repair the generated README
directly.

The CLI artifact must include the exact synchronized README and pass the
retained create-app release Inspector and artifact inventory checks when a new
CLI publication is applicable.

## Implementation Stages

1. Freeze the README inventory, owner mapping, shared terminology, route IDs,
   and content cases.
2. Draft root, package, App, and CLI surfaces in parallel with public docs and
   examples.
3. Verify every quick start against maintained examples and public entrypoints.
4. Review all cross-links, support facts, and contribution-policy consistency.
5. Finalize the canonical generated-app README source and regenerate the
   template through the official route.
6. Freeze all README surfaces into the integrated pre-publication Release
   Candidate.
7. Reconcile generated versions, commands, and verified public links after the
   applicable public release writes.

## Quality Gates

- the root, 19-package candidate inventory, Asyra Design, CLI, and generated
  README surfaces are complete;
- each README's owner/non-owner language agrees with canonical contracts;
- every quick start maps to a maintained executable example or formal public
  API proof;
- all documentation, example, release, security, license, support, and policy
  links resolve;
- versions, commands, environments, and support facts match the exact release
  inventory;
- root and downstream contribution wording do not invite unsupported issues or
  external contributions;
- generated-template synchronization and CLI artifact README checks pass; and
- no generated output receives a hand-written repair.

## Stop Conditions

- A README owner, generated source, public API, route ID, example ID, or support
  fact is ambiguous.
- A quick start requires package-private or unverified behavior.
- Root, package, App, CLI, and generated-app wording conflicts.
- A generated-template edit cannot be traced to the canonical generator.
- A public version, command, or URL is presented as final before verification.
- Completing the README requires changing another workstream's semantic owner.

## Definition of Done

- Every owned README is concise, current, correctly linked, and aligned to the
  same release candidate.
- The root contribution and issue policy remains present and consistent across
  downstream surfaces.
- Package users can reach full guides and executable examples without README
  duplication.
- `create-asyra-design-app` provides the intended beginner and AI-assisted
  entrance into a real Asyra product.
- Generated-app README output is reproducible solely from its canonical source
  and generator.
- Final generated facts match the publicly verified release inventory, and all
  README gates pass as part of the integrated release train.
