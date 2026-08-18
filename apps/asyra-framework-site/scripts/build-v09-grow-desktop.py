from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps, ImageStat


SITE_ROOT = Path(__file__).resolve().parents[1]
V04_REFERENCE = SITE_ROOT / "public" / "illustrations" / "grow-v04-1920.webp"
V06_MASTER = SITE_ROOT / "artwork" / "v06" / "grow-master.png"
V09_ARTWORK = SITE_ROOT / "artwork" / "v09-desktop"
OUTPUT = SITE_ROOT / "public" / "illustrations"

# Measured directly on the approved 1920px V04 Grow image. The crop contains
# the original selected-module collar, translucent trough, upper/lower rails,
# thin center pipe, intermediate collars, and the detached-module collar.
REFERENCE_BOX = (1100, 450, 1470, 725)

# V06 anchor fit for the same two module edges after its 50px top crop. This is
# a uniform placement of the approved crop, not a newly designed connector.
TARGET_BOX = (895, 340, 1180, 546)
MASTER_CROP = (0, 50, 1518, 950)
OUTPUT_WIDTH = 1500

# Every coordinate below is recorded in the 370 x 275 V04 reference crop. The
# traced masks follow those pixel boundaries and are mapped as one unit.
REFERENCE_TRACE = {
    "top_rail": (47, 50, 345, 90),
    "trough": (44, 82, 348, 211),
    "thin_pipe": (31, 108, 354, 130),
    "bottom_beam": (42, 191, 350, 222),
    "left_collar": (21, 34, 71, 236),
    "middle_collar": (252, 72, 289, 218),
    "right_collar": (327, 33, 366, 236),
}
TRACE_SCALE = 4


def extract_approved_connector() -> Image.Image:
    reference = Image.open(V04_REFERENCE).convert("RGB")
    return reference.crop(REFERENCE_BOX)


def restore_reference_pixels(connector: Image.Image) -> Image.Image:
    restored = connector.resize(
        (connector.width * 3, connector.height * 3),
        Image.Resampling.LANCZOS,
    )
    restored = ImageEnhance.Contrast(restored).enhance(1.075)
    restored = ImageEnhance.Color(restored).enhance(1.035)
    restored = restored.filter(
        ImageFilter.UnsharpMask(radius=2.4, percent=260, threshold=2)
    )
    return ImageEnhance.Sharpness(restored).enhance(1.35)


def edge_mean(image: Image.Image, inset: int = 12) -> tuple[float, float, float]:
    width, height = image.size
    strips = (
        image.crop((0, 0, width, inset)),
        image.crop((0, height - inset, width, height)),
        image.crop((0, inset, inset, height - inset)),
        image.crop((width - inset, inset, width, height - inset)),
    )
    joined = Image.new("RGB", (sum(strip.width for strip in strips), inset))
    x = 0
    for strip in strips:
        normalized = ImageOps.fit(strip, (strip.width, inset))
        joined.paste(normalized, (x, 0))
        x += strip.width
    return tuple(ImageStat.Stat(joined).mean)


def match_paper_tone(
    connector: Image.Image, target_region: Image.Image
) -> Image.Image:
    source_mean = edge_mean(connector)
    target_mean = edge_mean(target_region)
    channels = []
    for channel, source, target in zip(connector.split(), source_mean, target_mean):
        delta = max(-12, min(12, round(target - source)))
        channels.append(channel.point(lambda value, offset=delta: max(0, min(255, value + offset))))
    return Image.merge("RGB", channels)


def feather_mask(size: tuple[int, int], feather: int = 42) -> Image.Image:
    width, height = size
    pixels: list[int] = []
    for y in range(height):
        for x in range(width):
            distance = min(x, y, width - 1 - x, height - 1 - y)
            pixels.append(min(255, round(255 * distance / feather)))
    mask = Image.new("L", size)
    mask.putdata(pixels)
    return mask.filter(ImageFilter.GaussianBlur(1.2))


def sample_reference_color(
    image: Image.Image, point: tuple[int, int], radius: int = 3
) -> tuple[int, int, int, int]:
    x, y = point
    sample = image.crop((x - radius, y - radius, x + radius + 1, y + radius + 1))
    red, green, blue = ImageStat.Stat(sample.convert("RGB")).median
    return round(red), round(green), round(blue), 255


