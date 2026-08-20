from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageStat


SITE_ROOT = Path(__file__).resolve().parents[1]
V04_REFERENCE = SITE_ROOT / "public" / "illustrations" / "grow-v04-1920.webp"
V06_MASTER = SITE_ROOT / "artwork" / "v06" / "grow-master.png"
V10_ARTWORK = SITE_ROOT / "artwork" / "v10-desktop"
OUTPUT = SITE_ROOT / "public" / "illustrations"

REFERENCE_BOX = (1100, 450, 1470, 725)
TARGET_BOX = (895, 340, 1180, 546)
MASTER_CROP = (0, 50, 1518, 950)
OUTPUT_WIDTH = 1500
TRACE_SCALE = 4
SINGLE_CENTER_TUBE_Y = 117
SINGLE_CENTER_TUBE_HEIGHT = 4

# Pixel-space measurements from the approved 370 x 275 V04 connector crop.
# These layers stay separate because the enlarged product-owner reference shows
# different depth, material, and silhouette for each one.
REFERENCE_LAYERS = {
    "upper_trough": (48, 50, 344, 113),
    "center_pipe": (
        34,
        SINGLE_CENTER_TUBE_Y,
        354,
        SINGLE_CENTER_TUBE_Y + SINGLE_CENTER_TUBE_HEIGHT,
    ),
    "lower_reservoir": (49, 122, 344, 199),
    "bottom_support": (45, 197, 349, 223),
    "left_chrome_collar": (25, 43, 67, 225),
    "middle_clamp": (254, 77, 284, 207),
    "right_clamp": (330, 41, 365, 226),
}


def extract_reference() -> Image.Image:
    return Image.open(V04_REFERENCE).convert("RGB").crop(REFERENCE_BOX)


def measure_reference_layers() -> dict[str, dict[str, float]]:
    measurements: dict[str, dict[str, float]] = {}
    for name, (left, top, right, bottom) in REFERENCE_LAYERS.items():
        measurements[name] = {
            "width": right - left,
            "height": bottom - top,
            "center_x": (left + right) / 2,
            "center_y": (top + bottom) / 2,
        }
    return measurements


def sample_reference_band(
    reference: Image.Image,
    box: tuple[int, int, int, int],
    vertical_position: float,
    thickness: int = 5,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    y = round(top + (bottom - top) * vertical_position)
    inset = max(4, round((right - left) * 0.18))
    band = reference.crop(
        (
            left + inset,
            max(top, y - thickness),
            right - inset,
            min(bottom, y + thickness + 1),
        )
    )
    red, green, blue = ImageStat.Stat(band).median
    return round(red), round(green), round(blue), 255


def sample_point(
    reference: Image.Image, point: tuple[int, int], radius: int = 2
) -> tuple[int, int, int, int]:
    x, y = point
    sample = reference.crop((x - radius, y - radius, x + radius + 1, y + radius + 1))
    red, green, blue = ImageStat.Stat(sample).median
    return round(red), round(green), round(blue), 255


def map_box(
    box: tuple[int, int, int, int], size: tuple[int, int]
) -> tuple[int, int, int, int]:
    source_width = REFERENCE_BOX[2] - REFERENCE_BOX[0]
    source_height = REFERENCE_BOX[3] - REFERENCE_BOX[1]
    left, top, right, bottom = box
    return (
        round(left * size[0] / source_width),
        round(top * size[1] / source_height),
        round(right * size[0] / source_width),
        round(bottom * size[1] / source_height),
    )


def map_point(point: tuple[int, int], size: tuple[int, int]) -> tuple[int, int]:
    source_width = REFERENCE_BOX[2] - REFERENCE_BOX[0]
    source_height = REFERENCE_BOX[3] - REFERENCE_BOX[1]
    return (
        round(point[0] * size[0] / source_width),
        round(point[1] * size[1] / source_height),
    )


def interpolate(
    start: tuple[int, int, int, int],
    end: tuple[int, int, int, int],
    amount: float,
) -> tuple[int, int, int, int]:
    return tuple(
        round(start[channel] + (end[channel] - start[channel]) * amount)
        for channel in range(4)
    )


def render_gradient_box(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    colors: tuple[
        tuple[int, int, int, int],
        tuple[int, int, int, int],
        tuple[int, int, int, int],
    ],
    radius: int,
    outline: tuple[int, int, int, int] | None = None,
    outline_width: int = 1,
) -> None:
    left, top, right, bottom = box
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer_draw = ImageDraw.Draw(layer)
    midpoint = (top + bottom) / 2
    for y in range(top, bottom + 1):
        if y <= midpoint:
            amount = (y - top) / max(1, midpoint - top)
            color = interpolate(colors[0], colors[1], amount)
        else:
            amount = (y - midpoint) / max(1, bottom - midpoint)
            color = interpolate(colors[1], colors[2], amount)
        layer_draw.line((left, y, right, y), fill=color, width=1)
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        box,
        radius=radius * TRACE_SCALE,
        fill=255,
    )
    layer.putalpha(mask)
    canvas.alpha_composite(layer)
    if outline is not None:
        ImageDraw.Draw(canvas).rounded_rectangle(
            box,
            radius=radius * TRACE_SCALE,
            outline=outline,
            width=outline_width * TRACE_SCALE,
        )


