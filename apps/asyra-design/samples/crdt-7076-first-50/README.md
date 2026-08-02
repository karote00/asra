# CRDT 7,076 First-50 Render Sample

This checked-in sample is the first 50 Scene Tree records from the existing
`crdt-7076` canonical document: one Workspace, one Group, and 48 Vector
elements. The 48 Vectors contain 22,928 point records in total, including five
Vectors with more than 1,000 points. All persisted property values and
`pointCoordinateSpace: workspace` data are copied without migration or
rewriting.

## Generate or refresh the sample

From the repository root:

```sh
yarn workspace @asyra/asyra-design generate:crdt-7076-first-50-document
```

The generator reads the checked-in 7,076 sample, keeps the first 50 Scene Tree
records, filters Group children to the selected elements, follows every
referenced Props record, verifies the fixed point-count contract, and writes
`document.json.gz`.

## Manual render test

1. Stop any Asyra Design App and Collaboration server already using ports
   `3000` or `4101`.
2. From the repository root, start the App without Collaboration:

   ```sh
   VITE_COLLABORATION_WS_URL=' ' yarn workspace @asyra/asyra-design react:start
   ```

3. Open:

   ```text
   http://localhost:3000/?fileId=crdt-7076-first-50-sample
   ```

4. Wait until the Canvas and Layers panel settle. The database-unavailable
   toast is expected when no document database backend is running; it must not
   prevent the bundled sample from loading.
5. Verify the cat-face subset renders and the browser console contains no
   `[Preset Vector]`, `[RenderLayer] Element render strategy failed`, or
   canonical-local-geometry errors.
6. In the Layers panel, expand the single Group and verify 48 Vector children
   are present. The five dense targets are:
   - `tabby-vector-0002`: 2,591 points
   - `tabby-vector-0009`: 1,512 points
   - `tabby-vector-0008`: 1,306 points
   - `tabby-vector-0003`: 1,136 points
   - `tabby-vector-0006`: 1,129 points
7. Select `tabby-vector-0002` in the Layers panel and drag the selected Vector
   several times on Canvas. Each drag must stay responsive; the shape and
   selection/path overlay must move together without shifting its points.
8. Resize the same Vector, rotate it, then Undo and Redo each action. Geometry,
   fill/stroke, hit area, selection outline, and path-edit handles must remain
   aligned.
9. If service-unavailable toasts are visible, verify each has a top-right close
   button, disappears automatically after 10 seconds if left open, and lets the
   lower toast transition upward when the upper toast closes.
10. Reload the page. The resulting geometry and transform must match the
   pre-reload appearance when a document database backend is available. Without
   that backend, reload intentionally restores the checked-in sample.

To compare against the complete dataset, open
`http://localhost:3000/?fileId=crdt-7076-sample`.

The matching automated render test is:

```sh
yarn workspace @asyra/asyra-design playwright test \
  --config playwright.first-50.config.ts
```
