# Plan: SelectionManager Multi-Channel Selection Architecture

## Scope

Promote SelectionManager to channel-first selection ownership for:
- `ELEMENT`
- `VECTOR_POINT`
- `VECTOR_SEGMENT`

with concurrent cross-channel selection support.

## Steps

1. contracts and constants
- add channel/action constants and typed payload support for point/segment channels

2. reactive events + core APIs
- add publish/subscribe flows for vector point and segment selection
- expose core APIs for channel writes

3. selection package channelization
- add `VectorPointSelection` and `VectorSegmentSelection`
- remove legacy `VertexSelection`
- register and subscribe all channels via shared selection manager path

4. ui-context/render/app integration
- consume point/segment channel updates in ui-context and render stores
- migrate app feature/property flows to `selectionApis` point/segment channel reads/writes
- keep `selectedVectorPoint` as compatibility mirror derived from channel state

## Validation

- `yarn workspace @asyra/selection test:local` passes
- `yarn workspace @asyra/ui-context test:local` passes
- `yarn workspace @asyra/render test:local` passes
- `yarn workspace @asyra/asyra-design react:build` passes

## Result

Completed on 2026-03-03.

- SelectionManager is now the source-of-truth for element/point/segment channels
- point and segment selection channels can coexist with element selection
- app/runtime layers subscribe to channel changes through shared event pipelines
