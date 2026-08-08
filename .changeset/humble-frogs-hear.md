---
'@asyra/collaboration': patch
'@asyra/core': patch
'@asyra/preset': patch
'@asyra/render': patch
---

Route app runtime and collaboration through Core, restore fast authoritative collaboration synchronization, and refresh the standalone Asyra Design template.

Initialize document connection state at `none`, publish only actual state changes, and notify every connection transition except the initial `none` to `connected` transition.
