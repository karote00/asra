from __future__ import annotations

import math
from io import BytesIO
from pathlib import Path
from typing import Callable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


SITE_ROOT = Path(__file__).resolve().parents[1]
V05_ARTWORK = SITE_ROOT / "artwork" / "v05"
V06_ARTWORK = SITE_ROOT / "artwork" / "v06"
V08_ARTWORK = SITE_ROOT / "artwork" / "v08-desktop"
REFERENCE_LANDING = SITE_ROOT / "artwork" / "reference" / "asyra-landing-original-design-4x.png"
OUTPUT = SITE_ROOT / "public" / "illustrations"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf")

PAPER = (241, 234, 227)
INK = (18, 20, 18)
RED = (203, 35, 24)
AMBER = (232, 144, 28)
BLUE = (10, 103, 211)
DOMAIN_LABEL_SIZE = 36
DOMAIN_LABEL_Y = 362
DOMAIN_ICON_CENTER_Y = 216
DOMAIN_ICON_MAX_RANGE = 140
DOMAIN_RAIL_REFERENCE_CROP = (0, 2451, 3456, 2919)
DOMAIN_RAIL_CARD_LEFT = 300
DOMAIN_RAIL_CARD_TOP = 80
DOMAIN_RAIL_CARD_WIDTH = 380
DOMAIN_RAIL_CARD_HEIGHT = 543
DOMAIN_RAIL_CARD_PITCH = 425
DOMAIN_RAIL_VISIBLE_BOTTOM = 600
DOMAIN_RAIL_BACKGROUND_BLEND = 12

# Horizontal card-body bounds measured from the approved 4x reference. The
# center of each intervening gap contains only the original mechanical rail.
REFERENCE_DOMAIN_CARD_X_BOUNDS = (
    (226, 514),
    (553, 830),
    (862, 1130),
    (1163, 1429),
    (1467, 1740),
    (1777, 2047),
    (2083, 2347),
    (2380, 2650),
    (2682, 2955),
    (2988, 3256),
)

# Tight source bounds from the approved 4x landing artwork. Only these icon
# strokes are reused; the current card, label, layout, and rail remain intact.
REFERENCE_DOMAIN_ICON_BOUNDS = {
    "DESIGN": (306, 2599, 435, 2737),
    "PHOTOGRAPHY": (625, 2616, 760, 2734),
    "RESEARCH": (941, 2603, 1063, 2739),
    "EDUCATION": (1542, 2616, 1666, 2740),
    "MEDIA": (2166, 2607, 2271, 2737),
    "OPERATIONS": (2448, 2618, 2586, 2736),
}

V08_DESKTOP_WIDTHS = {
    "hero-core-v08-desktop": 1400,
    "domain-rail-v08-desktop": 4800,
    "grow-v08-desktop": 1500,
    "one-source-v08-desktop": 1536,
    "visible-change-v08-desktop": 1900,
}
ONE_SOURCE_LABEL_REGIONS = (
    (145, 45, 401, 108),
    (1132, 45, 1388, 108),
    (145, 430, 401, 493),
    (1132, 430, 1388, 493),
)
ONE_SOURCE_DIAGRAM_REGIONS = (
    (205, 98, 341, 262),
    (1145, 482, 1375, 665),
)
ONE_SOURCE_DIAGRAM_HORIZONTAL_INSETS = (0, 33)
ONE_SOURCE_DIAGRAM_PROTECTED_REGIONS = (
    (),
    ((0, 165, 30, 183), (200, 165, 230, 183)),
)
HERO_CENTERLINE_X = 693
HERO_TOP_CONNECTOR_SOURCE_CENTER_X = 611
HERO_TOP_CONNECTOR_OFFSET_X = (
    HERO_CENTERLINE_X - HERO_TOP_CONNECTOR_SOURCE_CENTER_X
)
HERO_TOP_CONNECTOR_SOURCE_BOX = (551, 25, 670, 155)
HERO_TOP_CONNECTOR_TARGET_BOX = (
    HERO_TOP_CONNECTOR_SOURCE_BOX[0] + HERO_TOP_CONNECTOR_OFFSET_X,
    HERO_TOP_CONNECTOR_SOURCE_BOX[1],
    HERO_TOP_CONNECTOR_SOURCE_BOX[2] + HERO_TOP_CONNECTOR_OFFSET_X,
    HERO_TOP_CONNECTOR_SOURCE_BOX[3],
)
HERO_TOP_CONNECTOR_EDIT_REGIONS = (
    HERO_TOP_CONNECTOR_SOURCE_BOX,
    HERO_TOP_CONNECTOR_TARGET_BOX,
)
VISIBLE_CHANGE_COLUMNS = (224, 401, 564, 735, 901, 1075, 1241, 1410)
VISIBLE_CHANGE_ROWS = (152, 348, 544)
VISIBLE_CHANGE_PORT = (VISIBLE_CHANGE_COLUMNS[5], VISIBLE_CHANGE_ROWS[2])
VISIBLE_CHANGE_SEAM_REGIONS = tuple(
    (cx - 72, cy - 72, cx + 72, cy + 72)
    for cy in VISIBLE_CHANGE_ROWS
    for cx in VISIBLE_CHANGE_COLUMNS
)
VISIBLE_CHANGE_SURFACE_FRAME_REGIONS = tuple(
    (cx - 78, cy - 77, cx + 78, cy + 76)
    for cy in VISIBLE_CHANGE_ROWS
    for cx in VISIBLE_CHANGE_COLUMNS
)
def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if FONT_PATH.exists():
        return ImageFont.truetype(FONT_PATH, size=size)
    return ImageFont.load_default(size=size)


