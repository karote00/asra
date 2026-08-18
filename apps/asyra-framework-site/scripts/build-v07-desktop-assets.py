from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from PIL import (
    Image,
    ImageChops,
    ImageDraw,
    ImageEnhance,
    ImageFilter,
    ImageFont,
    ImageOps,
)


SITE_ROOT = Path(__file__).resolve().parents[1]
V06_ARTWORK = SITE_ROOT / "artwork" / "v06"
V07_ARTWORK = SITE_ROOT / "artwork" / "v07-desktop"
OUTPUT = SITE_ROOT / "public" / "illustrations"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf")

PAPER = (241, 234, 227)
DARK = (16, 20, 18)
INK = (18, 20, 18)
BLUE = (17, 105, 222)
RED = (203, 35, 24)
AMBER = (232, 144, 28)
DOMAIN_LABEL_Y = 362
DOMAIN_LABEL_FONT_SIZE = 36

V07_DESKTOP_WIDTHS = {
    "hero-core-v07-desktop": 1400,
    "domain-rail-v07-desktop": 4800,
    "grow-v07-desktop": 1500,
    "one-source-v07-desktop": 1536,
    "visible-change-v07-desktop": 1900,
    "closing-grid-v07-desktop": 2400,
}


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if FONT_PATH.exists():
        return ImageFont.truetype(FONT_PATH, size=size)
    return ImageFont.load_default(size=size)


def centered_label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    size: int,
    fill: tuple[int, int, int] = INK,
    max_width: int | None = None,
) -> None:
    resolved_size = size
    resolved_font = font(resolved_size)
    if max_width is not None:
        while resolved_size > 12:
            bounds = draw.textbbox((0, 0), text, font=resolved_font)
            if bounds[2] - bounds[0] <= max_width:
                break
            resolved_size -= 1
            resolved_font = font(resolved_size)
    draw.text(xy, text, fill=fill, font=resolved_font, anchor="mm")


