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

## Where this runs

System-level information is registered from the app's composition module while
Core composition is open. Product Features then read and update it through the
same Core facade. Element-level information belongs in app-owned component and
property registrations instead.

## Maintained implementation paths

Keep this page as the ownership model, then choose the guide that matches the
information your product owns:

- For element-level information, follow
  [Build a custom component and schema](../build/custom-schema.md).
- For system-level information, use the public Core and System Context
  registration boundaries documented in the
  [System Context package guide](../reference/packages/system-context.md).

Those guides contain the concrete calls and failure behavior. The app still
defines the field names and domain meaning; the selected Framework owner stores
and validates the canonical value.

## Flow

1. The app registers the model and its initial value during composition.
2. A Feature or app API validates domain intent.
3. Core routes the accepted value to the canonical System Context owner.
4. Render, UI, persistence, collaboration, or AI retrieval may read a detached
   snapshot as a projection.
5. If the app abandons composition before startup, it unregisters the
   property; after startup, the registration stays fixed for that Core
   instance.

## Expected result

The registered canonical value can be read from its owner without requiring a
visual object, transport connection, provider credential, or second source of
truth. Missing, duplicated, invalid, or post-start registration changes fail at
the owner boundary.

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
- [System Context package guide](../reference/packages/system-context.md)

## Next

- [Give every state one canonical owner](canonical-state.md)
- [Build a custom component and schema](../build/custom-schema.md)
