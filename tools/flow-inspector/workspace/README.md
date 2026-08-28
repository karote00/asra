# Flow Inspector Static Workspace

Static React workspace for discovering and opening every current-project Flow
Inspector from one sidebar. The checked-in Vite build uses classic scripts, so
`workspace.html` can be opened directly from the repository with a `file:` URL
and does not require a development server.

## Use

Open `tools/flow-inspector/workspace/workspace.html` in a browser. Select an
Inspector from the sidebar or open a stable deep link:

```text
workspace.html#inspector=<catalog-id>
```

The selected Inspector is rendered in a keyed iframe so switching targets
cannot retain the previous target's DOM or global state. Existing standalone
Inspector HTML files remain independently openable.

## Develop and verify

```bash
yarn workspace @asyra/flow-inspector typecheck
yarn workspace @asyra/flow-inspector test:local
yarn workspace @asyra/flow-inspector build
node tools/flow-inspector/workspace/generate-workspace.cjs
```

The React source lives in `tools/flow-inspector/src/`. Vite emits the committed
classic JavaScript and CSS under `workspace/generated/`; the catalog generator
emits `workspace-bundle.data.js` from the current Inspector sources.

The workspace is intentionally read-only. Dynamic evidence, CI state,
commands, actions, and permissions belong to the future sibling under
`tools/flow-inspector/control-plane/`.
