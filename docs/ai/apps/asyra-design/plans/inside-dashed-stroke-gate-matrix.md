# Inside Dashed Stroke Gate Matrix

**Status:** active working matrix  
**Scope:** fast classification of proposed gates for `inside + dashed` work  
**Purpose:** make it easy to decide whether a new metric should be:

- a production hard gate
- an artifact gate
- a diagnostic-only signal
- explicitly rejected as a correctness target

Related documents:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-spec.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-spec.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-active-snapshot.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-active-snapshot.md)

---

## Matrix

| Candidate gate / metric | Layer | Why |
| --- | --- | --- |
| authored dash/gap interval ownership on path arc length | production hard gate | canonical schedule contract |
| explicit scenario classification (`promotable-local-gap`, `round-cap-canonical-gap`, `remote-pollution`, `scenario-owned-gap`) | production hard gate | runtime must not merge incompatible scenarios |
| local-gap promotion excludes remote-pollution | production hard gate | remote cases must not be “fixed” by local repair |
| local-gap promotion excludes scenario-owned gaps | production hard gate | higher-order scenarios must keep ownership |
| canonical straight-side round-cap pairs stay excluded from local-gap promotion | production hard gate | prevents false repair of healthy geometry |
| final visible coverage for accepted split-pair / seam runtime paths | production hard gate | final-face correctness is the real runtime target |
| contributor identity for active remote case (`dash 28`, `exact-cubic`, `[3]`) stays recoverable | production hard gate | remote case must not silently collapse into a fake local case |
| Family B keeps neighboring-exclusive / remote-exclusive / overlap regions | artifact gate | proves decomposition family is geometrically meaningful |
| Family B recomposed union matches source contributor union in the local window | artifact gate | proves decomposition is faithful to contributor geometry |
| Family B has no raster overcoverage | artifact gate | proves decomposition is not hiding overlap with a worse overlap |
| Family B is selected as the only artifact-viable family | artifact gate | useful for direction choice, not enough for runtime |
| runtime reject contract remains active for artifact-ready Family B | artifact gate | prevents accidental promotion without ownership policy |
| `body-only`, `cap-only`, `raw`, `wedge`, `ownership` stage outputs | diagnostic-only | useful for locating failure stage, not final correctness by themselves |
| contributor count / intrusion ratio / source kind / touched segment indices | diagnostic-only | useful for classification and debugging, not sufficient as final correctness |
| clear ratio / coverage ratio by themselves | diagnostic-only | comparison signal only; they do not define ownership |
| “every visible gap must be fully clear” | rejected target | too strong; breaks healthy round-cap cases |
| “body-only should match final” | rejected target | false for accepted split-pair / seam behavior |
| “artifact-ready means runtime-ready” | rejected target | decomposition quality does not define runtime ownership |

---

## Shortcut Rules

Use these quick checks before introducing a new hard gate.

### Promote To Production Hard Gate Only If

- it constrains canonical schedule ownership
- it preserves accepted scenario taxonomy
- it describes final runtime visibility rather than only an intermediate stage
- it does not force healthy round-cap cases into stricter gap preservation
- it can be explained without sample-specific reasoning

### Keep As Artifact Gate If

- it is evaluating a prototype family
- it proves decomposition quality but not runtime ownership
- it helps choose between Family A / B / C without yet defining production
  policy

### Keep As Diagnostic-Only If

- it mainly tells you where a bug enters the pipeline
- it mainly describes contributor identity or stage-local intrusion
- it is useful for comparison but does not answer who owns the region

### Reject As A Correctness Target If

- it tries to enforce one visual rule across all scenario classes
- it would erase healthy round-cap symmetry
- it would treat remote overlap as a local neighbor failure
- it would allow artifact success to bypass missing ownership rules

---

## Current Reading For Remote Pollution

For the active reported sample:

- `remote-pollution` classification is a production hard gate
- preserving contributor identity is a production hard gate
- Family B decomposition quality is an artifact gate
- Family B runtime rejection remains an artifact gate
- stage-local visuals remain diagnostic-only

This is the current matrix to use before adding any new remote-pollution gate.
