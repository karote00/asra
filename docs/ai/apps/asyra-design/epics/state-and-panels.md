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
- `registrations/ui-properties.ts`
- `registrations/aggregate-properties.ts`
- `registrations/system-properties.ts`

2. provider/hook layer
- `hooks/useProperty.ts`
- `providers/*`

3. panel layer
- `properties/*`
- `contents/*`
- `toolbar/*`

## Done Criteria

- panel visibility rules are stable and documented
- provider keys align with registration keys
- E2E selectors remain stable