def render_profile_box(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    stops: tuple[tuple[float, tuple[int, int, int, int]], ...],
    radius: int,
    outline: tuple[int, int, int, int] | None = None,
) -> None:
    left, top, right, bottom = box
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for y in range(top, bottom + 1):
        position = (y - top) / max(1, bottom - top)
        if position <= stops[0][0]:
            draw.line((left, y, right, y), fill=stops[0][1], width=1)
            continue
        if position >= stops[-1][0]:
            draw.line((left, y, right, y), fill=stops[-1][1], width=1)
            continue
        lower_stop = stops[0]
        upper_stop = stops[-1]
        for start, end in zip(stops, stops[1:]):
            if start[0] <= position <= end[0]:
                lower_stop, upper_stop = start, end
                break
        span = max(0.0001, upper_stop[0] - lower_stop[0])
        amount = (position - lower_stop[0]) / span
        draw.line(
            (left, y, right, y),
            fill=interpolate(lower_stop[1], upper_stop[1], amount),
            width=1,
        )
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        box,
        radius=radius * TRACE_SCALE,
        fill=255,
    )
    layer.putalpha(mask)
    canvas.alpha_composite(layer)
    if outline is not None:
        ImageDraw.Draw(canvas).rounded_rectangle(
            box,
            radius=radius * TRACE_SCALE,
            outline=outline,
            width=TRACE_SCALE,
        )


def render_reference_layer(
    canvas: Image.Image,
    reference: Image.Image,
    name: str,
    radius: int,
) -> None:
    high_size = canvas.size
    source_box = REFERENCE_LAYERS[name]
    box = map_box(source_box, high_size)
    left, top, right, bottom = box
    colors = (
        sample_reference_band(reference, source_box, 0.08),
        sample_reference_band(reference, source_box, 0.52),
        sample_reference_band(reference, source_box, 0.92),
    )

    shadow_mask = Image.new("L", high_size, 0)
    ImageDraw.Draw(shadow_mask).rounded_rectangle(
        box,
        radius=radius * TRACE_SCALE,
        fill=215,
    )
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(4 * TRACE_SCALE))
    shadow = Image.new("RGBA", high_size, (20, 15, 13, 0))
    shadow.putalpha(shadow_mask.point(lambda value: round(value * 0.46)))
    canvas.alpha_composite(shadow, (0, 3 * TRACE_SCALE))

    render_gradient_box(
        canvas,
        box,
        colors,
        radius,
    )


