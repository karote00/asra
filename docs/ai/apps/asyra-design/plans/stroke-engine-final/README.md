# Stroke Engine Documentation Location

The canonical Stroke Engine specification is:

- `docs/ai/apps/asyra-design/specs/stroke-engine/SPEC.md`

The canonical Stroke target data and its Flow Inspector viewer entry are:

- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html`

The data file directly defines the complete Stroke target contract. It does not
import or re-export another Inspector data file. The HTML keeps the established
viewer shell and embeds a synchronized snapshot of the shared renderer from
`tools/flow-inspector/viewer.js`, so the viewer remains directly openable.

This file contains no Stroke Engine semantics or execution state.