def draw_measurement_grid(
    image: Image.Image,
    step: int,
    line: tuple[int, int, int, int],
    node: tuple[int, int, int, int],
) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = image.size
    for x in range(step // 2, width, step):
        draw.line((x, 0, x, height), fill=line, width=1)
    for y in range(step // 2, height, step):
        draw.line((0, y, width, y), fill=line, width=1)
    for x in range(step // 2, width, step * 2):
        for y in range(step // 2, height, step * 2):
            draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=node)
            draw.line((x - 12, y, x + 12, y), fill=node, width=1)
            draw.line((x, y - 12, x, y + 12), fill=node, width=1)
    image.alpha_composite(overlay)


def domain_card() -> Image.Image:
    source = Image.open(V06_ARTWORK / "domain-card-master.png").convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError("V06 domain card has no opaque content")
    return source.crop(bounds).resize((380, 543), Image.Resampling.LANCZOS)


def fastener_source() -> Image.Image:
    card = domain_card()
    return card.crop((26, 9, 92, 75))


def compose_raised_blue_fastener(
    image: Image.Image, xy: tuple[int, int], diameter: int
) -> None:
    source = fastener_source().resize(
        (diameter, diameter), Image.Resampling.LANCZOS
    )
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).ellipse((1, 1, diameter - 2, diameter - 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(0.6, diameter / 42)))
    x = round(xy[0] - diameter / 2)
    y = round(xy[1] - diameter / 2)
    image.paste(source, (x, y), mask)


def draw_eight_direction_face(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
    color: tuple[int, int, int],
    width: int = 2,
) -> None:
    left, top, right, bottom = bounds
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    half_width = (right - left) / 2
    half_height = (bottom - top) / 2
    for degrees in range(0, 360, 45):
        angle = math.radians(degrees)
        dx = math.cos(angle)
        dy = math.sin(angle)
        horizontal = half_width / max(abs(dx), 0.0001)
        vertical = half_height / max(abs(dy), 0.0001)
        length = min(horizontal, vertical)
        start = 17
        draw.line(
            (
                cx + dx * start,
                cy + dy * start,
                cx + dx * (length - 2),
                cy + dy * (length - 2),
            ),
            fill=color,
            width=width,
        )


def draw_round_center(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    radius: int,
    color: tuple[int, int, int],
) -> None:
    cx, cy = xy
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        fill=PAPER,
        outline=color,
        width=3,
    )
    draw.ellipse(
        (cx - radius // 3, cy - radius // 3, cx + radius // 3, cy + radius // 3),
        fill=(198, 194, 187),
        outline=color,
        width=2,
    )


def redraw_module_face(
    image: Image.Image,
    bounds: tuple[int, int, int, int],
    line_color: tuple[int, int, int] = (132, 130, 125),
) -> None:
    left, top, right, bottom = bounds
    face = (left + 27, top + 23, right - 27, bottom - 38)
    region = image.crop(face).filter(ImageFilter.GaussianBlur(5))
    region = ImageEnhance.Brightness(region).enhance(1.015)
    image.paste(region, face[:2])
    draw = ImageDraw.Draw(image)
    draw_eight_direction_face(draw, face, line_color, 2)
    draw_round_center(
        draw,
        ((face[0] + face[2]) // 2, (face[1] + face[3]) // 2),
        17,
        line_color,
    )


def draw_design(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    top = (cx, cy - size)
    left = (cx - size, cy + size)
    right = (cx + size, cy + size)
    draw.line((top, left, right, top), fill=INK, width=5, joint="curve")
    draw.line((cx, cy - size, cx, cy + size), fill=INK, width=3)
    for x, y in (top, left, right):
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=PAPER, outline=INK, width=4)


def draw_camera(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.rounded_rectangle(
        (cx - size, cy - 40, cx + size, cy + 48),
        radius=8,
        outline=INK,
        width=5,
    )
    draw.polygon(
        (
            (cx - 43, cy - 40),
            (cx - 28, cy - 61),
            (cx + 20, cy - 61),
            (cx + 35, cy - 40),
        ),
        outline=INK,
    )
    draw.line(
        (cx - 43, cy - 40, cx - 28, cy - 61, cx + 20, cy - 61, cx + 35, cy - 40),
        fill=INK,
        width=5,
        joint="curve",
    )
    draw.ellipse((cx - 35, cy - 35, cx + 35, cy + 35), outline=INK, width=5)
    draw.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=INK)


def draw_research(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.ellipse((cx - size, cy - size, cx + size, cy + size), outline=INK, width=5)
    draw.line((cx + 39, cy + 39, cx + 92, cy + 92), fill=INK, width=7)
    draw.line((cx - 71, cy + 57, cx - 88, cy + 72), fill=INK, width=3)
    draw.ellipse((cx - 101, cy + 78, cx - 95, cy + 84), fill=INK)


def draw_cube(
    draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, width: int = 4
) -> None:
    top = (cx, cy - size)
    left = (cx - size, cy - size // 2)
    right = (cx + size, cy - size // 2)
    middle = (cx, cy)
    bottom = (cx, cy + size)
    draw.line((top, left, middle, right, top), fill=INK, width=width, joint="curve")
    draw.line(
        (left, (left[0], cy + size // 2), bottom, (right[0], cy + size // 2), right),
        fill=INK,
        width=width,
        joint="curve",
    )
    draw.line((middle, bottom), fill=INK, width=width)


def draw_bim(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw_cube(draw, cx, cy, size, 4)
    draw_cube(draw, cx, cy + 4, size * 2 // 3, 3)
    for offset in (-size // 2, size // 2):
        draw.line((cx + offset, cy - size * 3 // 4, cx + offset, cy + size * 3 // 4), fill=INK, width=2)


def draw_book(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.line(
        ((cx, cy + size), (cx - size, cy + size * 2 // 3), (cx - size, cy - size), (cx, cy - size * 2 // 3)),
        fill=INK,
        width=5,
        joint="curve",
    )
    draw.line(
        ((cx, cy + size), (cx + size, cy + size * 2 // 3), (cx + size, cy - size), (cx, cy - size * 2 // 3)),
        fill=INK,
        width=5,
        joint="curve",
    )
    draw.line((cx, cy - size * 2 // 3, cx, cy + size), fill=INK, width=3)


def draw_gear(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points: list[tuple[float, float]] = []
    for index in range(32):
        angle = -math.pi / 2 + index * math.pi / 16
        radius = size if index % 4 in (0, 1) else size * 0.76
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.line(points + [points[0]], fill=INK, width=5, joint="curve")
    draw.ellipse((cx - 31, cy - 31, cx + 31, cy + 31), outline=INK, width=5)


def draw_media(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    outer = ((cx - 48, cy - size), (cx - 48, cy + size), (cx + 65, cy))
    inner = ((cx - 32, cy - 47), (cx - 32, cy + 47), (cx + 43, cy))
    draw.line(outer + (outer[0],), fill=INK, width=5, joint="curve")
    draw.line(inner + (inner[0],), fill=INK, width=3, joint="curve")


def draw_operations(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    nodes = (
        (cx - size, cy - 24),
        (cx - 17, cy - 24),
        (cx + 24, cy - 62),
        (cx + 24, cy + 28),
        (cx + size, cy + 64),
    )
    draw.line((nodes[0], nodes[1], nodes[2]), fill=INK, width=4)
    draw.line((nodes[1], nodes[3], nodes[4]), fill=INK, width=4)
    for x, y in nodes:
        draw.rectangle((x - 11, y - 11, x + 11, y + 11), fill=PAPER, outline=INK, width=4)


def draw_simulation(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points = (
        (cx - size, cy),
        (cx - 56, cy),
        (cx - 38, cy - 41),
        (cx - 15, cy + 63),
        (cx + 17, cy - 67),
        (cx + 42, cy + 33),
        (cx + 60, cy),
        (cx + size, cy),
    )
    draw.line(points, fill=INK, width=5, joint="curve")


def draw_field(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    gap = 19
    draw.line((cx - size, cy, cx - gap, cy), fill=INK, width=5)
    draw.line((cx + gap, cy, cx + size, cy), fill=INK, width=5)
    draw.line((cx, cy - size, cx, cy - gap), fill=INK, width=5)
    draw.line((cx, cy + gap, cx, cy + size), fill=INK, width=5)
    draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=INK)


DOMAIN_ICON_DRAWERS: list[
    tuple[str, Callable[[ImageDraw.ImageDraw, int, int, int], None]]
] = [
    ("DESIGN", draw_design),
    ("PHOTOGRAPHY", draw_camera),
    ("RESEARCH", draw_research),
    ("BIM", draw_bim),
    ("EDUCATION", draw_book),
    ("MANUFACTURING", draw_gear),
    ("MEDIA", draw_media),
    ("OPERATIONS", draw_operations),
    ("SIMULATION", draw_simulation),
    ("YOUR FIELD", draw_field),
]


def build_hero() -> Image.Image:
    source = Image.open(V06_ARTWORK / "hero-core-master.png").convert("RGBA")
    for xy in ((474, 335), (779, 335), (474, 656), (779, 656)):
        compose_raised_blue_fastener(source, xy, 54)
    result = Image.new("RGBA", (1400, source.height), (*PAPER, 255))
    result.alpha_composite(source, ((result.width - source.width) // 2, 0))
    return result


def build_domain_rail() -> Image.Image:
    background = Image.open(
        V06_ARTWORK / "domain-rail-background-master.png"
    ).convert("RGB")
    rail_crop = background.crop((0, 300, background.width, 600))
    result = rail_crop.resize((4800, 650), Image.Resampling.LANCZOS).convert("RGBA")
    card = domain_card()
    left = 300
    gap = 45
    top = 80
    for index, (label, icon) in enumerate(DOMAIN_ICON_DRAWERS):
        x = left + index * (card.width + gap)
        shadow = Image.new("RGBA", result.size, (0, 0, 0, 0))
        shadow_mask = card.getchannel("A").filter(ImageFilter.GaussianBlur(16))
        shadow_color = Image.new("RGBA", card.size, (0, 0, 0, 105))
        shadow_color.putalpha(shadow_mask.point(lambda value: round(value * 0.42)))
        shadow.alpha_composite(shadow_color, (x + 12, top + 16))
        result.alpha_composite(shadow)
        rendered_card = card.copy()
        draw = ImageDraw.Draw(rendered_card)
        icon(draw, card.width // 2, 220, 66)
        centered_label(
            draw,
            (card.width // 2, DOMAIN_LABEL_Y),
            label,
            DOMAIN_LABEL_FONT_SIZE,
            max_width=card.width - 46,
        )
        result.alpha_composite(rendered_card, (x, top))
    return result


def compose_grow_reservoir(image: Image.Image) -> None:
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((933, 465, 1155, 560), radius=20, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    image.alpha_composite(shadow)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((931, 454, 1153, 548), radius=17, fill=(68, 24, 21), outline=(42, 24, 21), width=6)
    draw.rounded_rectangle((937, 458, 1147, 535), radius=14, fill=(102, 29, 24), outline=(177, 45, 34), width=5)
    draw.rounded_rectangle((946, 466, 1138, 520), radius=10, fill=(143, 38, 29), outline=(238, 71, 51), width=4)
    draw.line((954, 471, 1130, 471), fill=(255, 122, 92), width=4)
    draw.line((954, 518, 1130, 518), fill=(72, 18, 16), width=5)
    for x in (955, 1129):
        draw.rectangle((x - 8, 451, x + 8, 541), fill=(88, 65, 57), outline=(37, 33, 29), width=3)
        draw.line((x, 454, x, 538), fill=(210, 140, 118), width=2)


def build_grow() -> Image.Image:
    source = Image.open(V06_ARTWORK / "grow-master.png").convert("RGBA")
    result = source.crop((0, 50, source.width, 950))
    compose_grow_reservoir(result)
    boxes = (
        (206, 84, 429, 317),
        (458, 84, 679, 317),
        (709, 84, 931, 317),
        (206, 340, 429, 571),
        (709, 340, 932, 600),
        (206, 600, 429, 835),
        (458, 600, 679, 835),
        (709, 600, 931, 835),
        (1148, 285, 1415, 605),
    )
    for box in boxes:
        line_color = (171, 44, 34) if box == boxes[4] else (132, 130, 125)
        redraw_module_face(result, box, line_color)
        left, top, right, bottom = box
        left_inset = 40 if box == boxes[-1] else 24
        for xy in (
            (left + left_inset, top + 23),
            (right - 24, top + 23),
            (left + left_inset, bottom - 29),
            (right - 24, bottom - 29),
        ):
            compose_raised_blue_fastener(result, xy, 27)
    return result


def enhance_topographic_relief(image: Image.Image) -> None:
    box = (580, 267, 978, 654)
    relief = image.crop(box).convert("RGB")
    relief = ImageEnhance.Contrast(relief).enhance(1.07)
    relief = relief.filter(ImageFilter.UnsharpMask(radius=1.8, percent=125, threshold=3))
    gray = ImageOps.grayscale(relief)
    edges = gray.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(0.7))
    edges = ImageEnhance.Contrast(edges).enhance(1.35)
    edge_mask = edges.point(lambda value: max(0, min(54, value - 22)))
    highlight_mask = ImageChops.offset(edge_mask, -2, -2)
    shadow_mask = ImageChops.offset(edge_mask, 2, 2)
    highlight = Image.new("RGB", relief.size, (255, 253, 247))
    shadow = Image.new("RGB", relief.size, (113, 102, 89))
    relief = Image.composite(shadow, relief, shadow_mask)
    relief = Image.composite(highlight, relief, highlight_mask.point(lambda value: value // 2))
    image.paste(relief, box[:2])


def build_one_source() -> Image.Image:
    result = Image.open(V06_ARTWORK / "one-source-master.png").convert("RGBA")
    enhance_topographic_relief(result)
    draw = ImageDraw.Draw(result)
    white = (242, 239, 232)
    centered_label(draw, (273, 170), "3D VIEW", 20, white, 210)
    centered_label(draw, (1260, 170), "ANALYTICS", 20, white, 210)
    centered_label(draw, (273, 555), "LIST VIEW", 20, white, 210)
    centered_label(draw, (1260, 555), "DETAIL VIEW", 20, white, 210)
    return result.crop((0, 100, result.width, 900))


def tile_template() -> tuple[Image.Image, Image.Image]:
    source = Image.open(V06_ARTWORK / "visible-change-master.png").convert("RGBA")
    template = source.crop((132, 145, 316, 365))
    mask = Image.new("L", template.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((9, 8, 175, 202), radius=22, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2.2))
    return template, mask


def draw_signal_underlay(
    result: Image.Image,
    center: tuple[int, int],
    color: tuple[int, int, int],
) -> None:
    cx, cy = center
    glow = Image.new("RGBA", result.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle((cx - 91, cy - 95, cx + 91, cy + 101), radius=25, fill=(*color, 165))
    glow = glow.filter(ImageFilter.GaussianBlur(22))
    result.alpha_composite(glow)
    draw = ImageDraw.Draw(result)
    draw.rounded_rectangle((cx - 87, cy - 92, cx + 87, cy + 97), radius=23, fill=(*color, 220), outline=(*color, 255), width=7)


def draw_port(draw: ImageDraw.ImageDraw, xy: tuple[int, int]) -> None:
    cx, cy = xy
    draw.ellipse((cx - 23, cy - 23, cx + 23, cy + 23), fill=(74, 70, 63), outline=(23, 24, 22), width=4)
    draw.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=(169, 160, 146), outline=(43, 42, 38), width=3)
    draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(35, 35, 32))


def draw_aligned_legend(
    image: Image.Image,
    rows: tuple[int, int, int],
) -> None:
    draw = ImageDraw.Draw(image)
    labels = (
        ("CHANGED", RED),
        ("AFFECTED", AMBER),
        ("UNCHANGED", (63, 65, 62)),
    )
    label_font = font(29)
    for y, (label, color) in zip(rows, labels):
        draw.line((1545, y, 1630, y), fill=color, width=8)
        draw.text((1660, y), label, font=label_font, fill=INK, anchor="lm")


def build_visible_change() -> Image.Image:
    result = Image.new("RGBA", (1900, 760), (*PAPER, 255))
    draw_measurement_grid(
        result,
        95,
        (79, 79, 74, 24),
        (61, 63, 60, 58),
    )
    template, mask = tile_template()
    column_centers = (224, 401, 564, 735, 901, 1075, 1241, 1410)
    row_centers = (165, 380, 585)
    changed = {(1, 6)}
    affected = {(1, 5), (2, 4), (2, 5), (2, 6)}
    for row, cy in enumerate(row_centers):
        for column, cx in enumerate(column_centers):
            if (row, column) in changed:
                draw_signal_underlay(result, (cx, cy), RED)
            elif (row, column) in affected:
                draw_signal_underlay(result, (cx, cy), AMBER)
            result.paste(template, (cx - 92, cy - 110), mask)
            face = (cx - 57, cy - 56, cx + 57, cy + 51)
            region = result.crop(face).filter(ImageFilter.GaussianBlur(4))
            result.paste(region, face[:2])
            face_draw = ImageDraw.Draw(result)
            draw_eight_direction_face(face_draw, face, (132, 130, 125), 2)
            draw_round_center(face_draw, (cx, cy - 2), 11, (104, 103, 99))
            for xy in (
                (cx - 58, cy - 75),
                (cx + 55, cy - 75),
                (cx - 58, cy + 72),
                (cx + 55, cy + 72),
            ):
                compose_raised_blue_fastener(result, xy, 23)
    draw_port(ImageDraw.Draw(result), (column_centers[5], row_centers[2] - 2))
    draw_aligned_legend(result, row_centers)
    return result


def build_closing_measurement_grid() -> Image.Image:
    result = Image.new("RGBA", (2400, 420), (*DARK, 255))
    texture = Image.new("RGBA", result.size, (0, 0, 0, 0))
    texture_draw = ImageDraw.Draw(texture)
    for y in range(result.height):
        shade = round(5 + 4 * math.sin(y / 19))
        texture_draw.line((0, y, result.width, y), fill=(shade, shade + 2, shade + 1, 30))
    result.alpha_composite(texture)
    draw_measurement_grid(
        result,
        120,
        (198, 202, 196, 32),
        (202, 208, 201, 82),
    )
    return result


def save_master(name: str, image: Image.Image) -> None:
    V07_ARTWORK.mkdir(parents=True, exist_ok=True)
    image.save(V07_ARTWORK / f"{name}-master.png", format="PNG", optimize=True)


def save_webp(name: str, image: Image.Image) -> None:
    width = V07_DESKTOP_WIDTHS[name]
    if width > image.width:
        raise RuntimeError(
            f"{name} requested width {width} exceeds native master width {image.width}"
        )
    height = round(image.height * width / image.width)
    asset = image.resize((width, height), Image.Resampling.LANCZOS)
    asset.save(
        OUTPUT / f"{name}-{width}.webp",
        format="WEBP",
        method=6,
        quality=96,
    )


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    builders = {
        "hero-core-v07-desktop": build_hero,
        "domain-rail-v07-desktop": build_domain_rail,
        "grow-v07-desktop": build_grow,
        "one-source-v07-desktop": build_one_source,
        "visible-change-v07-desktop": build_visible_change,
        "closing-grid-v07-desktop": build_closing_measurement_grid,
    }
    for name, builder in builders.items():
        image = builder()
        save_master(name, image)
        save_webp(name, image)


if __name__ == "__main__":
    main()
