# Plan: Resume Subpath From Clicked Point In Pen Mode

## Scope

When pen is in split/new-subpath mode (not currently connected), clicking an existing vector anchor should select it instead of creating a new point immediately.

If the clicked anchor is a valid endpoint of a subpath, pen should resume continuation from that subpath so preview and next append operate on that subpath.

## Steps

1. pen start behavior update
- in path-editing + pen + `startNewSubpath=true`, detect click hit on existing editable anchor
- select the clicked anchor and skip point creation on that click

2. continuation target resolution
- resolve whether selected anchor is a subpath endpoint (`start` or `end`)
- only endpoint selection exits split mode for continuation

3. append routing update
- when appending next point, route connection using selected endpoint/subpath instead of always using last subpath tail
- preserve existing default flow when no explicit continuation target exists

4. docs and tests
- update pen feature contract docs
- add E2E for:
  - split mode click on anchor selects anchor without adding point
  - next click appends to the same subpath continuation target

## Validation

- `yarn workspace @asyra/asyra-design react:build` passes
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts --workers=1` passes

## Result

Completed on 2026-03-02.

- in split/new-subpath mode, clicking an existing anchor now selects it without creating a point on that click
- when the clicked anchor is a valid endpoint, pen continuation resumes from that endpoint for preview and next append
- append routing now follows explicit continuation target instead of always defaulting to the latest subpath tail
