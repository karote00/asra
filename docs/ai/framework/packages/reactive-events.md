# Package: @asyra/reactive-events

## Responsibility

Provide typed cross-package event communication.

## Owns

- event type definitions
- publish/subscribe APIs
- typed payload contracts for shared events

## Must Not Own

- domain policy decisions
- package-internal state machines
- app UI state

## Rules

- Cross-package communication should use typed events or core request APIs.
- Event names and payloads are framework contracts.
- Avoid ad-hoc untyped payloads for core event channels.

## Extension Points

- add event module namespaces for new domains
- add typed publish/subscribe helpers for new event families
- register app/preset custom event names via `eventRegistry.register(eventName)`

## Validation Checklist

- Publisher and subscriber payload types stay aligned.
- Event contracts are versioned/deprecated deliberately.
- Removing an event has migration notes in docs.