def label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    size: int,
    fill: tuple[int, int, int] = INK,
    max_width: int | None = None,
) -> None:
    resolved = size
    resolved_font = font(resolved)
    while max_width is not None and resolved > 12:
        bounds = draw.textbbox((0, 0), text, font=resolved_font)
        if bounds[2] - bounds[0] <= max_width:
            break
        resolved -= 1
        resolved_font = font(resolved)
    draw.text(xy, text, fill=fill, font=resolved_font, anchor="mm")


def domain_card() -> Image.Image:
    source = Image.open(V06_ARTWORK / "domain-card-master.png").convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError("V06 domain card has no opaque content")
    return source.crop(bounds).resize((380, 543), Image.Resampling.LANCZOS)


def fastener_source() -> Image.Image:
    return domain_card().crop((26, 9, 92, 75))


def compose_reference_fastener(
    image: Image.Image, xy: tuple[int, int], diameter: int
) -> None:
    source = fastener_source().resize((diameter, diameter), Image.Resampling.LANCZOS)
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).ellipse((1, 1, diameter - 2, diameter - 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(0.5, diameter / 48)))
    image.paste(
        source,
        (round(xy[0] - diameter / 2), round(xy[1] - diameter / 2)),
        mask,
    )


def node(draw: ImageDraw.ImageDraw, xy: tuple[int, int], radius: int = 6) -> None:
    x, y = xy
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=PAPER, outline=INK, width=4)


