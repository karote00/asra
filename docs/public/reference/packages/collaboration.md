# `@asyra/collaboration`

Optional provider-replaceable transport for completed Factory publications and
separate ephemeral Awareness.

## Owns

- explicit Collaboration start/disconnect/reconnect/dispose lifecycle
- FIFO outbound publication handoff and exclusive inbound callback handoff
- provider status/failure and collaboration publication outcomes
- Awareness lifecycle and resource-ownership cleanup

## Does not own

Canonical documents, CRDT state, app payload validation, authorization,
conflict policy, durable outbox, reconnect history, backend storage, or
presence-as-document behavior.

## Compose when

Compose it when an app has immutable Factory `SharedPublication` values and a
real provider/remote-apply policy. Do not compose it for single-user products
or expect it to infer a backend. Omitted composition creates no room, provider,
Awareness runtime, or network side effect.

## Public entrypoints and prerequisites

Use the public `@asyra/collaboration` entrypoint. Provide document, room, and
actor ids, `publicationSource.subscribe(...)`, a `Provider`, and
`processRemotePublication(...)`. Public reference providers are `MemoryHub` and
`MemoryProvider`; they prove in-process handoff, not production networking.

## Lifecycle, inputs, outputs, and failure

Construction is inert; `start()` binds the source and connects. Connected
publications are sent once in FIFO order. Inbound publications reach the app
callback once and remain pending until app processing settles. A disconnected
outbound publication is skipped and not retained. Active send or processing
failure reports its declared outcome without retroactively changing a settled
local transaction. `dispose()` destroys only owned resources.

## Relationships

Factory owns publications and remote transactions. The app owns validation and
canonical apply. Providers own wire framing, capacity, queue position, and
connection. Persistence and backends own checkpoints and durability. Awareness
stays outside all of those canonical routes.

## Maintained use path

Follow [Build opt-in collaboration](../../build/collaboration.md) for the
publication subscription, inbound app validation, remote transaction, and
separate ephemeral presence flow.

## Replacement and disabled behavior

Any provider implementing the public contract can replace the memory provider.
Apps can inject owned or borrowed Provider/Awareness resources. When disabled,
ordinary local transactions, load/save, rendering, and AI continue without a
Collaboration runtime. Offline recovery requires an app-owned outbox.

## Support, migration, and deprecation

The publication-source composition is current. The Factory-shaped input is a
deprecated compatibility adapter; new code supplies
`publicationSource.subscribe(...)`. Migration must preserve publication
identity/order and keep Awareness separate. App wire protocol and backend
changes are outside package semver promises.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/collaboration.md)
- [Package manifest](../../../../packages/collaboration/package.json)
- [Opt-in collaboration guide](../../build/collaboration.md)

Version, dependencies, and root export are manifest-generated in the public
package reference. The documentation gate checks this guide against the exact
release inventory.
