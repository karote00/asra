from __future__ import annotations

import runpy
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat


SITE_ROOT = Path(__file__).resolve().parents[1]
V12_BUILDER = SITE_ROOT / "scripts" / "build-v12-grow-connector-preview.py"
V06_MASTER = SITE_ROOT / "artwork" / "v06" / "grow-master.png"
V13_ARTWORK = SITE_ROOT / "artwork" / "v13-desktop"

REFERENCE_SIZE = (370, 275)
TARGET_SIZE = (285, 206)
TRACE_SCALE = 4
TARGET_MASTER_LEFT = 895

# Exact approved widths from the two requested source versions.
RESERVOIR_LEFT = 49
RESERVOIR_RIGHT = 344
V06_PIPE_RED_LEFT = 936
V06_PIPE_RED_RIGHT = 1140
PIPE_LEFT = 53
PIPE_RIGHT = 318

# Each joint straddles the actual module boundary it connects to.
LEFT_JOINT_BOX = (43, 101, 61, 225)
RIGHT_JOINT_BOX = (318, 101, 337, 226)
LEFT_END_STYLE = "right_clamp"
RIGHT_END_STYLE = "left_chrome_collar"


def load_v12_renderer() -> dict[str, Any]:
    renderer = runpy.run_path(str(V12_BUILDER))
    required = (
        "load_v10_renderer",
        "isolate_lower_reservoir",
        "render_one_center_pipe",
        "crop_red_connector_preview",
        "build_two_end_context_preview",
        "verify_v12_preview",
    )
    missing = [name for name in required if name not in renderer]
    if missing:
        raise RuntimeError(f"V12 renderer is missing contracts: {missing}")
    return renderer


def resize_pipe_to_two_pipe_width(pipe: Image.Image) -> Image.Image:
    original_left = round(37 * pipe.width / REFERENCE_SIZE[0])
    original_right = round(351 * pipe.width / REFERENCE_SIZE[0])
    target_left = round(PIPE_LEFT * pipe.width / REFERENCE_SIZE[0])
    target_right = round(PIPE_RIGHT * pipe.width / REFERENCE_SIZE[0])

    source = pipe.crop((original_left, 0, original_right, pipe.height))
    resized = source.resize(
        (target_right - target_left, pipe.height),
        Image.Resampling.LANCZOS,
    )
    fitted = Image.new("RGBA", pipe.size, (0, 0, 0, 0))
    fitted.alpha_composite(resized, (target_left, 0))
    return fitted


def render_attachment_aware_collars(
    renderer: dict[str, Any],
    reference: Image.Image,
    high_size: tuple[int, int],
) -> Image.Image:
    collars = Image.new("RGBA", high_size, (0, 0, 0, 0))
    reference_layers = renderer["REFERENCE_LAYERS"]
    reference_layers[LEFT_END_STYLE] = LEFT_JOINT_BOX
    reference_layers[RIGHT_END_STYLE] = RIGHT_JOINT_BOX
    renderer["render_distinct_collar"](collars, reference, LEFT_END_STYLE)
    renderer["render_distinct_collar"](collars, reference, RIGHT_END_STYLE)
    return collars


