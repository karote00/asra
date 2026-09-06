# Rule: Naming and Persisted Identities

## Scope

This rule applies to Framework packages, apps, tools, tests, configuration, and
generators when introducing or renaming programmatic identifiers. Naming is an
implementation input, not PR cleanup. Follow the bounded task contract; this
rule never authorizes unrelated repository-wide renames.

## Before Implementation

Before the first identifier-bearing edit:

1. Inspect the owning constants, registries, schemas, and direct consumers.
   Reuse an existing identity when it already represents the same contract.
2. Classify the proposed name: public product identity, internal identifier,
   persisted/wire identity, user data, or explicitly retained compatibility data.
3. Choose the semantic owner, namespace, and definition location. Keep one
   authoritative definition; do not duplicate literals across producers,
   consumers, tests, and UI adapters.
4. For persisted or externally consumed values, decide the version and load
   compatibility behavior before writing the new producer. Check existing
   files, database names, imports, reports, runtime registrations, and replay.
5. Record these choices briefly in the ordinary task plan or owner-step card.
   Do not create a separate naming ledger.
6. Run `yarn lint:naming` as a baseline before implementation. Report an existing
   out-of-scope failure rather than broadening the task silently.

If ownership, identity classification, or compatibility is unresolved, settle
that decision before propagating the name into other owners.

## Naming Contract

- Composite project-authored display names and appended metadata use ` - `
  (spaces around an ASCII hyphen) as their only separator. This applies across
  apps, packages, tools, sample names, titles, option labels, method versions,
  candidate/run names, pair labels, exports, and generated viewers. Do not use
  a middle dot, slash, pipe, en dash or em dash to join name parts. Rendered
  status/metadata separators follow the same convention for consistency.
- This is an authoring/presentation rule, not a data migration: preserve exact
  user-entered names, persisted identities and immutable historical evidence.
  Do not replace characters in incoming or saved names. Actual paths, package
  coordinates, arithmetic, alternative shortcuts and standalone logo artwork
  are not name concatenation. Change generator sources before regenerating
  their owned output.
- Internal variables, types, classes, events, capabilities, component/property
  types, DOM hooks, storage defaults, and tool identifiers use semantic,
  brand-neutral names. Product branding is not a default code namespace.
- Public package coordinates, executables, repository paths, official product
  display names, and distribution identities retain their real identities.
  Do not rename `@asyra/*` imports or replace official product names with generic
  labels to satisfy the internal naming rule.
- New app-owned wire formats and persisted schema identities must be chosen
  deliberately and remain neutral unless an established external protocol
  requires an exact name. A string literal can be a compatibility contract even
  when the app has not been publicly released.
- User-entered names and immutable historical evidence are data, not internal
  identifiers to rewrite during a naming cleanup.
- Follow existing owner grouping and registry conventions. New code must not
  register both old and new runtime aliases merely to avoid a migration.

## Validate Before Names Spread

Run `yarn lint:naming` immediately after the first coherent identifier-bearing
slice, before adding downstream producers or consumers. Run it again at the
completed owner/stage boundary and before committing. PR creation, push, CI, and
release are later backstops, never the first naming review.

The command invokes the formal brand-neutral identifier and display-separator
gates. The display gate scans maintained runtime/render sources, including
generated viewers and templates, for literal or encoded middle-dot separators
and alternate separators inside named display literals. Focused UI/report tests
cover name composition and retained-data preservation. Passing these gates
does not replace the semantic ownership and persistence review above. Run
the affected registration, serialization, import, replay, and ordinary app tests
as required by the changed contract.

## Existing Data and Exceptions

- Move necessary old-data handling into an explicit, version-bounded load
  adapter before normal validation. New runtime state and output use the
  current contract; unknown versions and invalid references remain errors.
- Preserve user text, entity IDs, source bytes/digests, and historical analysis
  evidence unless a separately approved product migration requires otherwise.
- Renaming a database default must not silently strand existing app data. The
  app may explicitly retain its established database identity, or implement a
  separately specified and tested migration. Never silently clear or relocate it.
- Retained wire identities must be literal, centralized, and limited to the
  compatibility owner and its formal fixtures. Any naming-gate exception needs
  an exact value, exact owner paths, a compatibility reason, and negative tests
  proving ordinary runtime code remains rejected. Do not whitelist an app tree.
- Do not split, concatenate, encode, or reconstruct a prohibited internal name
  to evade the gate. Deriving a real public distribution name from its official
  product identity is not an internal identifier exception.

Authority for unreleased data handling remains
`pre-release-legacy-removal.md`; released APIs also follow
`deprecation-lifecycle.md`. Test-first corrections follow `bugfix-test-first.md`.
