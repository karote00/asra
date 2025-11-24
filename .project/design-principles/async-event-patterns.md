# Design Principle: Asynchronous Event Patterns

This document outlines the standard patterns for handling asynchronous operations within the `@asra/reactive-events` system. These patterns are crucial for managing state synchronization and data retrieval in a decoupled architecture.

## 1. Request/Response Pattern (for Pulling Data)

When a package needs to actively request data from another part of the system and receive a response, it must use the **Request/Response** pattern.

**Use Case**: Getting a specific piece of state on demand (e.g., "What is the current primary tool?").

### Structure:

-   **`request<Action>` function**: This function initiates the request.
    -   It **must** return a `Promise`.
    -   It generates a unique `requestId` for tracking.
    -   It subscribes to the corresponding `finishRequest<Action>` event, filtering by the `requestId`.
    -   It publishes the `request<Action>` event with the `requestId` in the payload.
    -   It resolves the Promise with the payload from the `finish` event and then unsubscribes.

-   **`finishRequest<Action>` function**: This function is called by the system that holds the requested data.
    -   It publishes the `finishRequest<Action>` event.
    -   The payload **must** include the original `requestId` and the requested data.

### Example: Getting the Current Primary Tool

**A. The Requesting Function (`requestCurrentPrimaryTool`)**
```typescript
// In a file like packages/reactive-events/src/primary-tool/publish.ts

export const requestCurrentPrimaryTool = () => {
  return new Promise<PrimaryToolType>((resolve) => {
    const requestId = generateRequestId();
    let subscription: Subscription | null = null;

    const handler = ({ payload }: FinishRequestCurrentPrimaryToolEvent) => {
      if (payload.requestId !== requestId) return;
      subscription?.unsubscribe();
      resolve(payload.tool);
    };

    subscription = subscribeToFinishRequestCurrentPrimaryTool(handler);

    publishEvent({
      type: 'requestCurrentPrimaryTool',
      payload: { requestId },
    });
  });
};
```

**B. The Responding Function (`finishRequestCurrentPrimaryTool`)**
```typescript
// In the same file

export const finishRequestCurrentPrimaryTool = (
  requestId: string,
  tool: PrimaryToolType
) => {
  publishEvent({
    type: 'finishRequestCurrentPrimaryTool',
    payload: { requestId, tool },
  });
};
```

## 2. Emit/Notification Pattern (for Pushing Updates)

When a package completes an action and other parts of the system need to be notified to react to the change, it must use the **Emit/Notification** pattern.

**Use Case**: Announcing that a state has changed so other packages can update themselves (e.g., "The primary tool has just been switched, re-render if you care."). This is a "fire-and-forget" broadcast.

### Structure:

-   **`emit<Action>` function**: This function is called after the primary action has completed.
    -   It publishes an `emit<Action>` event.
    -   The payload is typically empty, as it serves only as a signal.

### Example: Notifying of a Tool Switch

```typescript
// In a file like packages/reactive-events/src/primary-tool/publish.ts

export const emitSwitchPrimaryTool = () => {
  publishEvent({
    type: 'emitSwitchPrimaryTool',
  });
};
```