def trace_box(
    box: tuple[int, int, int, int], size: tuple[int, int]
) -> tuple[int, int, int, int]:
    width, height = size
    source_width = REFERENCE_BOX[2] - REFERENCE_BOX[0]
    source_height = REFERENCE_BOX[3] - REFERENCE_BOX[1]
    left, top, right, bottom = box
    return (
        round(left * width / source_width),
        round(top * height / source_height),
        round(right * width / source_width),
        round(bottom * height / source_height),
    )


def render_traced_connector(
    reference: Image.Image, restored: Image.Image, target_size: tuple[int, int]
) -> Image.Image:
    high_size = (target_size[0] * TRACE_SCALE, target_size[1] * TRACE_SCALE)
    traced_connector = Image.new("RGBA", high_size, (0, 0, 0, 0))
    source_width = REFERENCE_BOX[2] - REFERENCE_BOX[0]
    source_height = REFERENCE_BOX[3] - REFERENCE_BOX[1]

    def point(x: int, y: int) -> tuple[int, int]:
        return (
            round(x * high_size[0] / source_width),
            round(y * high_size[1] / source_height),
        )

    def gradient_shape(
        name: str,
        sample_x: int,
        sample_ys: tuple[int, int, int],
        radius: int,
    ) -> None:
        box = trace_box(REFERENCE_TRACE[name], high_size)
        left, top, right, bottom = box
        colors = [
            sample_reference_color(reference, (sample_x, sample_y))
            for sample_y in sample_ys
        ]
        layer = Image.new("RGBA", high_size, (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer)
        midpoint = (top + bottom) / 2
        for y in range(top, bottom + 1):
            if y <= midpoint:
                amount = (y - top) / max(1, midpoint - top)
                start, end = colors[0], colors[1]
            else:
                amount = (y - midpoint) / max(1, bottom - midpoint)
                start, end = colors[1], colors[2]
            color = tuple(
                round(start[channel] + (end[channel] - start[channel]) * amount)
                for channel in range(4)
            )
            layer_draw.line((left, y, right, y), fill=color, width=1)
        shape_mask = Image.new("L", high_size, 0)
        ImageDraw.Draw(shape_mask).rounded_rectangle(
            box,
            radius=radius * TRACE_SCALE,
            fill=255,
        )
        layer.putalpha(shape_mask)
        traced_connector.alpha_composite(layer)

    combined_mask = Image.new("L", high_size, 0)
    combined_draw = ImageDraw.Draw(combined_mask)
    for name, box in REFERENCE_TRACE.items():
        radius = 3 if "collar" in name else 5
        combined_draw.rounded_rectangle(
            trace_box(box, high_size),
            radius=radius * TRACE_SCALE,
            fill=255,
        )
    shadow = combined_mask.filter(ImageFilter.GaussianBlur(5 * TRACE_SCALE))
    shadow_layer = Image.new("RGBA", high_size, (23, 17, 15, 0))
    shadow_layer.putalpha(shadow.point(lambda value: round(value * 0.42)))
    traced_connector.alpha_composite(shadow_layer, (0, 3 * TRACE_SCALE))

    gradient_shape("bottom_beam", 190, (193, 205, 218), 4)
    gradient_shape("trough", 190, (86, 150, 201), 5)
    gradient_shape("top_rail", 190, (53, 67, 86), 5)
    gradient_shape("thin_pipe", 190, (109, 117, 128), 3)
    gradient_shape("left_collar", 49, (47, 142, 220), 3)
    gradient_shape("middle_collar", 267, (78, 145, 207), 3)
    gradient_shape("right_collar", 339, (43, 145, 224), 3)

    texture = restored.resize(high_size, Image.Resampling.LANCZOS).convert("RGBA")
    texture.putalpha(combined_mask.point(lambda value: round(value * 0.16)))
    traced_connector.alpha_composite(texture)

    traced_draw = ImageDraw.Draw(traced_connector)

    def horizontal(
        x1: int,
        x2: int,
        y: int,
        sample: tuple[int, int],
        width: int,
    ) -> None:
        traced_draw.line(
            (*point(x1, y), *point(x2, y)),
            fill=sample_reference_color(reference, sample),
            width=width * TRACE_SCALE,
        )

    horizontal(50, 343, 55, (190, 55), 1)
    horizontal(49, 345, 87, (190, 87), 1)
    horizontal(34, 353, 110, (190, 110), 1)
    horizontal(34, 353, 117, (119, 117), 2)
    horizontal(34, 353, 127, (190, 127), 1)
    horizontal(50, 344, 189, (190, 189), 1)
    horizontal(45, 348, 204, (190, 204), 1)

    for x, sample_x in ((49, 49), (266, 266), (338, 338)):
        traced_draw.line(
            (*point(x, 50), *point(x, 218)),
            fill=sample_reference_color(reference, (sample_x, 146)),
            width=TRACE_SCALE,
        )

    return traced_connector.resize(target_size, Image.Resampling.LANCZOS)


def fit_connector_to_v06_anchors(
    connector: Image.Image, target_region: Image.Image
) -> tuple[Image.Image, Image.Image]:
    width = TARGET_BOX[2] - TARGET_BOX[0]
    height = TARGET_BOX[3] - TARGET_BOX[1]
    fitted = connector.resize((width, height), Image.Resampling.LANCZOS)
    fitted = match_paper_tone(fitted, target_region)
    return fitted, feather_mask(fitted.size)


def edge_signature(image: Image.Image) -> list[float]:
    edges = image.convert("L").filter(ImageFilter.FIND_EDGES)
    width, height = edges.size
    values = list(edges.getdata())
    return [
        sum(values[row * width : (row + 1) * width]) / width
        for row in range(height)
    ]


def correlation(left: list[float], right: list[float]) -> float:
    left_mean = sum(left) / len(left)
    right_mean = sum(right) / len(right)
    numerator = sum(
        (left_value - left_mean) * (right_value - right_mean)
        for left_value, right_value in zip(left, right)
    )
    left_scale = sum((value - left_mean) ** 2 for value in left) ** 0.5
    right_scale = sum((value - right_mean) ** 2 for value in right) ** 0.5
    return numerator / (left_scale * right_scale)


def verify_v09_against_reference(
    reference: Image.Image, fitted: Image.Image, master: Image.Image
) -> None:
    if master.size != (1518, 900):
        raise RuntimeError(f"Unexpected V09 master size: {master.size}")
    normalized_reference = reference.resize(fitted.size, Image.Resampling.LANCZOS)
    similarity = correlation(
        edge_signature(normalized_reference), edge_signature(fitted)
    )
    if similarity < 0.965:
        raise RuntimeError(
            f"V09 connector no longer follows the approved edge signature: {similarity:.5f}"
        )


def build() -> tuple[Image.Image, Image.Image, Image.Image, Image.Image]:
    reference = extract_approved_connector()
    restored = restore_reference_pixels(reference)
    base = Image.open(V06_MASTER).convert("RGB").crop(MASTER_CROP)
    target_region = base.crop(TARGET_BOX)
    fitted, background_mask = fit_connector_to_v06_anchors(
        restored, target_region
    )
    traced = render_traced_connector(reference, restored, fitted.size)
    base = base.convert("RGBA")
    base.alpha_composite(traced, TARGET_BOX[:2])
    verify_v09_against_reference(restored, fitted, base)
    return reference, fitted, traced, base


def main() -> None:
    reference, fitted, traced, master = build()
    V09_ARTWORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    reference.save(
        V09_ARTWORK / "grow-v04-approved-connector-reference.png",
        format="PNG",
        optimize=True,
    )
    reference.resize(
        (reference.width * 4, reference.height * 4),
        Image.Resampling.NEAREST,
    ).save(
        V09_ARTWORK / "grow-v04-approved-connector-reference-4x.png",
        format="PNG",
        optimize=True,
    )
    fitted.save(
        V09_ARTWORK / "grow-v09-fitted-connector.png",
        format="PNG",
        optimize=True,
    )
    traced.save(
        V09_ARTWORK / "grow-v09-traced-connector.png",
        format="PNG",
        optimize=True,
    )
    master.save(
        V09_ARTWORK / "grow-v09-desktop-master.png",
        format="PNG",
        optimize=True,
    )
    output_height = round(master.height * OUTPUT_WIDTH / master.width)
    master.resize((OUTPUT_WIDTH, output_height), Image.Resampling.LANCZOS).save(
        OUTPUT / f"grow-v09-desktop-{OUTPUT_WIDTH}.webp",
        format="WEBP",
        quality=96,
        method=6,
    )


if __name__ == "__main__":
    main()