def draw_design(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    left, top, right, bottom = cx - 63, cy - 58, cx + 63, cy + 58
    draw.line((left, top, right, top, right, bottom, left, bottom, left, top), fill=INK, width=4)
    triangle = ((cx, cy - 70), (cx - 55, cy + 56), (cx + 55, cy + 56), (cx, cy - 70))
    draw.line(triangle, fill=INK, width=5, joint="curve")
    draw.line((cx, cy - 70, cx, cy + 56), fill=INK, width=3)
    for point in ((left, top), (right, top), (left, bottom), (right, bottom)):
        node(draw, point, 5)


def draw_camera(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    draw.rounded_rectangle((cx - 70, cy - 40, cx + 70, cy + 48), radius=7, outline=INK, width=5)
    draw.line((cx - 45, cy - 40, cx - 28, cy - 63, cx + 20, cy - 63, cx + 38, cy - 40), fill=INK, width=5, joint="curve")
    draw.ellipse((cx - 39, cy - 38, cx + 39, cy + 40), outline=INK, width=5)
    draw.ellipse((cx - 18, cy - 17, cx + 18, cy + 19), outline=INK, width=4)
    draw.ellipse((cx - 7, cy - 6, cx + 7, cy + 8), fill=INK)


def draw_research(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    lens = (cx - 68, cy - 70, cx + 28, cy + 26)
    draw.ellipse(lens, outline=INK, width=5)
    draw.line((cx + 20, cy + 18, cx + 80, cy + 78), fill=INK, width=8)


def draw_bim(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    left, right = cx - 52, cx + 52
    eave_left, eave_right = cx - 68, cx + 68
    roof_y, wall_top, bottom = cy - 4, cy - 19, cy + 66
    draw.line(
        (eave_left, roof_y, cx, cy - 66, eave_right, roof_y),
        fill=INK,
        width=6,
        joint="curve",
    )
    cap_radius = 3
    for x in (eave_left, eave_right):
        draw.ellipse(
            (x - cap_radius, roof_y - cap_radius, x + cap_radius, roof_y + cap_radius),
            fill=INK,
        )
    draw.line(
        (left, wall_top, left, bottom, right, bottom, right, wall_top),
        fill=INK,
        width=6,
        joint="curve",
    )
    draw.line(
        (cx - 18, bottom, cx - 18, cy + 25, cx + 18, cy + 25, cx + 18, bottom),
        fill=INK,
        width=6,
        joint="curve",
    )


def draw_book(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    left = ((cx, cy - 48), (cx - 18, cy - 59), (cx - 66, cy - 58), (cx - 66, cy + 52), (cx - 20, cy + 48), (cx, cy + 62))
    right = ((cx, cy - 48), (cx + 18, cy - 59), (cx + 66, cy - 58), (cx + 66, cy + 52), (cx + 20, cy + 48), (cx, cy + 62))
    draw.line(left, fill=INK, width=5, joint="curve")
    draw.line(right, fill=INK, width=5, joint="curve")
    draw.line((cx, cy - 48, cx, cy + 62), fill=INK, width=3)
    draw.arc((cx - 65, cy + 34, cx, cy + 70), 10, 170, fill=INK, width=3)
    draw.arc((cx, cy + 34, cx + 65, cy + 70), 10, 170, fill=INK, width=3)


def draw_gear(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points: list[tuple[float, float]] = []
    for index in range(48):
        angle = -math.pi / 2 + index * math.pi / 24
        phase = index % 4
        radius = 70 if phase in (0, 1) else 55
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.line(points + [points[0]], fill=INK, width=5, joint="curve")
    draw.ellipse((cx - 32, cy - 32, cx + 32, cy + 32), outline=INK, width=5)


def draw_media(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    outer = ((cx - 52, cy - 70), (cx - 52, cy + 70), (cx + 72, cy), (cx - 52, cy - 70))
    inner = ((cx - 35, cy - 47), (cx - 35, cy + 47), (cx + 46, cy), (cx - 35, cy - 47))
    draw.line(outer, fill=INK, width=5, joint="curve")
    draw.line(inner, fill=INK, width=4, joint="curve")


def draw_operations(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    center = (cx - 8, cy - 4)
    end_points = ((cx - 76, cy - 4), (cx + 63, cy - 61), (cx + 63, cy + 59))
    draw.line((end_points[0], center, end_points[1]), fill=INK, width=4)
    draw.line((center, end_points[2]), fill=INK, width=4)
    draw.rectangle((center[0] - 14, center[1] - 14, center[0] + 14, center[1] + 14), fill=PAPER, outline=INK, width=4)
    for x, y in end_points:
        draw.rectangle((x - 11, y - 11, x + 11, y + 11), fill=PAPER, outline=INK, width=4)


def draw_simulation(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    points = ((cx - 80, cy), (cx - 60, cy), (cx - 45, cy - 42), (cx - 20, cy + 62), (cx + 15, cy - 68), (cx + 42, cy + 29), (cx + 60, cy), (cx + 82, cy))
    draw.line(points, fill=INK, width=5, joint="curve")


def draw_field(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    gap = 20
    draw.line((cx - 70, cy, cx - gap, cy), fill=INK, width=5)
    draw.line((cx + gap, cy, cx + 70, cy), fill=INK, width=5)
    draw.line((cx, cy - 70, cx, cy - gap), fill=INK, width=5)
    draw.line((cx, cy + gap, cx, cy + 70), fill=INK, width=5)
    draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=INK)


def reference_domain_icon(reference: Image.Image, text: str) -> Image.Image:
    crop = reference.crop(REFERENCE_DOMAIN_ICON_BOUNDS[text]).convert("RGB")
    grayscale = ImageOps.grayscale(crop)
    alpha = grayscale.point(
        lambda value: max(0, min(255, round((175 - value) * 255 / 135)))
    )
    alpha_draw = ImageDraw.Draw(alpha)
    if text == "PHOTOGRAPHY":
        # Remove the loose flourish strokes, viewfinder marks, shutter dot, and
        # lens reflection while preserving the original camera body and lens.
        for box in ((0, 0, 45, 18), (92, 0, 135, 18), (10, 28, 34, 44), (62, 22, 77, 40), (100, 28, 125, 44)):
            alpha_draw.rectangle(box, fill=0)
        alpha_draw.ellipse((48, 46, 87, 87), fill=0)
    elif text == "RESEARCH":
        # Keep only the magnifier silhouette: whitelist the lens and handle,
        # then clear the glass highlight and every detached ray or dot.
        allowed = Image.new("L", alpha.size, 0)
        allowed_draw = ImageDraw.Draw(allowed)
        allowed_draw.ellipse((3, 3, 83, 89), fill=255)
        allowed_draw.line((64, 64, 120, 132), fill=255, width=38)
        alpha = Image.composite(alpha, Image.new("L", alpha.size, 0), allowed)
        ImageDraw.Draw(alpha).ellipse((14, 14, 72, 73), fill=0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError(f"Reference icon {text} has no visible ink")
    alpha = alpha.crop(bounds)
    scale = DOMAIN_ICON_MAX_RANGE / max(alpha.size)
    resized_size = tuple(max(1, round(dimension * scale)) for dimension in alpha.size)
    alpha = alpha.resize(resized_size, Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", resized_size, (*INK, 0))
    icon.putalpha(alpha)
    return icon


def restore_reference_domain_rail(rail: Image.Image, reference: Image.Image) -> None:
    """Restore every visible rail segment from the approved 4x reference."""
    width, height = rail.size
    normalized = reference.crop(DOMAIN_RAIL_REFERENCE_CROP).resize(
        (width, height), Image.Resampling.LANCZOS
    )

    def paste_visible(patch: Image.Image, x: int) -> None:
        mask = Image.new("L", patch.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        full_top = DOMAIN_RAIL_CARD_TOP + DOMAIN_RAIL_BACKGROUND_BLEND
        full_bottom = DOMAIN_RAIL_VISIBLE_BOTTOM - DOMAIN_RAIL_BACKGROUND_BLEND
        mask_draw.rectangle((0, full_top, patch.width, full_bottom), fill=255)
        for offset in range(DOMAIN_RAIL_BACKGROUND_BLEND):
            opacity = round(255 * offset / DOMAIN_RAIL_BACKGROUND_BLEND)
            mask_draw.line(
                (0, DOMAIN_RAIL_CARD_TOP + offset, patch.width, DOMAIN_RAIL_CARD_TOP + offset),
                fill=opacity,
            )
            mask_draw.line(
                (0, DOMAIN_RAIL_VISIBLE_BOTTOM - offset, patch.width, DOMAIN_RAIL_VISIBLE_BOTTOM - offset),
                fill=opacity,
            )
        rail.paste(patch, (x, 0), mask)

    # The left reference segment is wider than the current pre-card space.
    # Clipping its card-side edge retains a uniform 4x-to-4800 scale.
    paste_visible(normalized.crop((0, 0, DOMAIN_RAIL_CARD_LEFT, height)), 0)

    gap_width = DOMAIN_RAIL_CARD_PITCH - DOMAIN_RAIL_CARD_WIDTH
    for index, (current_card, next_card) in enumerate(
        zip(REFERENCE_DOMAIN_CARD_X_BOUNDS, REFERENCE_DOMAIN_CARD_X_BOUNDS[1:])
    ):
        source_left = round(current_card[1] * width / reference.width)
        source_right = round(next_card[0] * width / reference.width)
        gap = normalized.crop((source_left, 0, source_right, height))
        if gap.width > gap_width:
            trim = (gap.width - gap_width) // 2
            gap = gap.crop((trim, 0, trim + gap_width, height))
        elif gap.width < gap_width:
            gap = gap.resize((gap_width, height), Image.Resampling.LANCZOS)
        target_x = DOMAIN_RAIL_CARD_LEFT + DOMAIN_RAIL_CARD_WIDTH + index * DOMAIN_RAIL_CARD_PITCH
        paste_visible(gap, target_x)

    last_card_right = (
        DOMAIN_RAIL_CARD_LEFT
        + (len(REFERENCE_DOMAIN_CARD_X_BOUNDS) - 1) * DOMAIN_RAIL_CARD_PITCH
        + DOMAIN_RAIL_CARD_WIDTH
    )
    target_right_width = width - last_card_right
    reference_right = normalized.crop((4525, 0, width, height))
    insertion_width = target_right_width - reference_right.width
    insertion_x = 125
    right = Image.new("RGB", (target_right_width, height))
    right.paste(reference_right.crop((0, 0, insertion_x, height)), (0, 0))
    right.paste(
        reference_right.crop(
            (insertion_x - insertion_width, 0, insertion_x, height)
        ),
        (insertion_x, 0),
    )
    right.paste(
        reference_right.crop((insertion_x, 0, reference_right.width, height)),
        (insertion_x + insertion_width, 0),
    )
    paste_visible(right, last_card_right)


DOMAIN_ICONS: tuple[tuple[str, Callable[[ImageDraw.ImageDraw, int, int, int], None]], ...] = (
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
)


def draw_reference_domain_icons() -> Image.Image:
    background = Image.open(V06_ARTWORK / "domain-rail-background-master.png").convert("RGB")
    rail = background.crop((0, 300, background.width, 600)).resize((4800, 650), Image.Resampling.LANCZOS).convert("RGBA")
    reference = Image.open(REFERENCE_LANDING).convert("RGB")
    restore_reference_domain_rail(rail, reference)
    card = domain_card()
    for index, (text, icon) in enumerate(DOMAIN_ICONS):
        x = DOMAIN_RAIL_CARD_LEFT + index * DOMAIN_RAIL_CARD_PITCH
        rendered = card.copy()
        draw = ImageDraw.Draw(rendered)
        if text == "RESEARCH":
            icon(draw, card.width // 2, DOMAIN_ICON_CENTER_Y, 68)
        elif text in REFERENCE_DOMAIN_ICON_BOUNDS:
            reference_icon = reference_domain_icon(reference, text)
            rendered.alpha_composite(
                reference_icon,
                (
                    (card.width - reference_icon.width) // 2,
                    DOMAIN_ICON_CENTER_Y - reference_icon.height // 2,
                ),
            )
        else:
            icon(draw, card.width // 2, DOMAIN_ICON_CENTER_Y, 68)
        label(draw, (card.width // 2, DOMAIN_LABEL_Y), text, DOMAIN_LABEL_SIZE, max_width=card.width - 46)
        rail.alpha_composite(rendered, (x, DOMAIN_RAIL_CARD_TOP))
    return rail


def relocate_hero_top_connector(image: Image.Image) -> None:
    left, top, right, bottom = HERO_TOP_CONNECTOR_SOURCE_BOX
    reflected_box = (
        2 * HERO_CENTERLINE_X - right,
        top,
        2 * HERO_CENTERLINE_X - left,
        bottom,
    )
    connector = image.crop(HERO_TOP_CONNECTOR_SOURCE_BOX)
    clean_background = ImageOps.mirror(image.crop(reflected_box))

    detail = ImageChops.difference(connector, clean_background).convert("L")
    detail_mask = detail.point(lambda value: 255 if value >= 16 else 0)
    detail_mask = detail_mask.filter(ImageFilter.MaxFilter(5)).filter(
        ImageFilter.GaussianBlur(1.5)
    )
    shape_mask = Image.new("L", connector.size, 0)
    shape_draw = ImageDraw.Draw(shape_mask)
    shape_draw.ellipse((16, 5, 104, 113), fill=255)
    shape_draw.rounded_rectangle((37, 62, 82, 130), radius=14, fill=255)
    move_mask = ImageChops.multiply(detail_mask, shape_mask)

    image.paste(clean_background, HERO_TOP_CONNECTOR_SOURCE_BOX[:2])
    image.paste(connector, HERO_TOP_CONNECTOR_TARGET_BOX[:2], move_mask)


def compose_hero(relocate_connector: bool) -> Image.Image:
    source = Image.open(V05_ARTWORK / "hero-core-master.png").convert("RGB")
    result = Image.new("RGB", (1400, 1254), (241, 234, 228))
    source = ImageOps.contain(source, result.size, Image.Resampling.LANCZOS)
    result.paste(
        source,
        ((result.width - source.width) // 2, (result.height - source.height) // 2),
    )
    if relocate_connector:
        relocate_hero_top_connector(result)
    return result


def build_hero() -> Image.Image:
    return compose_hero(relocate_connector=True)


def build_hero_legacy_public_base() -> Image.Image:
    return compose_hero(relocate_connector=False)


def feathered_cover(image: Image.Image, box: tuple[int, int, int, int]) -> None:
    left, top, right, bottom = box
    sample = image.crop((left, 55, right, 55 + (bottom - top))).filter(ImageFilter.GaussianBlur(8))
    sample = ImageEnhance.Brightness(sample).enhance(1.01)
    mask = Image.new("L", (right - left, bottom - top), 255)
    mask = mask.filter(ImageFilter.GaussianBlur(14))
    image.paste(sample, (left, top), mask)


def compose_integrated_grow_channel(image: Image.Image) -> None:
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((908, 412, 1170, 555), radius=27, fill=(0, 0, 0, 120))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(17)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((912, 397, 1166, 538), radius=24, fill=(62, 28, 24), outline=(39, 31, 27), width=7)
    draw.rounded_rectangle((919, 403, 1159, 529), radius=20, fill=(111, 29, 23), outline=(221, 55, 39), width=6)
    draw.rounded_rectangle((930, 414, 1148, 518), radius=15, fill=(143, 37, 29), outline=(193, 50, 37), width=3)
    cy = 468
    draw.rounded_rectangle((898, cy - 11, 1180, cy + 11), radius=11, fill=(82, 21, 18), outline=(48, 24, 21), width=4)
    draw.rounded_rectangle((903, cy - 7, 1175, cy + 7), radius=7, fill=(196, 50, 37), outline=(249, 82, 59), width=2)
    draw.line((916, cy - 3, 1163, cy - 3), fill=(255, 142, 107), width=2)
    for x in (939, 1139):
        draw.rectangle((x - 9, 395, x + 9, 535), fill=(75, 62, 55), outline=(33, 31, 27), width=3)
        draw.line((x, 401, x, 529), fill=(199, 137, 116), width=2)


def build_grow() -> Image.Image:
    result = Image.open(V06_ARTWORK / "grow-master.png").convert("RGBA").crop((0, 50, 1518, 950))
    compose_integrated_grow_channel(result)
    return result


def restore_one_source_depth(image: Image.Image) -> None:
    box = (580, 267, 978, 654)
    relief = image.crop(box).convert("RGB")
    relief = ImageEnhance.Contrast(relief).enhance(1.1)
    relief = relief.filter(ImageFilter.UnsharpMask(radius=2.0, percent=145, threshold=3))
    shadow = relief.filter(ImageFilter.EMBOSS)
    shadow = ImageEnhance.Contrast(shadow).enhance(0.38)
    image.paste(Image.blend(relief, shadow, 0.16), box[:2])


def scale_one_source_diagram(
    image: Image.Image,
    box: tuple[int, int, int, int],
    scale: float,
    horizontal_inset: int = 0,
    protected_regions: tuple[tuple[int, int, int, int], ...] = (),
) -> None:
    crop = image.crop(box).convert("RGBA")
    grayscale = ImageOps.grayscale(crop)
    diagram_mask = grayscale.point(lambda value: 255 if value >= 75 else 0)
    clearing_mask = diagram_mask.filter(ImageFilter.MaxFilter(11)).filter(
        ImageFilter.GaussianBlur(1.0)
    )
    clean_background = crop.filter(ImageFilter.MedianFilter(31))
    cleared = Image.composite(clean_background, crop, clearing_mask)

    content_mask = diagram_mask.copy()
    if horizontal_inset:
        mask_draw = ImageDraw.Draw(content_mask)
        mask_draw.rectangle((0, 0, horizontal_inset, crop.height), fill=0)
        mask_draw.rectangle(
            (crop.width - horizontal_inset, 0, crop.width, crop.height), fill=0
        )
    diagram = crop.copy()
    diagram.putalpha(content_mask)
    scaled_size = (
        round(crop.width * scale),
        round(crop.height * scale),
    )
    scaled = diagram.resize(scaled_size, Image.Resampling.LANCZOS)
    offset = (
        (crop.width - scaled.width) // 2,
        (crop.height - scaled.height) // 2,
    )
    cleared.alpha_composite(scaled, offset)
    for protected in protected_regions:
        cleared.paste(crop.crop(protected), protected[:2])
    image.paste(cleared, box[:2])


def compose_one_source(
    label_size: int,
    label_color: tuple[int, int, int],
    top_label_y: int,
    bottom_label_y: int,
    scale_diagrams: bool = False,
) -> Image.Image:
    result = Image.open(V06_ARTWORK / "one-source-master.png").convert("RGBA")
    restore_one_source_depth(result)
    if scale_diagrams:
        for (
            (left, top, right, bottom),
            horizontal_inset,
            protected_regions,
        ) in zip(
            ONE_SOURCE_DIAGRAM_REGIONS,
            ONE_SOURCE_DIAGRAM_HORIZONTAL_INSETS,
            ONE_SOURCE_DIAGRAM_PROTECTED_REGIONS,
        ):
            scale_one_source_diagram(
                result,
                (left, top + 100, right, bottom + 100),
                0.70,
                horizontal_inset,
                protected_regions,
            )
    draw = ImageDraw.Draw(result)
    for xy, text in (
        ((273, top_label_y), "3D VIEW"),
        ((1260, top_label_y), "ANALYTICS"),
        ((273, bottom_label_y), "LIST VIEW"),
        ((1260, bottom_label_y), "DETAIL VIEW"),
    ):
        label(draw, xy, text, label_size, label_color, 210)
    return result.crop((0, 100, result.width, 900))


def build_one_source() -> Image.Image:
    return compose_one_source(28, (255, 255, 255), 184, 569, scale_diagrams=True)


def build_one_source_legacy_public_base() -> Image.Image:
    return compose_one_source(18, (242, 239, 232), 167, 552)


def build_one_source_current_label_base() -> Image.Image:
    return compose_one_source(28, (255, 255, 255), 184, 569)


def draw_eight_directions(draw: ImageDraw.ImageDraw, center: tuple[int, int]) -> None:
    cx, cy = center
    for degrees in range(0, 360, 45):
        angle = math.radians(degrees)
        start = 15
        length = 58
        draw.line((cx + math.cos(angle) * start, cy + math.sin(angle) * start, cx + math.cos(angle) * length, cy + math.sin(angle) * length), fill=(126, 124, 119), width=2)
    draw.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill=(241, 237, 231), outline=(92, 92, 88), width=3)
    draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(119, 116, 109))


def draw_panel_seams(draw: ImageDraw.ImageDraw, center: tuple[int, int]) -> None:
    cx, cy = center
    for degrees in range(0, 360, 45):
        angle = math.radians(degrees)
        perpendicular = angle + math.pi / 2
        start = 12
        length = 64 if degrees % 90 else 58
        start_xy = (
            cx + math.cos(angle) * start,
            cy + math.sin(angle) * start,
        )
        end_xy = (
            cx + math.cos(angle) * length,
            cy + math.sin(angle) * length,
        )
        offset_x = math.cos(perpendicular)
        offset_y = math.sin(perpendicular)
        draw.line(
            (
                start_xy[0] + offset_x,
                start_xy[1] + offset_y,
                end_xy[0] + offset_x,
                end_xy[1] + offset_y,
            ),
            fill=(205, 201, 195),
            width=2,
        )
        draw.line(
            (
                start_xy[0] - offset_x,
                start_xy[1] - offset_y,
                end_xy[0] - offset_x,
                end_xy[1] - offset_y,
            ),
            fill=(245, 242, 237),
            width=1,
        )
        draw.line((*start_xy, *end_xy), fill=(226, 222, 216), width=1)


def remove_added_plate_surface_frame(
    image: Image.Image,
    original: Image.Image,
    center: tuple[int, int],
) -> None:
    """Restore one flat top plate while preserving its screws and 3D sidewalls."""

    cx, cy = center
    template_cx = VISIBLE_CHANGE_COLUMNS[0]
    template_cy = VISIBLE_CHANGE_ROWS[0]
    face_box = (cx - 73, cy - 76, cx + 74, cy + 76)
    sample = original.crop(
        (template_cx - 47, template_cy - 48, template_cx - 11, template_cy - 12)
    )
    surface = Image.new(
        "RGBA",
        (face_box[2] - face_box[0], face_box[3] - face_box[1]),
    )
    variants = (
        sample,
        ImageOps.mirror(sample),
        ImageOps.flip(sample),
        ImageOps.mirror(ImageOps.flip(sample)),
    )
    for top in range(0, surface.height, sample.height):
        for left in range(0, surface.width, sample.width):
            variant = variants[(left // sample.width + top // sample.height) % 4]
            surface.alpha_composite(variant, (left, top))
    surface = surface.filter(ImageFilter.GaussianBlur(0.35))
    face_mask = Image.new("L", surface.size, 0)
    ImageDraw.Draw(face_mask).polygon(
        (
            (15, 0),
            (surface.width - 16, 0),
            (surface.width - 1, 15),
            (surface.width - 1, surface.height - 16),
            (surface.width - 16, surface.height - 1),
            (15, surface.height - 1),
            (0, surface.height - 16),
            (0, 15),
        ),
        fill=255,
    )
    image.paste(
        surface,
        face_box[:2],
        face_mask.filter(ImageFilter.GaussianBlur(0.8)),
    )

    for offset_x, offset_y in ((-58, -61), (56, -61), (-58, 63), (56, 63)):
        screw_x = cx + offset_x
        screw_y = cy + offset_y
        source_x = template_cx + offset_x
        source_y = template_cy + offset_y
        screw_box = (screw_x - 20, screw_y - 20, screw_x + 21, screw_y + 21)
        screw = original.crop(
            (source_x - 20, source_y - 20, source_x + 21, source_y + 21)
        )
        screw_mask = Image.new("L", screw.size, 0)
        ImageDraw.Draw(screw_mask).ellipse(
            (1, 1, screw.width - 2, screw.height - 2),
            fill=255,
        )
        image.paste(
            screw,
            screw_box[:2],
            screw_mask.filter(ImageFilter.GaussianBlur(0.7)),
        )

    center_box = (cx - 15, cy - 15, cx + 16, cy + 16)
    center_patch = original.crop(
        (template_cx - 15, template_cy - 15, template_cx + 16, template_cy + 16)
    )
    center_mask = Image.new("L", center_patch.size, 0)
    ImageDraw.Draw(center_mask).ellipse(
        (1, 1, center_patch.width - 2, center_patch.height - 2),
        fill=255,
    )
    image.paste(
        center_patch,
        center_box[:2],
        center_mask.filter(ImageFilter.GaussianBlur(0.8)),
    )


def glow_under_plate(
    image: Image.Image,
    center: tuple[int, int],
    color: tuple[int, int, int],
) -> None:
    cx, cy = center
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.rounded_rectangle(
        (cx - 92, cy - 111, cx + 92, cy + 111),
        radius=27,
        outline=(*color, 220),
        width=15,
    )
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))


def compose_consistent_visible_change(
    use_panel_seams: bool = True,
) -> Image.Image:
    source = Image.open(V06_ARTWORK / "visible-change-master.png").convert("RGBA")
    result = Image.new("RGBA", (1900, 760), (*PAPER, 255))
    result.alpha_composite(source.crop((0, 90, source.width, 850)), (0, 0))
    ImageDraw.Draw(result).rectangle((1500, 0, 1900, 760), fill=(*PAPER, 255))
    original = result.copy()
    columns = VISIBLE_CHANGE_COLUMNS
    rows = VISIBLE_CHANGE_ROWS
    glow_under_plate(result, (columns[6], rows[1]), RED)
    for position in (
        (columns[5], rows[1]),
        (columns[4], rows[2]),
        (columns[5], rows[2]),
        (columns[6], rows[2]),
    ):
        glow_under_plate(result, position, AMBER)
    for cy in rows:
        for cx in columns:
            remove_added_plate_surface_frame(result, original, (cx, cy))
    draw = ImageDraw.Draw(result)
    for cy in rows:
        for cx in columns:
            if use_panel_seams:
                draw_panel_seams(ImageDraw.Draw(result), (cx, cy))
            else:
                clean = result.crop((cx - 58, cy - 18, cx - 22, cy + 18)).filter(ImageFilter.GaussianBlur(3))
                result.paste(clean, (cx - 18, cy - 18))
                draw_eight_directions(ImageDraw.Draw(result), (cx, cy))
    px, py = VISIBLE_CHANGE_PORT
    draw = ImageDraw.Draw(result)
    draw.ellipse(
        (px - 18, py - 18, px + 18, py + 18),
        fill=(75, 71, 64),
        outline=(28, 28, 25),
        width=4,
    )
    draw.ellipse(
        (px - 12, py - 12, px + 12, py + 12),
        fill=(163, 155, 142),
        outline=(50, 48, 43),
        width=3,
    )
    draw.ellipse((px - 6, py - 6, px + 6, py + 6), fill=(37, 36, 33))
    draw = ImageDraw.Draw(result)
    rows_and_labels = ((152, "CHANGED", RED), (348, "AFFECTED", AMBER), (544, "UNCHANGED", (61, 63, 60)))
    for y, text, color in rows_and_labels:
        draw.line((1545, y, 1630, y), fill=color, width=8)
        draw.text((1660, y), text, font=font(29), fill=INK, anchor="lm")
    return result


def build_visible_change_legacy_public_base() -> Image.Image:
    return compose_consistent_visible_change(use_panel_seams=False)


def visible_change_public_mask(
    baseline: Image.Image, revised: Image.Image
) -> Image.Image:
    difference = ImageChops.difference(
        baseline.convert("RGB"), revised.convert("RGB")
    ).convert("L")
    mask = difference.point(lambda value: 255 if value else 0)
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(
        ImageFilter.GaussianBlur(0.6)
    )
    protected = ImageDraw.Draw(mask)
    px, py = VISIBLE_CHANGE_PORT
    protected.ellipse((px - 22, py - 22, px + 22, py + 22), fill=0)
    return mask


def verify_v08_contract(images: dict[str, Image.Image]) -> None:
    for name, expected_width in V08_DESKTOP_WIDTHS.items():
        if images[name].width < expected_width:
            raise RuntimeError(f"{name} master is narrower than {expected_width}px")
    if images["domain-rail-v08-desktop"].height != 650:
        raise RuntimeError("domain rail geometry drifted")
    if images["visible-change-v08-desktop"].size != (1900, 760):
        raise RuntimeError("visible change source geometry drifted")


def lossy_webp_roundtrip(image: Image.Image, width: int, height: int) -> Image.Image:
    buffer = BytesIO()
    image.resize((width, height), Image.Resampling.LANCZOS).save(
        buffer,
        format="WEBP",
        quality=95,
        method=6,
    )
    buffer.seek(0)
    with Image.open(buffer) as decoded:
        return decoded.convert("RGB")


def save(name: str, image: Image.Image) -> None:
    V08_ARTWORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.save(V08_ARTWORK / f"{name}-master.png", format="PNG", optimize=True)
    width = V08_DESKTOP_WIDTHS[name]
    height = round(image.height * width / image.width)
    output_path = OUTPUT / f"{name}-{width}.webp"
    if name == "hero-core-v08-desktop":
        public_image = lossy_webp_roundtrip(
            build_hero_legacy_public_base(), width, height
        )
        revised = lossy_webp_roundtrip(image, width, height)
        for box in HERO_TOP_CONNECTOR_EDIT_REGIONS:
            public_image.paste(revised.crop(box), box)
        public_image.save(output_path, format="WEBP", lossless=True, method=6)
        return
    if name == "one-source-v08-desktop":
        public_image = lossy_webp_roundtrip(
            build_one_source_legacy_public_base(), width, height
        )
        labels = lossy_webp_roundtrip(
            build_one_source_current_label_base(), width, height
        )
        revised = lossy_webp_roundtrip(image, width, height)
        for box in ONE_SOURCE_LABEL_REGIONS:
            public_image.paste(labels.crop(box), box)
        for box in ONE_SOURCE_DIAGRAM_REGIONS:
            public_image.paste(revised.crop(box), box)
        public_image.save(output_path, format="WEBP", lossless=True, method=6)
        return
    if name == "visible-change-v08-desktop":
        legacy_master = build_visible_change_legacy_public_base()
        public_image = lossy_webp_roundtrip(legacy_master, width, height)
        revised = lossy_webp_roundtrip(image, width, height)
        mask = visible_change_public_mask(legacy_master, image)
        public_image.paste(revised, (0, 0), mask)
        public_image.save(output_path, format="WEBP", lossless=True, method=6)
        return
    image.resize((width, height), Image.Resampling.LANCZOS).save(
        output_path, format="WEBP", quality=95, method=6
    )


def main() -> None:
    images = {
        "hero-core-v08-desktop": build_hero(),
        "domain-rail-v08-desktop": draw_reference_domain_icons(),
        "grow-v08-desktop": build_grow(),
        "one-source-v08-desktop": build_one_source(),
        "visible-change-v08-desktop": compose_consistent_visible_change(),
    }
    verify_v08_contract(images)
    for name, image in images.items():
        save(name, image)


if __name__ == "__main__":
    main()
