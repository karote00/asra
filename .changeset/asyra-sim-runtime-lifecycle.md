---
'@asyra/core': patch
'@asyra/factory': patch
'@asyra/feature-system': patch
'@asyra/input-system': patch
'@asyra/preset': patch
'@asyra/props-manager': patch
'@asyra/render': patch
'@asyra/scene-tree': patch
'@asyra/selection': patch
'@asyra/system-context': patch
'@asyra/ui-context': patch
'@asyra/utils': patch
---

Support owner-coordinated runtime replacement for applications such as Asyra Sim.
Quiesce feature work before retiring runtime-owned state, subscriptions, input
bindings, render resources, and registration graphs. Retain preset installation
cleanup and prevent callbacks from a retired runtime from affecting its successor.

Expose Core document-load preflight and validated renderer resizing through the
public facade. Applications can validate a replacement document before retiring
the active runtime, while ordinary document loading retains its existing history
ownership contract.
