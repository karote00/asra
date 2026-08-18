from __future__ import annotations

import runpy
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageStat


SITE_ROOT = Path(__file__).resolve().parents[1]
V10_BUILDER = SITE_ROOT / "scripts" / "build-v10-grow-desktop.py"
V06_MASTER = SITE_ROOT / "artwork" / "v06" / "grow-master.png"
V12_ARTWORK = SITE_ROOT / "artwork" / "v12-desktop"

REFERENCE_SIZE = (370, 275)
TARGET_SIZE = (285, 206)
TRACE_SCALE = 4
LOWER_RESERVOIR_TOP = 118
CENTER_PIPE_Y = 117
LEFT_END_COLLAR_WIDTH = 20
RIGHT_END_COLLAR_WIDTH = 18
MASTER_CROP = (0, 50, 1518, 950)
TARGET_BOX = (895, 340, 1180, 546)
CONTEXT_CROP = (610, 240, 1465, 660)
CONTEXT_RESTORE_BANDS = (
    (928, 390, 1150, 590),
)


def load_v10_renderer() -> dict[str, Any]:
    renderer = runpy.run_path(str(V10_BUILDER))
    required = (
        "extract_reference",
        "render_asymmetric_reservoir",
        "render_single_center_tube",
        "render_distinct_collar",
        "map_point",
    )
    missing = [name for name in required if name not in renderer]
    if missing:
        raise RuntimeError(f"V10 renderer is missing contracts: {missing}")
    return renderer


def isolate_lower_reservoir(
    renderer: dict[str, Any],
    reference: Image.Image,
    high_size: tuple[int, int],
) -> Image.Image:
    full_reservoir = Image.new("RGBA", high_size, (0, 0, 0, 0))
    renderer["render_asymmetric_reservoir"](full_reservoir, reference)

    cutoff_y = round(LOWER_RESERVOIR_TOP * high_size[1] / REFERENCE_SIZE[1])
    alpha = full_reservoir.getchannel("A")
    alpha_values = list(alpha.getdata())
    for y in range(cutoff_y):
        row_start = y * high_size[0]
        alpha_values[row_start : row_start + high_size[0]] = [0] * high_size[0]
    alpha.putdata(alpha_values)
    full_reservoir.putalpha(alpha)
    return full_reservoir


def render_one_center_pipe(
    renderer: dict[str, Any],
    reference: Image.Image,
    high_size: tuple[int, int],
) -> Image.Image:
    pipe = Image.new("RGBA", high_size, (0, 0, 0, 0))
    renderer["SINGLE_CENTER_TUBE_Y"] = CENTER_PIPE_Y
    renderer["SINGLE_CENTER_TUBE_HEIGHT"] = 4
    renderer["render_single_center_tube"](pipe, reference)
    return pipe


def render_shortened_original_collars(
    renderer: dict[str, Any],
    reference: Image.Image,
    high_size: tuple[int, int],
) -> Image.Image:
    collars = Image.new("RGBA", high_size, (0, 0, 0, 0))
    reference_layers = renderer["REFERENCE_LAYERS"]
    reference_layers["left_chrome_collar"] = (
        25,
        101,
        25 + LEFT_END_COLLAR_WIDTH,
        225,
    )
    reference_layers["right_clamp"] = (
        365 - RIGHT_END_COLLAR_WIDTH,
        101,
        365,
        226,
    )
    for name in ("left_chrome_collar", "right_clamp"):
        renderer["render_distinct_collar"](collars, reference, name)
    return collars


def verify_end_collar_widths(collars: Image.Image) -> None:
    center_x = collars.width // 2
    left_bounds = collars.crop((0, 0, center_x, collars.height)).getbbox()
    right_bounds = collars.crop(
        (center_x, 0, collars.width, collars.height)
    ).getbbox()
    if left_bounds is None or right_bounds is None:
        raise RuntimeError("V12 lost one of its two end collars")

    left_width = left_bounds[2] - left_bounds[0]
    right_width = right_bounds[2] - right_bounds[0]
    left_limit = round(
        (LEFT_END_COLLAR_WIDTH + 20) * collars.width / REFERENCE_SIZE[0]
    )
    right_limit = round(
        (RIGHT_END_COLLAR_WIDTH + 20) * collars.width / REFERENCE_SIZE[0]
    )
    if left_width > left_limit or right_width > right_limit:
        raise RuntimeError(
            "V12 end collars are wider than the approved half-width profile"
        )


def crop_red_connector_preview(connector: Image.Image) -> Image.Image:
    bounds = connector.getbbox()
    if bounds is None:
        raise RuntimeError("V12 red connector preview rendered empty")
    margin = 8 * TRACE_SCALE
    left = max(0, bounds[0] - margin)
    top = max(0, bounds[1] - margin)
    right = min(connector.width, bounds[2] + margin)
    bottom = min(connector.height, bounds[3] + margin)
    return connector.crop((left, top, right, bottom))


