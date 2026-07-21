# Epic: State and Panels

## Goal

Keep app UI panels and tool indicators synchronized with runtime state through explicit registration and provider patterns.

## Included Capabilities

- ui/system property registrations
- provider hooks for panel/tool UI
- properties panel mode-based section switching
- contents panel virtualization and selection state

## Implementation Streams

1. registration layer

- `packages/preset/src/ui/register-properties.ts`
- `packages/preset/src/defaults/modules/{input,selection,vector-editing,viewport,ui-context}.ts`
- Asyra Design selects these defaults through `applyPreset(core)` and does not
  own a parallel registration directory.

2. provider/hook layer

- `apps/asyra-design/src/hooks/useProperty.ts`
- `apps/asyra-design/src/providers/*`

3. panel layer

- `apps/asyra-design/src/properties/*`
- `apps/asyra-design/src/contents/*`
- `apps/asyra-design/src/toolbar/*`

## Done Criteria

- panel visibility rules are stable and documented
- provider keys reuse Preset-managed keys or explicit app-owned keys
- E2E selectors remain stable
