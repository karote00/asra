# Event Bus API

The `event-bus.ts` module provides the core mechanism for publishing and subscribing to events across the application. It leverages RxJS `ReplaySubject` to ensure late subscribers can receive the latest event (buffer size 1).

## Core Functions

---

### `publishEvent()`

-   **Description**: Publishes an event to the global event bus.
-   **Type**: Core Utility
-   **Signature**: `export const publishEvent = (event: AllEvent): void`
-   **Parameters**:
    -   `event` (`AllEvent`): The event object to publish. Must conform to one of the defined event interfaces.
-   **Returns**: `void`
-   **Example**:
    ```typescript
    import { publishEvent } from '@asyra/reactive-events';
    
    publishEvent({
      type: 'SOME_EVENT_TYPE',
      payload: { ... }
    });
    ```

---

### `subscribeToEvents()`

-   **Description**: Subscribes to *all* events flowing through the bus. Useful for debugging or logging.
-   **Type**: Core Utility
-   **Signature**: `export const subscribeToEvents = (subscriber: (event: AllEvent) => void): Subscription`
-   **Parameters**:
    -   `subscriber` (`(event: AllEvent) => void`): A callback function that receives every event published.
-   **Returns**: `Subscription`
-   **Example**:
    ```typescript
    const sub = subscribeToEvents((event) => {
      console.log('Event received:', event.type);
    });
    ```

---

### `getEventBus()`

-   **Description**: Returns the underlying RxJS `ReplaySubject` instance.
-   **Type**: Core Utility
-   **Signature**: `export const getEventBus = (): ReplaySubject<AllEvent>`
-   **Returns**: `ReplaySubject<AllEvent>`

---

### `getEventBusObserve()`

-   **Description**: Returns the event bus as a read-only `Observable`.
-   **Type**: Core Utility
-   **Signature**: `export const getEventBusObserve = (): Observable<AllEvent>`
-   **Returns**: `Observable<AllEvent>`

---

### `createSubscribeEvent()`

-   **Description**: A higher-order function to create a type-safe subscriber for a specific event type. Used internally to generate the domain-specific subscriber functions.
-   **Type**: Factory
-   **Signature**: 
    ```typescript
    export const createSubscribeEvent = <T extends AllEvent>(
      type: EventTypes,
      operators: [...AppOperatorFunction<T>[]] = [],
      defaultIndex = 0
    ) => (subscriber: (event: T) => void) => Subscription
    ```
-   **Parameters**:
    -   `type` (`EventTypes`): The specific event type to filter for.
    -   `operators` (`AppOperatorFunction[]`): Optional RxJS operators to apply to the stream.
    -   `defaultIndex` (`number`): Index where the default filter operator should be inserted.
-   **Returns**: A function that accepts a handler and returns a Subscription.

---

### `createEventStream()`

-   **Description**: Creates an Observable stream restricted to a specific event type.
-   **Type**: Factory
-   **Signature**:
    ```typescript
    export const createEventStream = <T extends AllEvent>(
      eventType: EventTypes,
      reloadAction?: () => void
    ): Observable<T>
    ```
-   **Parameters**:
    -   `eventType` (`EventTypes`): The event type to filter the stream by.
    -   `reloadAction` (`() => void`): Optional side-effect action to run when the stream emits (e.g., triggering a UI reload).
-   **Returns**: `Observable<T>`