def render_asymmetric_reservoir(
    canvas: Image.Image,
    reference: Image.Image,
) -> None:
    render_reference_layer(canvas, reference, "bottom_support", radius=4)
    render_reference_layer(canvas, reference, "lower_reservoir", radius=5)
    render_reference_layer(canvas, reference, "upper_trough", radius=5)

    draw = ImageDraw.Draw(canvas)

    def line(
        x1: int,
        x2: int,
        y: int,
        sample: tuple[int, int],
        width: int = 1,
    ) -> None:
        draw.line(
            (*map_point((x1, y), canvas.size), *map_point((x2, y), canvas.size)),
            fill=sample_point(reference, sample, radius=1),
            width=width * TRACE_SCALE,
        )

    # The approved upper trough is shallow: a bright top lip, a dark inset,
    # then a narrow lower edge immediately above the center tube.
    upper_lip = map_box((52, 52, 342, 66), canvas.size)
    render_gradient_box(
        canvas,
        upper_lip,
        (
            sample_point(reference, (190, 55), radius=1),
            sample_point(reference, (190, 61), radius=2),
            sample_point(reference, (190, 66), radius=2),
        ),
        radius=3,
        outline=sample_point(reference, (190, 52), radius=1),
    )
    upper_inset = map_box((58, 66, 337, 106), canvas.size)
    render_profile_box(
        canvas,
        upper_inset,
        tuple(
            (
                position,
                sample_reference_band(reference, (58, 66, 337, 106), position, 2),
            )
            for position in (0.08, 0.25, 0.5, 0.75, 0.92)
        ),
        radius=3,
        outline=sample_point(reference, (190, 66), radius=2),
    )
    upper_bottom_bevel = map_box((55, 104, 340, 113), canvas.size)
    render_gradient_box(
        canvas,
        upper_bottom_bevel,
        (
            sample_point(reference, (190, 104), radius=1),
            sample_point(reference, (190, 109), radius=1),
            sample_point(reference, (190, 112), radius=1),
        ),
        radius=2,
    )
    upper_side = sample_point(reference, (57, 86), radius=2)
    for side_box in ((52, 62, 59, 110), (336, 62, 343, 110)):
        draw.rounded_rectangle(
            map_box(side_box, canvas.size),
            radius=2 * TRACE_SCALE,
            fill=upper_side,
            outline=sample_point(reference, (55, 84), radius=1),
            width=TRACE_SCALE,
        )
    line(52, 342, 55, (190, 55), width=2)
    line(58, 337, 68, (190, 68))
    line(58, 337, 102, (190, 102))
    line(54, 340, 109, (190, 109), width=2)

    # The lower reservoir is visibly deeper and sits below the tube rather
    # than mirroring the upper trough. Its inner well and bottom rail remain
    # separate so the depth reads at desktop and at 200% inspection.
    lower_lip = map_box((54, 123, 340, 138), canvas.size)
    render_gradient_box(
        canvas,
        lower_lip,
        (
            sample_point(reference, (190, 126), radius=1),
            sample_point(reference, (190, 131), radius=2),
            sample_point(reference, (190, 137), radius=2),
        ),
        radius=3,
        outline=sample_point(reference, (190, 124), radius=1),
    )
    lower_inset = map_box((58, 137, 337, 190), canvas.size)
    render_profile_box(
        canvas,
        lower_inset,
        tuple(
            (
                position,
                sample_reference_band(reference, (58, 137, 337, 190), position, 2),
            )
            for position in (0.08, 0.25, 0.5, 0.75, 0.92)
        ),
        radius=4,
        outline=sample_point(reference, (190, 188), radius=2),
    )
    lower_bottom_bevel = map_box((56, 188, 339, 199), canvas.size)
    render_gradient_box(
        canvas,
        lower_bottom_bevel,
        (
            sample_point(reference, (190, 188), radius=1),
            sample_point(reference, (190, 194), radius=1),
            sample_point(reference, (190, 198), radius=1),
        ),
        radius=2,
    )
    lower_side = sample_point(reference, (57, 164), radius=2)
    for side_box in ((52, 130, 60, 195), (335, 130, 343, 195)):
        draw.rounded_rectangle(
            map_box(side_box, canvas.size),
            radius=2 * TRACE_SCALE,
            fill=lower_side,
            outline=sample_point(reference, (55, 164), radius=1),
            width=TRACE_SCALE,
        )
    line(54, 340, 126, (190, 126), width=2)
    line(58, 337, 139, (190, 139))
    line(58, 337, 150, (190, 150))
    line(58, 337, 190, (190, 190), width=2)
    line(49, 345, 204, (190, 204))


