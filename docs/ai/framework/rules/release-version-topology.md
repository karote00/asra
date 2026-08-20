# Rule: Release Version Topology

## Scope

This rule owns version authority and release ordering for Framework packages,
create-app CLI packages, the root `asyra` package, private apps, and generated
app templates.

## Version Owners

- Changesets may create release entries only for public Framework packages
  owned under `packages/*` and listed by the fixed Framework release allowlist.
- The `create-app/` directory has no version. Each CLI package under
  `create-app/<app>` owns its own manually selected version and must never be a
  Changeset release entry.
- `apps/asyra-design` and `create-app/asyra-design` share the published Asyra
  Design release version; their manifest versions must remain identical.
- Root `asyra` is the main release identity. Its stable version is always
  `a.b.0` and is changed manually only after the required release sequence.
- A canonical private app owns its own identity version. A generated template
  inherits that app version through the official generator; the template is
  never edited, versioned, or selected in Changesets independently.
- `create-asyra-app` has no canonical private App. Its CLI-owned scaffold source
  and generated template use the manually selected `create-asyra-app` version;
  neither is a Changeset release identity.

An empty Changeset may record a non-documentation PR that changes no Framework
package. Empty records satisfy closeout without assigning a release version to
root, private, CLI, or generated-template owners.

## Framework Iteration Contract

For a root release family `a.b.0`, Framework packages develop within the same
`a.b` family as `a.b.n`. The patch component `n` records each package's scoped
post-baseline iterations and may differ between packages according to which
packages changed.

Normal Framework development uses ordinary scoped Changesets. A Changeset must
not contain root `asyra`, a private app, any `create-app/*` CLI package, a
generated template, or any workspace outside the Framework allowlist.

## Major or Minor Family Change

Changing `a` or `b` requires the user's explicit authorization. A plan, script,
or inferred semantic-version interpretation cannot supply that authorization.

An authorized `a` or `b` transition must run in this order:

1. Align, publish, and registry-verify the Framework packages in the new
   `a.b.n` family.
2. Prove those public packages through the generated-app consumer path, then
   manually align and release the applicable `create-app/<app>` CLI package.
3. Only after the Framework and CLI stages pass, manually align root `asyra`
   to `a.b.0`.

The next stage must not begin from an unpublished, unverified, or mixed prior
stage. CLI and root version changes remain manual even when Framework package
changes in the same release family use Changesets.

During a staged family transition, the existing root manifest may retain its
older pre-alignment version until the final root stage. That temporary state is
not permission to patch or infer the root version early.

## Current Staged Family Decision

The current authorized family is read from the Framework package manifests and
the user-approved release decision; this rule never duplicates the numeric
family or target version. The applicable create-app CLI target is selected and
materialized manually after its candidate and public Framework consumer gates
pass. Root `asyra` aligns to the same family at `a.b.0` only after the CLI stage
completes. Neither CLI nor root belongs in the Framework Changeset.
