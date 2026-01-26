# Event Architect CLI

The **Event Architect CLI** (`add-event`) automates the boilerplate required to add new events to the `@asyra/reactive-events` package. It ensures consistency across definitions, publishers, and subscribers.

## Usage

You can run the CLI from the root of the repository or from the `packages/reactive-events` directory.

### Interactive Mode
Simply run the command without arguments to start the interactive wizard:

```bash
yarn workspace @asyra/reactive-events add-event
```

### Command Line Mode
You can pass arguments directly to skip prompts.

**Syntax:**
```bash
yarn workspace @asyra/reactive-events add-event [options]
```

**Options:**

| Flag | Description | Required | Default | Example |
|------|-------------|----------|---------|---------|
| `-n, --name` | Event Name (CamelCase) | Yes | - | `UpdateNode` |
| `-s, --scope` | Target Scope/Folder (kebab-case) | Yes | - | `scene-tree` |
| `-p, --pattern` | Pattern type (`simple` or `async`) | No | `simple` | `async` |
| `--payload` | Interface/Type definition for payload | No | - | `{ id: string }` |
| `--options` | Interface/Type definition for options | No | - | `{ undoable: boolean }` |

---

## Examples

### 1. Simple Event
A fire-and-forget event (e.g., selecting an element).

```bash
yarn workspace @asyra/reactive-events add-event \
  --name SelectElement \
  --scope selection \
  --pattern simple \
  --payload "{ elementIds: string[] }"
```

**Generates:**
- Enums: `SELECT_ELEMENT` in `types.ts`.
- Interface: `SelectElementEvent` in `selection/events.ts`.
- Publisher: `selectElement(payload)` in `selection/publish.ts`.
- Subscriber: `subscribeToSelectElement` in `selection/subscribes.ts`.

### 2. Async Event (Request/Response)
An event that expects a completion signal (e.g., saving data which might be async).

```bash
yarn workspace @asyra/reactive-events add-event \
  --name SaveData \
  --scope core \
  --pattern async \
  --payload "{ force: boolean }"
```

**Generates:**
- Enums: `SAVE_DATA` and `FINISH_SAVE_DATA`.
- Interfaces: `SaveDataEvent` (with `requestId`) and `FinishSaveDataEvent`.
- Publisher: `saveData()` returns a `Promise`, handles subscription to `Finish` event automatically.
- Subscriber: `subscribeToSaveData` and `subscribeToFinishSaveData`.

### 3. Event with Options
Adding extra meta-options (like undo/redo flags).

```bash
yarn workspace @asyra/reactive-events add-event \
  --name UpdateProp \
  --scope props-manager \
  --payload "{ key: string, value: any }" \
  --options "{ undoable: boolean }"
```

---

## Troubleshooting

- **Enum not found**: Ensure the `scope` exists as a folder and has a corresponding `[Scope]EventTypes` enum in `types.ts`. The CLI expects the enum name to be `{PascalCaseScope}EventTypes` (e.g., `scene-tree` -> `SceneTreeEventTypes`).
- **File not found**: The CLI strictly looks for `events.ts`, `publish.ts`, and `subscribes.ts` in `packages/reactive-events/src/[scope]/`. Ensure these files exist before running the command.