def render_single_center_tube(
    canvas: Image.Image,
    reference: Image.Image,
) -> None:
    draw = ImageDraw.Draw(canvas)
    left = 37
    right = 351
    center_y = SINGLE_CENTER_TUBE_Y

    # One slim tube only. The dark red casing separates it from both troughs;
    # a single silver-blue core sits on its exact vertical center.
    casing = map_box((left, center_y - 2, right, center_y + 6), canvas.size)
    draw.rounded_rectangle(
        casing,
        radius=3 * TRACE_SCALE,
        fill=sample_point(reference, (190, 113), radius=2),
        outline=sample_point(reference, (190, 121), radius=2),
        width=TRACE_SCALE,
    )
    tube = map_box(
        (
            left,
            center_y,
            right,
            center_y + SINGLE_CENTER_TUBE_HEIGHT,
        ),
        canvas.size,
    )
    tube_top = sample_point(reference, (190, 116), radius=1)
    tube_core = sample_reference_band(
        reference,
        REFERENCE_LAYERS["center_pipe"],
        0.5,
        thickness=1,
    )
    tube_bottom = sample_point(reference, (190, 120), radius=1)
    tube_left, tube_y1, tube_right, tube_y2 = tube
    for y in range(tube_y1, tube_y2 + 1):
        position = (y - tube_y1) / max(1, tube_y2 - tube_y1)
        if position < 0.5:
            color = interpolate(tube_top, tube_core, position * 2)
        else:
            color = interpolate(tube_core, tube_bottom, (position - 0.5) * 2)
        draw.line((tube_left, y, tube_right, y), fill=color, width=1)

    core_y = map_point((0, center_y + 2), canvas.size)[1]
    specular = interpolate(tube_core, (214, 229, 230, 255), 0.42)
    draw.line(
        (tube_left, core_y, tube_right, core_y),
        fill=specular,
        width=TRACE_SCALE,
    )


def render_distinct_collar(
    canvas: Image.Image,
    reference: Image.Image,
    name: str,
) -> None:
    box = map_box(REFERENCE_LAYERS[name], canvas.size)
    left, top, right, bottom = box
    draw = ImageDraw.Draw(canvas)

    shadow_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(shadow_mask).rounded_rectangle(
        box,
        radius=3 * TRACE_SCALE,
        fill=210,
    )
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(3 * TRACE_SCALE))
    shadow = Image.new("RGBA", canvas.size, (12, 9, 10, 0))
    shadow.putalpha(shadow_mask.point(lambda value: round(value * 0.55)))
    canvas.alpha_composite(shadow, (0, 2 * TRACE_SCALE))

    if name == "left_chrome_collar":
        render_gradient_box(
            canvas,
            box,
            ((70, 62, 62, 255), (232, 224, 218, 255), (55, 47, 49, 255)),
            radius=3,
            outline=(42, 35, 37, 255),
        )
        bright = (247, 242, 236, 255)
        red_reflection = sample_point(reference, (52, 118), radius=2)
        draw.line(
            (left + 7 * TRACE_SCALE, top, left + 7 * TRACE_SCALE, bottom),
            fill=bright,
            width=2 * TRACE_SCALE,
        )
        draw.line(
            (right - 7 * TRACE_SCALE, top, right - 7 * TRACE_SCALE, bottom),
            fill=red_reflection,
            width=2 * TRACE_SCALE,
        )
    elif name == "middle_clamp":
        render_gradient_box(
            canvas,
            box,
            ((46, 43, 44, 255), (182, 191, 191, 255), (32, 30, 32, 255)),
            radius=3,
            outline=(24, 22, 24, 255),
        )
        highlight = (210, 222, 221, 255)
        draw.rounded_rectangle(
            (
                left + 4 * TRACE_SCALE,
                top + 7 * TRACE_SCALE,
                right - 4 * TRACE_SCALE,
                bottom - 7 * TRACE_SCALE,
            ),
            radius=2 * TRACE_SCALE,
            outline=highlight,
            width=2 * TRACE_SCALE,
        )
        for y in (top + 18 * TRACE_SCALE, bottom - 18 * TRACE_SCALE):
            draw.ellipse(
                (
                    (left + right) // 2 - 2 * TRACE_SCALE,
                    y - 2 * TRACE_SCALE,
                    (left + right) // 2 + 2 * TRACE_SCALE,
                    y + 2 * TRACE_SCALE,
                ),
                fill=(235, 233, 226, 255),
            )
    else:
        render_gradient_box(
            canvas,
            box,
            ((28, 27, 29, 255), (112, 110, 108, 255), (20, 19, 21, 255)),
            radius=3,
            outline=(18, 17, 19, 255),
        )
        highlight = (145, 145, 140, 255)
        draw.line(
            (left + 4 * TRACE_SCALE, top, left + 4 * TRACE_SCALE, bottom),
            fill=highlight,
            width=2 * TRACE_SCALE,
        )


