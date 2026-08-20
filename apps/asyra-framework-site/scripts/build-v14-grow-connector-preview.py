from __future__ import annotations

import runpy
from pathlib import Path
from typing import Any

from PIL import Image


SITE_ROOT = Path(__file__).resolve().parents[1]
V13_BUILDER = SITE_ROOT / "scripts" / "build-v13-grow-connector-preview.py"
V14_ARTWORK = SITE_ROOT / "artwork" / "v14-desktop"

REFERENCE_SIZE = (370, 275)
TARGET_SIZE = (285, 206)
TRACE_SCALE = 4

LEFT_SUPPORT_MODE = "rests_on_red_block_edge"
RIGHT_SUPPORT_MODE = "inserted_through_white_module_ring"
RED_BLOCK_SUPPORT_EDGE = 49
WHITE_MODULE_FACE_EDGE = 337
RIGHT_INSERTION_RING_BOX = (318, 101, 337, 226)
RIGHT_INSERTION_RING_STYLE = "left_chrome_collar"


def load_v13_renderer() -> dict[str, Any]:
    renderer = runpy.run_path(str(V13_BUILDER))
    required = (
        "load_v12_renderer",
        "resize_pipe_to_two_pipe_width",
        "verify_exact_source_widths",
        "verify_reservoir_pipe_proportions",
    )
    missing = [name for name in required if name not in renderer]
    if missing:
        raise RuntimeError(f"V13 renderer is missing contracts: {missing}")
    return renderer


def render_right_insertion_ring(
    renderer: dict[str, Any],
    reference: Image.Image,
    high_size: tuple[int, int],
) -> Image.Image:
    ring = Image.new("RGBA", high_size, (0, 0, 0, 0))
    renderer["REFERENCE_LAYERS"][RIGHT_INSERTION_RING_STYLE] = (
        RIGHT_INSERTION_RING_BOX
    )
    renderer["render_distinct_collar"](
        ring,
        reference,
        RIGHT_INSERTION_RING_STYLE,
    )
    return ring


def verify_left_edge_has_no_joint(ring: Image.Image) -> None:
    red_block_edge = round(
        RED_BLOCK_SUPPORT_EDGE * ring.width / REFERENCE_SIZE[0]
    )
    left_connection_zone = ring.crop(
        (
            max(0, red_block_edge - 24 * TRACE_SCALE),
            0,
            min(ring.width, red_block_edge + 24 * TRACE_SCALE),
            ring.height,
        )
    )
    if left_connection_zone.getbbox() is not None:
        raise RuntimeError("V14 added a joint where the trough rests on the red block")


def verify_right_insertion_depth() -> None:
    ring_left, _, ring_right, _ = RIGHT_INSERTION_RING_BOX
    if ring_left != 318 or ring_right != WHITE_MODULE_FACE_EDGE:
        raise RuntimeError("V14 insertion ring drifted from the white module face")
    if ring_left != 318:
        raise RuntimeError("V14 pipe no longer reaches the insertion ring")
    if 344 <= ring_right:
        raise RuntimeError("V14 reservoir no longer passes behind the insertion ring")


def verify_v14_support_model(renderer: dict[str, Any]) -> None:
    reservoir_box = renderer["REFERENCE_LAYERS"]["lower_reservoir"]
    if reservoir_box[0] != RED_BLOCK_SUPPORT_EDGE:
        raise RuntimeError("V14 reservoir no longer rests directly on the red block edge")
    if LEFT_SUPPORT_MODE != "rests_on_red_block_edge":
        raise RuntimeError("V14 left support model drifted")
    if RIGHT_SUPPORT_MODE != "inserted_through_white_module_ring":
        raise RuntimeError("V14 right support model drifted")
    verify_right_insertion_depth()


def build() -> tuple[Image.Image, Image.Image]:
    v13 = load_v13_renderer()
    v12 = v13["load_v12_renderer"]()
    renderer = v12["load_v10_renderer"]()
    reference = renderer["extract_reference"]()
    v13["verify_exact_source_widths"](renderer)
    verify_v14_support_model(renderer)

    high_size = (TARGET_SIZE[0] * TRACE_SCALE, TARGET_SIZE[1] * TRACE_SCALE)
    reservoir = v12["isolate_lower_reservoir"](renderer, reference, high_size)
    pipe = v13["resize_pipe_to_two_pipe_width"](
        v12["render_one_center_pipe"](renderer, reference, high_size)
    )
    ring = render_right_insertion_ring(renderer, reference, high_size)
    v13["verify_reservoir_pipe_proportions"](reservoir, pipe)
    verify_left_edge_has_no_joint(ring)

    connector = Image.new("RGBA", high_size, (0, 0, 0, 0))
    connector.alpha_composite(reservoir)
    connector.alpha_composite(pipe)
    connector.alpha_composite(ring)
    v12["verify_v12_preview"](reservoir, pipe, connector)
    return (
        v12["crop_red_connector_preview"](connector),
        v12["build_two_end_context_preview"](connector),
    )


def main() -> None:
    preview, context = build()
    V14_ARTWORK.mkdir(parents=True, exist_ok=True)
    preview.save(
        V14_ARTWORK / "grow-v14-red-connector-preview.png",
        format="PNG",
        optimize=True,
    )
    context.save(
        V14_ARTWORK / "grow-v14-two-end-context-preview.png",
        format="PNG",
        optimize=True,
    )


if __name__ == "__main__":
    main()