def verify_exact_source_widths(renderer: dict[str, Any]) -> None:
    reservoir_box = renderer["REFERENCE_LAYERS"]["lower_reservoir"]
    if reservoir_box[0] != RESERVOIR_LEFT or reservoir_box[2] != RESERVOIR_RIGHT:
        raise RuntimeError("V13 reservoir width drifted from the original design")

    master = Image.open(V06_MASTER).convert("RGB")
    red_pixels: list[tuple[int, int]] = []
    for y in range(459, 533):
        for x in range(920, 1180):
            red, green, blue = master.getpixel((x, y))
            if red > 95 and red > green * 1.45 and red > blue * 1.35:
                red_pixels.append((x, y))
    measured_left = min(x for x, _ in red_pixels)
    measured_right = max(x for x, _ in red_pixels) + 1
    if measured_left != V06_PIPE_RED_LEFT or measured_right != V06_PIPE_RED_RIGHT:
        raise RuntimeError("V13 pipe width drifted from the two-pipe V06 design")

    mapped_left = round(
        (V06_PIPE_RED_LEFT - TARGET_MASTER_LEFT)
        * REFERENCE_SIZE[0]
        / TARGET_SIZE[0]
    )
    mapped_right = round(
        (V06_PIPE_RED_RIGHT - TARGET_MASTER_LEFT)
        * REFERENCE_SIZE[0]
        / TARGET_SIZE[0]
    )
    if mapped_left != PIPE_LEFT or mapped_right != PIPE_RIGHT:
        raise RuntimeError("V13 source-to-preview pipe mapping drifted")


def verify_reservoir_pipe_proportions(
    reservoir: Image.Image,
    pipe: Image.Image,
) -> None:
    reservoir_bounds = reservoir.getbbox()
    pipe_bounds = pipe.getbbox()
    if reservoir_bounds is None or pipe_bounds is None:
        raise RuntimeError("V13 reservoir or pipe rendered empty")
    if RESERVOIR_RIGHT - RESERVOIR_LEFT <= PIPE_RIGHT - PIPE_LEFT:
        raise RuntimeError("V13 reservoir is not wider than its centered pipe")
    reservoir_center = (RESERVOIR_LEFT + RESERVOIR_RIGHT) / 2
    pipe_center = (PIPE_LEFT + PIPE_RIGHT) / 2
    if abs(reservoir_center - pipe_center) > 12:
        raise RuntimeError("V13 pipe is no longer centered over the reservoir")


def masked_luminance(image: Image.Image) -> float:
    alpha = image.getchannel("A")
    return float(ImageStat.Stat(image.convert("L"), mask=alpha).mean[0])


def verify_attachment_materials(collars: Image.Image) -> None:
    center_x = collars.width // 2
    left = collars.crop((0, 0, center_x, collars.height))
    right = collars.crop((center_x, 0, collars.width, collars.height))
    if left.getbbox() is None or right.getbbox() is None:
        raise RuntimeError("V13 lost an attachment joint")
    if masked_luminance(left) + 20 >= masked_luminance(right):
        raise RuntimeError("V13 joint materials do not match their attached modules")


def build() -> tuple[Image.Image, Image.Image]:
    v12 = load_v12_renderer()
    renderer = v12["load_v10_renderer"]()
    reference = renderer["extract_reference"]()
    verify_exact_source_widths(renderer)

    high_size = (TARGET_SIZE[0] * TRACE_SCALE, TARGET_SIZE[1] * TRACE_SCALE)
    reservoir = v12["isolate_lower_reservoir"](renderer, reference, high_size)
    pipe = resize_pipe_to_two_pipe_width(
        v12["render_one_center_pipe"](renderer, reference, high_size)
    )
    collars = render_attachment_aware_collars(renderer, reference, high_size)
    verify_reservoir_pipe_proportions(reservoir, pipe)
    verify_attachment_materials(collars)

    connector = Image.new("RGBA", high_size, (0, 0, 0, 0))
    connector.alpha_composite(reservoir)
    connector.alpha_composite(pipe)
    connector.alpha_composite(collars)
    v12["verify_v12_preview"](reservoir, pipe, connector)
    return (
        v12["crop_red_connector_preview"](connector),
        v12["build_two_end_context_preview"](connector),
    )


def main() -> None:
    preview, context = build()
    V13_ARTWORK.mkdir(parents=True, exist_ok=True)
    preview.save(
        V13_ARTWORK / "grow-v13-red-connector-preview.png",
        format="PNG",
        optimize=True,
    )
    context.save(
        V13_ARTWORK / "grow-v13-two-end-context-preview.png",
        format="PNG",
        optimize=True,
    )


if __name__ == "__main__":
    main()