def render_connector(reference: Image.Image) -> Image.Image:
    target_size = (TARGET_BOX[2] - TARGET_BOX[0], TARGET_BOX[3] - TARGET_BOX[1])
    high_size = (target_size[0] * TRACE_SCALE, target_size[1] * TRACE_SCALE)
    connector = Image.new("RGBA", high_size, (0, 0, 0, 0))

    render_asymmetric_reservoir(connector, reference)
    render_single_center_tube(connector, reference)

    # Collars sit above every reservoir and tube layer in the approved image.
    for name in ("left_chrome_collar", "middle_clamp", "right_clamp"):
        render_distinct_collar(connector, reference, name)

    return connector.resize(target_size, Image.Resampling.LANCZOS)


def verify_rendered_connector_profile(connector: Image.Image) -> None:
    tube_box = map_box(REFERENCE_LAYERS["center_pipe"], connector.size)
    tube_height = tube_box[3] - tube_box[1]
    upper_box = map_box(REFERENCE_LAYERS["upper_trough"], connector.size)
    lower_box = map_box(REFERENCE_LAYERS["lower_reservoir"], connector.size)
    upper_height = upper_box[3] - upper_box[1]
    lower_height = lower_box[3] - lower_box[1]

    if tube_height > 4:
        raise RuntimeError("V10 rendered more than one thin center tube")
    if lower_height <= upper_height:
        raise RuntimeError("V10 rendered reservoir depths became symmetrical")
    if not (
        upper_box[3] <= tube_box[1]
        and tube_box[1] < tube_box[3]
        and tube_box[3] <= lower_box[1]
    ):
        raise RuntimeError("V10 rendered tube is not centered between the troughs")


def verify_v10_layer_contract(connector: Image.Image, master: Image.Image) -> None:
    measurements = measure_reference_layers()
    upper = measurements["upper_trough"]
    pipe = measurements["center_pipe"]
    lower = measurements["lower_reservoir"]
    if not upper["center_y"] < pipe["center_y"] < lower["center_y"]:
        raise RuntimeError("V10 layer order drifted from the approved connector")
    if pipe["height"] >= lower["height"] / 2:
        raise RuntimeError("V10 center pipe is no longer thin")
    if lower["height"] <= upper["height"]:
        raise RuntimeError("V10 lower reservoir lost its approved depth")
    collar_widths = {
        measurements[name]["width"]
        for name in ("left_chrome_collar", "middle_clamp", "right_clamp")
    }
    if len(collar_widths) != 3:
        raise RuntimeError("V10 collars lost their distinct measured widths")
    if connector.getbbox() is None:
        raise RuntimeError("V10 connector rendered empty")
    verify_rendered_connector_profile(connector)
    if master.size != (1518, 900):
        raise RuntimeError(f"Unexpected V10 master size: {master.size}")


def build() -> tuple[Image.Image, Image.Image, Image.Image]:
    reference = extract_reference()
    connector = render_connector(reference)
    master = Image.open(V06_MASTER).convert("RGBA").crop(MASTER_CROP)
    master.alpha_composite(connector, TARGET_BOX[:2])
    verify_v10_layer_contract(connector, master)
    return reference, connector, master


def main() -> None:
    reference, connector, master = build()
    V10_ARTWORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    reference.save(
        V10_ARTWORK / "grow-v04-approved-connector-reference.png",
        format="PNG",
        optimize=True,
    )
    connector.save(
        V10_ARTWORK / "grow-v10-traced-connector.png",
        format="PNG",
        optimize=True,
    )
    master.save(
        V10_ARTWORK / "grow-v10-desktop-master.png",
        format="PNG",
        optimize=True,
    )
    output_height = round(master.height * OUTPUT_WIDTH / master.width)
    master.resize((OUTPUT_WIDTH, output_height), Image.Resampling.LANCZOS).save(
        OUTPUT / f"grow-v10-desktop-{OUTPUT_WIDTH}.webp",
        format="WEBP",
        quality=96,
        method=6,
    )


if __name__ == "__main__":
    main()
