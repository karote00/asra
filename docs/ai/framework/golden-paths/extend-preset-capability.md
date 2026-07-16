# Golden Path: Extend a Preset Capability

## Preconditions

- The target behavior belongs to preset defaults, not framework runtime ownership.
- The app/product requirement is domain-specific or product-specific.
- The target registration key, feature name, property type, event name, render layer name, or selection channel is known.

## Steps

1. Classify the target

- feature behavior
- shortcut/input mapping
- event contract
- component/property/schema behavior
- render layer or interaction target
- selection channel/default wiring

2. Prefer extension when available

- query `getPresetExtensionTarget(targetKey)` and verify the required strategy
- pass ordered `PresetExtension[]` through `applyPreset(core, { extensions })`
- keep extension keys and owners stable, and always return owned cleanup
- handle `ExtensionContractError.code`; do not retry through duplicate tolerance

Feature example:

```ts
import {
  PRESET_EXTENSION_TARGETS,
  applyPreset,
  type PresetExtension
} from '@asyra/preset'

const extensions: PresetExtension[] = [
  {
    key: 'asyra-design.selection-feature',
    targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
    owner: { packageName: '@asyra/asyra-design', name: 'selection' },
    strategy: 'append',
    install: ({ core }) => {
      const registration = core.defineFeature('selection', undefined, {
        api: { owner: 'asyra-design' }
      })
      return () => registration.dispose()
    }
  }
]

const presetApplication = applyPreset(core, { extensions })
```

3. Use replacement when extension is unavailable

- do not call `applyPreset` with an unsupported strategy
- apply defaults, call `presetApplication.unregisterTarget(targetKey)`, and
  proceed only after its structured success result
- register the app/product-owned replacement through public Core APIs
- property cleanup may remove only its target-owned `schema` or `runtime` part;
  active/live or replay-retained property instances block unregister

Property runtime fallback example:

```ts
import { PRESET_EXTENSION_TARGETS, applyPreset } from '@asyra/preset'
import { PropertyTypes } from '@asyra/utils'

const presetApplication = applyPreset(core)
const targetKey =
  PRESET_EXTENSION_TARGETS.PROPERTY_RUNTIMES[PropertyTypes.POSITION]

presetApplication.unregisterTarget(targetKey)
core.definePropertyComponent({
  type: PropertyTypes.POSITION,
  defaults: { x: 0, y: 0 }
})
```

4. Keep ownership explicit

- framework owns runtime primitives and validation
- preset owns optional defaults
- app/product owns domain behavior and workflows
- render engine selection remains separate and never determines a product mode

5. Verify behavior

- test the app/product behavior directly
- verify transaction grouping and undo/redo semantics
- verify runtime invalid writes are rejected
- verify load-time fallback still works when persisted data is invalid or old
- verify render remains derived from framework/system state

## Verification Checklist

- The extension or replacement does not import preset/framework internals for app policy.
- The default can still be skipped, replaced, or moved in future package extraction.
- Duplicate registration, missing target, and override conflicts fail with actionable errors.
- Active observers, handlers, or render targets are cleaned up when unregistering.
- The feature or capability remains deterministic across startup order and reload.

## Common Failure Cases

- patching a preset implementation file for product-specific behavior
- relying on registration order instead of explicit priority/strategy
- replacing a capability without cleaning up observers or render interaction targets
- preserving UI behavior while breaking save/load or undo/redo contracts
