from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter, ImageFont


SITE_ROOT = Path(__file__).resolve().parents[1]
ARTWORK = SITE_ROOT / "artwork" / "v06"
OUTPUT = SITE_ROOT / "public" / "illustrations"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf")
PAPER = (241, 234, 227)
DARK = (16, 20, 18)
INK = (18, 20, 18)
DOMAIN_LABEL_Y = 362
DOMAIN_LABEL_FONT_SIZE = 36

WIDTHS = {
    "hero-core-v06": (720, 1080, 1400),
    "domain-rail-v06": (1600, 3200, 4800),
    "grow-v06": (720, 1200, 1500),
    "same-path-v06": (720, 1280, 1774),
    "one-source-v06": (720, 1280, 1536),
    "visible-change-v06": (720, 1280, 1900),
    "closing-core-v06": (480, 960, 1254),
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


def feather_light_plate(asset: Image.Image) -> Image.Image:
    width, height = asset.size
    edge = max(8, round(width * 0.012))
    mask = Image.new("L", asset.size, 0)
    ImageDraw.Draw(mask).rectangle(
        (edge, edge, width - edge - 1, height - edge - 1), fill=255
    )
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, edge / 2)))
    result = asset.convert("RGBA")
    result.putalpha(mask)
    return result


def frame_hero(master: Image.Image) -> Image.Image:
    result = Image.new("RGB", (1400, master.height), PAPER)
    result.paste(master, ((result.width - master.width) // 2, 0))
    return result


def crop_grow(master: Image.Image) -> Image.Image:
    return master.crop((0, 50, master.width, 950))


def label_same_path(master: Image.Image) -> Image.Image:
    result = master.copy()
    draw = ImageDraw.Draw(result)
    centered_label(draw, (240, 125), "HUMAN", 31)
    centered_label(draw, (240, 430), "AI", 31)
    centered_label(draw, (1055, 118), "BUILT ONCE", 31)
    centered_label(draw, (1575, 300), "SAME ACTION", 29)
    return result.crop((0, 65, result.width, 805))


def label_one_source(master: Image.Image) -> Image.Image:
    result = master.copy()
    draw = ImageDraw.Draw(result)
    white = (242, 239, 232)
    centered_label(draw, (273, 165), "3D VIEW", 26, white, 210)
    centered_label(draw, (1260, 165), "ANALYTICS", 26, white, 210)
    centered_label(draw, (273, 555), "LIST VIEW", 26, white, 210)
    centered_label(draw, (1260, 555), "DETAIL VIEW", 26, white, 210)
    return result.crop((0, 100, result.width, 900))


def label_visible_change(master: Image.Image) -> Image.Image:
    crop = master.crop((0, 84, master.width, 844))
    result = Image.new("RGB", (1900, 760), PAPER)
    result.paste(crop, (0, 0))
    amber_source_box = (825, 470, 975, 650)
    amber_source = result.crop(amber_source_box)
    amber_mask = Image.new("L", amber_source.size, 0)
    amber_pixels = amber_source.load()
    mask_pixels = amber_mask.load()
    for y in range(amber_source.height):
        for x in range(amber_source.width):
            red, green, blue = amber_pixels[x, y]
            if (
                red > 135
                and 72 <= green < 190
                and red > green * 1.22
                and red > blue * 1.7
            ):
                mask_pixels[x, y] = 255
    amber_mask = amber_mask.filter(ImageFilter.MaxFilter(3))
    result.paste(amber_source, (1000, 275), amber_mask)
    draw = ImageDraw.Draw(result)
    centered_label(draw, (1785, 161), "CHANGED", 31, max_width=170)
    centered_label(draw, (1785, 382), "AFFECTED", 31, max_width=170)
    centered_label(draw, (1785, 581), "UNCHANGED", 31, max_width=170)
    return result


def draw_design(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    top = (cx, cy - size)
    left = (cx - size, cy + size)
    right = (cx + size, cy + size)
    draw.line([top, left, right, top], fill=INK, width=8, joint="curve")
    draw.line((cx, cy - size, cx, cy + size), fill=INK, width=5)
    for x, y in (top, left, right):
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=PAPER, outline=INK, width=6)


def draw_camera(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.rounded_rectangle(
        (cx - size, cy - size * 2 // 3, cx + size, cy + size * 2 // 3),
        radius=14,
        outline=INK,
        width=8,
    )
    draw.line(
        (cx - size // 2, cy - size * 2 // 3, cx - size // 3, cy - size, cx + size // 4, cy - size, cx + size // 2, cy - size * 2 // 3),
        fill=INK,
        width=6,
    )
    draw.ellipse((cx - 40, cy - 40, cx + 40, cy + 40), outline=INK, width=8)
    draw.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=INK)


def draw_research(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.ellipse((cx - size, cy - size, cx + size, cy + size), outline=INK, width=8)
    draw.line(
        (cx + size * 2 // 3, cy + size * 2 // 3, cx + size * 3 // 2, cy + size * 3 // 2),
        fill=INK,
        width=11,
    )


def draw_cube(
    draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, width: int = 7
) -> None:
    top = (cx, cy - size)
    left = (cx - size, cy - size // 2)
    right = (cx + size, cy - size // 2)
    bottom = (cx, cy + size)
    middle = (cx, cy)
    draw.line([top, left, middle, right, top], fill=INK, width=width, joint="curve")
    draw.line([left, (left[0], cy + size // 2), bottom, (right[0], cy + size // 2), right], fill=INK, width=width, joint="curve")
    draw.line((middle, bottom), fill=INK, width=width)


def draw_bim(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw_cube(draw, cx, cy - 5, size, 7)
    draw_cube(draw, cx, cy + 10, size * 2 // 3, 5)
    draw.line((cx - size, cy - size // 2, cx - size, cy + size // 2), fill=INK, width=6)
    draw.line((cx + size, cy - size // 2, cx + size, cy + size // 2), fill=INK, width=6)


def draw_book(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    left = [
        (cx, cy + size),
        (cx - size, cy + size * 2 // 3),
        (cx - size, cy - size),
        (cx, cy - size * 2 // 3),
    ]
    right = [
        (cx, cy + size),
        (cx + size, cy + size * 2 // 3),
        (cx + size, cy - size),
        (cx, cy - size * 2 // 3),
    ]
    draw.line(left, fill=INK, width=8, joint="curve")
    draw.line(right, fill=INK, width=8, joint="curve")
    draw.line((cx, cy - size * 2 // 3, cx, cy + size), fill=INK, width=5)


def draw_gear(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    teeth = 8
    points = []
    for index in range(teeth * 4):
        angle = -math.pi / 2 + index * math.pi / (teeth * 2)
        radius = size if index % 4 in (0, 1) else int(size * 0.76)
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.line(points + [points[0]], fill=INK, width=7, joint="curve")
    draw.ellipse(
        (cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2),
        outline=INK,
        width=8,
    )


def draw_media(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points = [
        (cx - size * 2 // 3, cy - size),
        (cx - size * 2 // 3, cy + size),
        (cx + size, cy),
        (cx - size * 2 // 3, cy - size),
    ]
    draw.line(points, fill=INK, width=9, joint="curve")


def draw_operations(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    nodes = [
        (cx - size, cy - size // 2),
        (cx, cy - size // 2),
        (cx, cy + size // 2),
        (cx + size, cy - size),
        (cx + size, cy + size),
    ]
    draw.line((nodes[0], nodes[1], nodes[3]), fill=INK, width=7)
    draw.line((nodes[1], nodes[2], nodes[4]), fill=INK, width=7)
    for x, y in nodes:
        draw.rectangle((x - 15, y - 15, x + 15, y + 15), fill=PAPER, outline=INK, width=6)


def draw_simulation(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points = [
        (cx - size, cy),
        (cx - size * 3 // 4, cy),
        (cx - size // 2, cy - size * 2 // 3),
        (cx - size // 4, cy + size),
        (cx + size // 5, cy - size),
        (cx + size // 2, cy + size // 2),
        (cx + size * 3 // 4, cy),
        (cx + size, cy),
    ]
    draw.line(points, fill=INK, width=8, joint="curve")


def draw_field(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    gap = size // 3
    draw.line((cx - size, cy, cx - gap, cy), fill=INK, width=9)
    draw.line((cx + gap, cy, cx + size, cy), fill=INK, width=9)
    draw.line((cx, cy - size, cx, cy - gap), fill=INK, width=9)
    draw.line((cx, cy + gap, cx, cy + size), fill=INK, width=9)
    draw.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=INK)


DOMAIN_ICONS: list[tuple[str, Callable[[ImageDraw.ImageDraw, int, int, int], None]]] = [
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


def build_domain_rail(background: Image.Image, card_master: Image.Image) -> Image.Image:
    rail_crop = background.crop((0, 300, background.width, 600))
    result = rail_crop.resize((4800, 650), Image.Resampling.LANCZOS).convert("RGBA")
    alpha = card_master.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError("The V06 domain card has no opaque content")
    card = card_master.crop(bounds).resize((380, 543), Image.Resampling.LANCZOS)
    card_width, card_height = card.size
    left = 300
    gap = 45
    top = 80
    for index, (label, icon) in enumerate(DOMAIN_ICONS):
        x = left + index * (card_width + gap)
        shadow = Image.new("RGBA", result.size, (0, 0, 0, 0))
        shadow_mask = card.getchannel("A").filter(ImageFilter.GaussianBlur(16))
        shadow_color = Image.new("RGBA", card.size, (0, 0, 0, 105))
        shadow_color.putalpha(shadow_mask.point(lambda value: round(value * 0.42)))
        shadow.alpha_composite(shadow_color, (x + 12, top + 16))
        result.alpha_composite(shadow)

        rendered_card = card.copy()
        draw = ImageDraw.Draw(rendered_card)
        icon(draw, card_width // 2, 225, 74)
        centered_label(
            draw,
            (card_width // 2, DOMAIN_LABEL_Y),
            label,
            DOMAIN_LABEL_FONT_SIZE,
            max_width=card_width - 46,
        )
        result.alpha_composite(rendered_card, (x, top))
    master_path = ARTWORK / "domain-rail-master.png"
    result.convert("RGB").save(master_path, format="PNG", optimize=True)
    return result.convert("RGB")


def load_masters() -> dict[str, Image.Image]:
    return {
        "hero-core-v06": frame_hero(
            Image.open(ARTWORK / "hero-core-master.png").convert("RGB")
        ),
        "domain-rail-v06": build_domain_rail(
            Image.open(ARTWORK / "domain-rail-background-master.png").convert("RGB"),
            Image.open(ARTWORK / "domain-card-master.png").convert("RGBA"),
        ),
        "grow-v06": crop_grow(
            Image.open(ARTWORK / "grow-master.png").convert("RGB")
        ),
        "same-path-v06": label_same_path(
            Image.open(ARTWORK / "same-path-master.png").convert("RGB")
        ),
        "one-source-v06": label_one_source(
            Image.open(ARTWORK / "one-source-master.png").convert("RGB")
        ),
        "visible-change-v06": label_visible_change(
            Image.open(ARTWORK / "visible-change-master.png").convert("RGB")
        ),
        "closing-core-v06": Image.open(ARTWORK / "closing-core-master.png").convert("RGBA"),
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    expected_paths = {
        OUTPUT / f"{name}-{width}.webp"
        for name, widths in WIDTHS.items()
        for width in widths
    }
    for stale_path in OUTPUT.glob("*-v06-*.webp"):
        if stale_path not in expected_paths:
            stale_path.unlink()
    masters = load_masters()
    for name, widths in WIDTHS.items():
        master = masters[name]
        for width in widths:
            if width > master.width:
                raise RuntimeError(
                    f"{name} requested width {width} exceeds native master width {master.width}"
                )
            height = round(master.height * width / master.width)
            asset = master.resize((width, height), Image.Resampling.LANCZOS)
            if name not in {"domain-rail-v06", "closing-core-v06"}:
                asset = feather_light_plate(asset)
            asset.save(
                OUTPUT / f"{name}-{width}.webp",
                format="WEBP",
                method=6,
                quality=96,
            )


if __name__ == "__main__":
    main()