def restore_context_background_band(
    master: Image.Image,
    box: tuple[int, int, int, int],
) -> None:
    left, top, right, bottom = box
    top_row = list(master.crop((left, top - 1, right, top)).getdata())
    bottom_row = list(master.crop((left, bottom, right, bottom + 1)).getdata())
    height = bottom - top
    for y in range(top, bottom):
        amount = (y - top + 1) / (height + 1)
        row = Image.new("RGBA", (right - left, 1))
        row.putdata(
            [
                tuple(
                    round(start[channel] + (end[channel] - start[channel]) * amount)
                    for channel in range(4)
                )
                for start, end in zip(top_row, bottom_row)
            ]
        )
        master.paste(row, (left, y))


def verify_context_background_continuity(
    master: Image.Image,
    boxes: tuple[tuple[int, int, int, int], ...],
) -> None:
    for left, top, right, bottom in boxes:
        boundaries = ((top - 1, top), (bottom - 1, bottom))
        for outside_y, inside_y in boundaries:
            outside = master.crop((left, outside_y, right, outside_y + 1))
            inside = master.crop((left, inside_y, right, inside_y + 1))
            difference = ImageChops.difference(outside, inside).convert("RGB")
            mean_difference = sum(ImageStat.Stat(difference).mean) / 3
            if mean_difference > 12:
                raise RuntimeError("V12 context background contains a visible patch seam")


def verify_context_background_neutrality(
    master: Image.Image,
    boxes: tuple[tuple[int, int, int, int], ...],
) -> None:
    for box in boxes:
        red, green, blue, _ = ImageStat.Stat(master.crop(box)).mean
        red_excess = red - (green + blue) / 2
        if red_excess > 18:
            raise RuntimeError("V12 context retained red contamination from an old pipe")


def build_two_end_context_preview(connector: Image.Image) -> Image.Image:
    master = Image.open(V06_MASTER).convert("RGBA").crop(MASTER_CROP)
    for band in CONTEXT_RESTORE_BANDS:
        restore_context_background_band(master, band)
    verify_context_background_continuity(master, CONTEXT_RESTORE_BANDS)
    verify_context_background_neutrality(master, CONTEXT_RESTORE_BANDS)

    target_width = TARGET_BOX[2] - TARGET_BOX[0]
    target_height = TARGET_BOX[3] - TARGET_BOX[1]
    fitted = connector.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )
    master.alpha_composite(fitted, TARGET_BOX[:2])
    context = master.crop(CONTEXT_CROP)
    if context.getbbox() is None:
        raise RuntimeError("V12 two-end context preview rendered empty")
    return context


def verify_v12_preview(
    reservoir: Image.Image,
    pipe: Image.Image,
    connector: Image.Image,
) -> None:
    cutoff_y = round(LOWER_RESERVOIR_TOP * connector.height / REFERENCE_SIZE[1])
    pipe_y = round(CENTER_PIPE_Y * connector.height / REFERENCE_SIZE[1])
    center_left = round(72 * connector.width / REFERENCE_SIZE[0])
    center_right = round(248 * connector.width / REFERENCE_SIZE[0])

    if reservoir.crop((center_left, 0, center_right, cutoff_y)).getbbox() is not None:
        raise RuntimeError("V12 retained pixels from the upper red trough")
    if pipe_y >= cutoff_y:
        raise RuntimeError("V12 center pipe is not above the lower reservoir")
    pipe_probe = pipe.crop(
        (
            center_left,
            max(0, pipe_y - 5 * TRACE_SCALE),
            center_right,
            min(pipe.height, pipe_y + 8 * TRACE_SCALE),
        )
    )
    if pipe_probe.getbbox() is None:
        raise RuntimeError("V12 lost the single centered pipe")
    if connector.getbbox() is None:
        raise RuntimeError("V12 connector rendered empty")


def build() -> tuple[Image.Image, Image.Image]:
    renderer = load_v10_renderer()
    reference = renderer["extract_reference"]()
    high_size = (TARGET_SIZE[0] * TRACE_SCALE, TARGET_SIZE[1] * TRACE_SCALE)
    reservoir = isolate_lower_reservoir(renderer, reference, high_size)
    pipe = render_one_center_pipe(renderer, reference, high_size)
    collars = render_shortened_original_collars(renderer, reference, high_size)
    verify_end_collar_widths(collars)

    connector = Image.new("RGBA", high_size, (0, 0, 0, 0))
    connector.alpha_composite(reservoir)
    connector.alpha_composite(pipe)
    connector.alpha_composite(collars)
    verify_v12_preview(reservoir, pipe, connector)
    return (
        crop_red_connector_preview(connector),
        build_two_end_context_preview(connector),
    )


def main() -> None:
    preview, context = build()
    V12_ARTWORK.mkdir(parents=True, exist_ok=True)
    preview.save(
        V12_ARTWORK / "grow-v12-red-connector-preview.png",
        format="PNG",
        optimize=True,
    )
    context.save(
        V12_ARTWORK / "grow-v12-two-end-context-preview.png",
        format="PNG",
        optimize=True,
    )


if __name__ == "__main__":
    main()
