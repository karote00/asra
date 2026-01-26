# Design Principle: Event Creation Process

This document outlines the standard process and naming conventions for adding a new event to the `@asyra/reactive-events` system. Adhering to this process ensures that the event system remains consistent, predictable, and easy to navigate.

## Guiding Principle

Every distinct user action or system event should be represented by a complete, self-contained set of types, functions, and files within the `@asyra/reactive-events` package. This keeps all event-related logic centralized.

## Process and File Structure

When adding a new event for a conceptual domain (e.g., "Primary Tool"), follow these steps:

1.  **Create a Domain Directory**: If one does not already exist, create a new directory under `packages/reactive-events/src/`. The name should be kebab-case (e.g., `primary-tool`).

2.  **Create Domain Files**: Inside this new directory (`primary-tool/`), create the following files:
    *   `events.ts`: To define the event's TypeScript interface.
    *   `publish.ts`: To define the event's publish function.
    *   `subscribes.ts`: To define the event's subscribe function.
    *   `index.ts`: To export all the above modules.

3.  **Update Global Files**:
    *   Add a new enum member to `packages/reactive-events/src/types.ts`.
    *   Export the new domain module from `packages/reactive-events/src/index.ts`.

## Naming and Casing Conventions

We use a consistent naming convention based on the action's name. Let's use the example action: **"Switch Primary Tool"**.

| Category          | Convention            | Example                               |
| ----------------- | --------------------- | ------------------------------------- |
| **Action Name**   | Title Case            | `Switch Primary Tool`                 |
| **EventType Enum**| `SCREAMING_SNAKE_CASE`| `SWITCH_PRIMARY_TOOL`                 |
| **Event Interface**| `PascalCase` + `Event`| `SwitchPrimaryToolEvent`              |
| **Publish Function**| `camelCase`           | `switchPrimaryTool`                   |
| **Subscribe Function**| `subscribeTo` + `PascalCase` | `subscribeToSwitchPrimaryTool`        |

### Example Implementation

**1. Event Type (`types.ts`)**
```typescript
export enum PrimaryToolEventTypes {
  SWITCH_PRIMARY_TOOL = 'switchPrimaryTool'
}
```

**2. Event Interface (`primary-tool/events.ts`)**
```typescript
export interface SwitchPrimaryToolEvent {
  type: 'switchPrimaryTool';
  payload: { tool: string };
}
```

**3. Publish Function (`primary-tool/publish.ts`)**
```typescript
import { publishEvent } from '../../event-bus';
import { SwitchPrimaryToolEvent } from './events';

export const switchPrimaryTool = (payload: SwitchPrimaryToolEvent['payload']) => {
  publishEvent({ type: 'switchPrimaryTool', payload });
};
```

**4. Subscribe Function (`primary-tool/subscribes.ts`)**
```typescript
import { createSubscribeEvent } from '../../event-bus';
import { SwitchPrimaryToolEvent } from './events';

export const subscribeToSwitchPrimaryTool = createSubscribeEvent<SwitchPrimaryToolEvent>('switchPrimaryTool');
```
