from __future__ import annotations

from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter, ImageFont


SITE_ROOT = Path(__file__).resolve().parents[1]
ARTWORK = SITE_ROOT / "artwork" / "v05"
OUTPUT = SITE_ROOT / "public" / "illustrations"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf")
PAPER = (241, 234, 227)
DARK = (16, 20, 18)
INK = (18, 20, 18)

WIDTHS = {
    "hero-core-v05": (960, 1536, 2400),
    "domain-rail-v05": (1600, 3200, 4800),
    "grow-v05": (720, 1280, 1920),
    "same-path-v05": (720, 1280, 1920),
    "one-source-v05": (720, 1280, 1920),
    "visible-change-v05": (720, 1280, 1920),
    "closing-core-v05": (480, 960, 1440),
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


def label_same_path(master: Image.Image) -> Image.Image:
    result = master.copy()
    draw = ImageDraw.Draw(result)
    centered_label(draw, (164, 142), "HUMAN", 34)
    centered_label(draw, (164, 465), "AI", 34)
    centered_label(draw, (910, 136), "BUILT ONCE", 34)
    centered_label(draw, (1566, 300), "SAME ACTION", 32)
    return result


def label_one_source(master: Image.Image) -> Image.Image:
    result = master.copy()
    draw = ImageDraw.Draw(result)
    white = (242, 239, 232)
    centered_label(draw, (260, 158), "3D VIEW", 30, white, 250)
    centered_label(draw, (1404, 158), "ANALYTICS", 30, white, 250)
    centered_label(draw, (260, 586), "LIST VIEW", 30, white, 250)
    centered_label(draw, (1404, 586), "DETAIL VIEW", 30, white, 250)
    return result


def label_visible_change(master: Image.Image) -> Image.Image:
    crop_height = round(master.width / 2.5)
    top = (master.height - crop_height) // 2
    result = master.crop((0, top, master.width, top + crop_height))
    draw = ImageDraw.Draw(result)
    for center_y in (185, 356, 535):
        draw.rectangle(
            (1642, center_y - 28, result.width, center_y + 28), fill=PAPER
        )
    centered_label(draw, (1702, 185), "CHANGED", 22, max_width=130)
    centered_label(draw, (1702, 356), "AFFECTED", 22, max_width=130)
    centered_label(draw, (1702, 535), "UNCHANGED", 22, max_width=130)
    return result


def draw_design(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points = [(cx, cy - size), (cx - size, cy + size), (cx + size, cy + size)]
    draw.line(points + [points[0]], fill=INK, width=12, joint="curve")
    for x, y in points:
        draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=PAPER, outline=INK, width=10)
    draw.line((cx, cy - size, cx, cy + size), fill=INK, width=8)


def draw_camera(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.rounded_rectangle(
        (cx - size, cy - size * 2 // 3, cx + size, cy + size * 2 // 3),
        radius=22,
        outline=INK,
        width=12,
    )
    draw.polygon(
        [(cx - size // 2, cy - size * 2 // 3), (cx - size // 3, cy - size), (cx + size // 4, cy - size), (cx + size // 2, cy - size * 2 // 3)],
        outline=INK,
    )
    draw.ellipse((cx - 55, cy - 55, cx + 55, cy + 55), outline=INK, width=12)
    draw.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=INK)


def draw_research(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.ellipse((cx - size, cy - size, cx + size, cy + size), outline=INK, width=12)
    draw.line((cx + size * 2 // 3, cy + size * 2 // 3, cx + size * 3 // 2, cy + size * 3 // 2), fill=INK, width=18)
    draw.ellipse((cx - 22, cy - size - 34, cx + 22, cy - size + 10), outline=INK, width=7)


def draw_bim(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    top = (cx, cy - size)
    left = (cx - size, cy - size // 3)
    right = (cx + size, cy - size // 3)
    bottom = (cx, cy + size)
    draw.line([top, left, bottom, right, top], fill=INK, width=11, joint="curve")
    draw.line((left[0], left[1], cx, cy + size // 3, right[0], right[1]), fill=INK, width=9)
    draw.line((cx, cy + size // 3, cx, cy - size), fill=INK, width=9)
    draw.rectangle((cx - size // 3, cy - size // 3, cx + size // 3, cy + size // 3), outline=INK, width=7)


def draw_book(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    left = [(cx, cy + size), (cx - size, cy + size * 2 // 3), (cx - size, cy - size), (cx, cy - size * 2 // 3)]
    right = [(cx, cy + size), (cx + size, cy + size * 2 // 3), (cx + size, cy - size), (cx, cy - size * 2 // 3)]
    draw.line(left, fill=INK, width=11, joint="curve")
    draw.line(right, fill=INK, width=11, joint="curve")
    draw.line((cx, cy - size * 2 // 3, cx, cy + size), fill=INK, width=7)


def draw_gear(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    teeth = 12
    outer = []
    import math

    for index in range(teeth * 2):
        angle = -math.pi / 2 + index * math.pi / teeth
        radius = size if index % 2 == 0 else int(size * 0.78)
        outer.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(outer, outline=INK, width=10)
    draw.ellipse((cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2), outline=INK, width=12)


def draw_media(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.polygon(
        [(cx - size * 2 // 3, cy - size), (cx - size * 2 // 3, cy + size), (cx + size, cy)],
        outline=INK,
    )
    draw.line(
        [(cx - size * 2 // 3, cy - size), (cx - size * 2 // 3, cy + size), (cx + size, cy), (cx - size * 2 // 3, cy - size)],
        fill=INK,
        width=13,
        joint="curve",
    )


def draw_operations(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    nodes = [(cx - size, cy - size // 2), (cx, cy - size // 2), (cx, cy + size // 2), (cx + size, cy - size), (cx + size, cy + size)]
    draw.line((nodes[0], nodes[1], nodes[3]), fill=INK, width=10)
    draw.line((nodes[1], nodes[2], nodes[4]), fill=INK, width=10)
    for x, y in nodes:
        draw.rounded_rectangle((x - 22, y - 22, x + 22, y + 22), radius=5, fill=PAPER, outline=INK, width=9)


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
    draw.line(points, fill=INK, width=12, joint="curve")


def draw_field(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    gap = size // 3
    draw.line((cx - size, cy, cx - gap, cy), fill=INK, width=14)
    draw.line((cx + gap, cy, cx + size, cy), fill=INK, width=14)
    draw.line((cx, cy - size, cx, cy - gap), fill=INK, width=14)
    draw.line((cx, cy + gap, cx, cy + size), fill=INK, width=14)
    draw.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), fill=INK)


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


def build_domain_rail(master: Image.Image) -> Image.Image:
    tile = master.crop((180, 230, 844, 1300))
    rail = Image.new("RGB", (tile.width * len(DOMAIN_ICONS), tile.height), DARK)
    for index, (label, icon) in enumerate(DOMAIN_ICONS):
        card = tile.copy()
        draw = ImageDraw.Draw(card)
        icon(draw, tile.width // 2, 405, 105)
        centered_label(draw, (tile.width // 2, 855), label, 43, max_width=470)
        rail.paste(card, (index * tile.width, 0))
    return rail


def build_closing(master: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", (1417, 1000), DARK)
    scaled = master.resize((1000, 1000), Image.Resampling.LANCZOS)
    canvas.paste(scaled, ((canvas.width - scaled.width) // 2, 0))
    return canvas


def load_masters() -> dict[str, Image.Image]:
    return {
        "hero-core-v05": Image.open(ARTWORK / "hero-core-master.png").convert("RGB"),
        "domain-rail-v05": build_domain_rail(
            Image.open(ARTWORK / "domain-card-master.png").convert("RGB")
        ),
        "grow-v05": Image.open(ARTWORK / "grow-master.png").convert("RGB"),
        "same-path-v05": label_same_path(
            Image.open(ARTWORK / "same-path-master.png").convert("RGB")
        ),
        "one-source-v05": label_one_source(
            Image.open(ARTWORK / "one-source-master.png").convert("RGB")
        ),
        "visible-change-v05": label_visible_change(
            Image.open(ARTWORK / "visible-change-master.png").convert("RGB")
        ),
        "closing-core-v05": build_closing(
            Image.open(ARTWORK / "closing-core-master.png").convert("RGB")
        ),
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    masters = load_masters()
    for name, widths in WIDTHS.items():
        master = masters[name]
        for width in widths:
            height = round(master.height * width / master.width)
            asset = master.resize((width, height), Image.Resampling.LANCZOS)
            if name not in {"domain-rail-v05", "closing-core-v05"}:
                asset = feather_light_plate(asset)
            asset.save(
                OUTPUT / f"{name}-{width}.webp",
                format="WEBP",
                lossless=True,
                method=6,
            )


if __name__ == "__main__":
    main()
