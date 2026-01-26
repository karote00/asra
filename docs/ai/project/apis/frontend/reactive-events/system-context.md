# System Context API

This domain manages events related to the overall state of the application context, such as the current tool, mouse position, and keyboard state.

## Primary Tool

---

### `switchPrimaryTool()`

- **Description**: Publishes an event to change the active primary tool.
- **Type**: Publisher
- **Signature**: `export const switchPrimaryTool = (tool: PrimaryToolType): void`
- **Parameters**:
  - `tool` (`PrimaryToolType`): The name of the tool to switch to.
- **Returns**: `void`
- **Associated Event**:
  - **Event Type**: `SWITCH_PRIMARY_TOOL`
  - **Payload Interface**: `SwitchPrimaryToolEvent`
- **Example**:

  ```typescript
  import { switchPrimaryTool } from '@asyra/reactive-events'

  switchPrimaryTool('select')
  ```

---

### `subscribeToSwitchPrimaryTool()`

- **Description**: Subscribes to the event that is fired when the primary tool is changed.
- **Type**: Subscriber
- **Signature**: `export const subscribeToSwitchPrimaryTool = (handler: (event: SwitchPrimaryToolEvent) => void): Subscription`
- **Parameters**:
  - `handler` (`(event: SwitchPrimaryToolEvent) => void`): A callback function to execute when the event is fired.
- **Returns**:
  - `Subscription`: An `rxjs` subscription object with an `.unsubscribe()` method.
- **Associated Event**:
  - **Event Type**: `SWITCH_PRIMARY_TOOL`
  - **Payload Interface**: `SwitchPrimaryToolEvent`
- **Example**:

  ```typescript
  const subscription = subscribeToSwitchPrimaryTool((event) => {
    console.log(`Tool switched to: ${event.payload.tool}`)
  })

  // Later, to clean up:
  subscription.unsubscribe()
  ```

---

### `emitSwitchPrimaryTool()`

- **Description**: Publishes a notification event to signal that the primary tool has finished changing. This is useful for triggering side effects in other parts of the application.
- **Type**: Publisher (Notification)
- **Signature**: `export const emitSwitchPrimaryTool = (): void`
- **Parameters**: None
- **Returns**: `void`
- **Associated Event**:
  - **Event Type**: `EMIT_SWITCH_PRIMARY_TOOL`
  - **Payload Interface**: `EmitSwitchPrimaryToolEvent` (empty payload)
- **Example**:
  ```typescript
  emitSwitchPrimaryTool()
  ```

---

### `requestCurrentPrimaryTool()`

- **Description**: **DEPRECATED** - This async request/response pattern has been removed. Use `SystemContextRequests.getSystemContextSnapshot()` via core request APIs for synchronous access.
- **Replacement**: Use `core.requests.systemContext.getSystemContextSnapshot()` to get current primary tool synchronously
- **Type**: **Removed**

---

### `finishRequestCurrentPrimaryTool()`

- **Description**: **DEPRECATED** - This async request/response pattern has been removed.
- **Type**: **Removed**

## Mouse State

---

### `updateMouseState()`

- **Description**: Publishes an event with the latest snapshot of the mouse state.
- **Type**: Publisher
- **Signature**: `export const updateMouseState = (mouseSnapshot: MouseSnapshot): void`
- **Parameters**:
  - `mouseSnapshot` (`MouseSnapshot`): An object containing the current mouse state (position, buttons, etc.).
- **Returns**: `void`
- **Associated Event**:
  - **Event Type**: `UPDATE_MOUSE_STATE`
  - **Payload Interface**: `UpdateMouseStateEvent`
- **Example**:
  ```typescript
  updateMouseState({ x: 100, y: 200, buttons: 0 })
  ```

---

### `subscribeToUpdateMouseState()`

- **Description**: Subscribes to mouse state updates.
- **Type**: Subscriber
- **Signature**: `export const subscribeToUpdateMouseState = (handler: (event: UpdateMouseStateEvent) => void): Subscription`
- **Parameters**:
  - `handler` (`(event: UpdateMouseStateEvent) => void`): A callback to execute with the latest mouse state.
- **Returns**: `Subscription`
- **Associated Event**:
  - **Event Type**: `UPDATE_MOUSE_STATE`
  - **Payload Interface**: `UpdateMouseStateEvent`
- **Example**:
  ```typescript
  const sub = subscribeToUpdateMouseState((event) => {
    console.log('Mouse at:', event.payload.x, event.payload.y)
  })
  ```

## Key State

---

### `updateKeyState()`

- **Description**: Publishes an event with the latest snapshot of the keyboard state.
- **Type**: Publisher
- **Signature**: `export const updateKeyState = (keySnapshot: KeySnapshot): void`
- **Parameters**:
  - `keySnapshot` (`KeySnapshot`): An object containing the current keyboard state.
- **Returns**: `void`
- **Associated Event**:
  - **Event Type**: `UPDATE_KEY_STATE`
  - **Payload Interface**: `UpdateKeyStateEvent`
- **Example**:
  ```typescript
  updateKeyState({ altKey: true, shiftKey: false })
  ```

---

### `subscribeToUpdateKeyState()`

- **Description**: Subscribes to keyboard state updates.
- **Type**: Subscriber
- **Signature**: `export const subscribeToUpdateKeyState = (handler: (event: UpdateKeyStateEvent) => void): Subscription`
- **Parameters**:
  - `handler` (`(event: UpdateKeyStateEvent) => void`): A callback to execute with the latest keyboard state.
- **Returns**: `Subscription`
- **Associated Event**:
  - **Event Type**: `UPDATE_KEY_STATE`
  - **Payload Interface**: `UpdateKeyStateEvent`
- **Example**:
  ```typescript
  const sub = subscribeToUpdateKeyState((event) => {
    if (event.payload.altKey) {
      console.log('Alt key is pressed')
    }
  })
  ```

## System Context Snapshot

---

### `requestSystemContextSnapshot()`

- **Description**: **DEPRECATED** - This async request/response pattern has been removed. Use `SystemContextRequests.getSystemContextSnapshot()` via core request APIs for synchronous access.
- **Replacement**: Use `core.requests.systemContext.getSystemContextSnapshot()` for synchronous system context access
- **Type**: **Removed**

---

### `finishRequestSystemContextSnapshot()`

- **Description**: **DEPRECATED** - This async request/response pattern has been removed.
- **Type**: **Removed**
