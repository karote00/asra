# Information models come before output

An Asyra product begins with information and rules, not with a canvas. Your app
defines what an item means, which fields are valid, which relationships exist,
and which operations are allowed. Visual rendering, collaboration, persistence,
and AI action are optional consumers of that canonical model.

This separation is why the same infrastructure can support a design object, a
whiteboard node, a BIM element, a simulated factory asset, or a machine-facing
record without teaching the Framework those domains.

## Ownership

- The app owns property names, schema meaning, domain constraints, commands,
  permissions, and migration interpretation.
- Props Manager owns registered property definitions, runtime values, and
  schema validation.
- Scene Tree owns canonical element hierarchy and declared relations.
- System Context owns registered system-level managed properties.
- Core exposes the supported composition and coordination facade.

Do not store the same canonical fact in a component, React state, a render
object, collaboration presence, and a backend cache. Choose one canonical
owner; everything else is a projection, transport representation, or derived
view.

## Executable path

Run:

```shell
yarn examples:run core-information-model
```

The app defines the meaning of a status record. The current Framework owns its
registration and deterministic update. Render, Collaboration, and AI are not
composed. The expected result is revision `1` with status `verified`.

For element-level information, continue with
[Build a custom component and schema](../build/custom-schema.md), which links
the exact `definePropertyComponent`, `registerPropertySchema`, and
`defineComponent` proof.

## Information can have many projections

A visual app may register render strategies and layers. An AI-enabled app may
retrieve selected canonical information and expose registered actions. A
collaborative app may publish canonical changes. A persistence adapter may
serialize validated owner state. None of those projections becomes the source
of truth merely because it is visible, remote, or expensive to compute.

Future non-visible products may eventually compose the same owner model through
an explicit Core Kernel. The current release has no such lifecycle; see the
[runtime roadmap](runtime-boundaries-roadmap.md).

## Validate your model

- every canonical field has one owner and one schema;
- invalid writes and invalid loads fail at the owner boundary;
- derived UI or render state can be rebuilt from canonical information;
- one domain action enters one transaction;
- optional capabilities can be removed without changing model meaning; and
- app-domain names and rules do not leak into Framework packages.

## Canonical sources

- [Framework Essentials](../../ai/framework/FRAMEWORK_ESSENTIALS.md)
- [Core contract](../../ai/framework/packages/core.md)
- [Verified information-model example](../../examples/core-information-model.mjs)

## Next

- [Give every state one canonical owner](canonical-state.md)
- [Build a custom component and schema](../build/custom-schema.md)
