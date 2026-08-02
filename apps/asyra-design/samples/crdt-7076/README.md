# CRDT 7,076 Sample

Open two App windows with the same document URL:

```text
http://localhost:3000/?fileId=crdt-7076-sample
```

In Actor A:

1. Open the Agent panel.
2. Attach `reference-image.png`.
3. Paste the complete contents of `instruction.txt`.
4. Press Send.

Opening the URL alone does not create anything. The ordinary Agent request sends
the image and instruction to the same-origin action-batch backend. After the
backend matches both exact inputs, it reads `converted-vector-data.svg` and
returns one prepared `AiActionBatch`.

The checked-in conversion contains 7,075 editable Vector children. The App
creates one Group around those children, so Actor A and Actor B each finish with
7,076 canonical elements.

This sample request does not run VTracer or another image converter. Actor A
executes, renders, publishes, and persists through the ordinary product owners;
Actor B receives the drawing only through CRDT and persists the accepted remote
state.
