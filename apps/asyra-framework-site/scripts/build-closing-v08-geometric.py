#!/usr/bin/env python3
"""Build the closing device from explicit continuous geometry.

The source screenshot defines the topology. Every structural line and blue rail
is rendered from one shared path so upscaling cannot bend, split, or invent
segments.
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


WIDTH = 2400
HEIGHT = 1950
BLUE = (15, 134, 255, 255)
BLUE_CORE = (96, 205, 255, 255)
BACKGROUND = (9, 14, 15, 255)


def chamfered_box(bounds: tuple[int, int, int, int], cut: int) -> list[tuple[int, int]]:
    left, top, right, bottom = bounds
    return [
        (left + cut, top),
        (right - cut, top),
        (right, top + cut),
        (right, bottom - cut),
        (right - cut, bottom),
        (left + cut, bottom),
        (left, bottom - cut),
        (left, top + cut),
    ]


def add_texture(image: Image.Image) -> None:
    random.seed(714)
    noise = np.random.default_rng(714).normal(0, 2.1, (HEIGHT, WIDTH, 1))
    pixels = np.asarray(image).astype(np.int16)
    pixels[:, :, :3] = np.clip(pixels[:, :, :3] + noise, 0, 255)
    image.paste(Image.fromarray(pixels.astype(np.uint8)))


def line_with_highlight(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    base: tuple[int, int, int, int],
    width: int,
) -> None:
    draw.line(points, fill=(2, 4, 5, 255), width=width + 16, joint="curve")
    draw.line(points, fill=base, width=width, joint="curve")
    draw.line(
        [(x, y - max(2, width // 7)) for x, y in points],
        fill=(175, 182, 183, 150),
        width=max(3, width // 7),
        joint="curve",
    )


def draw_background(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=BACKGROUND)
    for y in range(0, HEIGHT, 6):
        shade = 8 + round(3 * math.sin(y / 53))
        draw.line((0, y, WIDTH, y), fill=(shade, shade + 4, shade + 4, 45))
    add_texture(image)


def draw_measurement_field(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    guide = (112, 124, 126, 95)
    bright = (229, 235, 233, 210)
    xs = (150, 420, 1200, 1980, 2250)
    ys = (370, 965, 1560)

    for x in xs:
        draw.line((x, 52, x, HEIGHT - 58), fill=guide, width=2)
    for y in ys:
        draw.line((80, y, WIDTH - 80, y), fill=guide, width=2)

    for x in (150, 2250):
        for y in ys:
            draw.line((x - 46, y, x + 46, y), fill=bright, width=5)
            draw.line((x, y - 46, x, y + 46), fill=bright, width=5)
            draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=bright)
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(8, 14, 15, 255))

    for y in ys:
        for x in (420, 1980):
            draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(178, 188, 187, 150))

    draw.line((1200, 24, 1200, 300), fill=bright, width=5)
    draw.line((1170, 72, 1230, 72), fill=bright, width=5)
    draw.ellipse((1186, 58, 1214, 86), fill=(9, 14, 15, 255), outline=bright, width=5)


def draw_frame(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.polygon(
        chamfered_box((405, 185, 1995, 1775), 105), fill=(0, 0, 0, 210)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(36))
    image.alpha_composite(shadow)

    layers = [
        ((410, 140, 1990, 1715), 105, (32, 35, 35, 255), (106, 112, 111, 255), 12),
        ((430, 165, 1970, 1690), 94, (20, 23, 24, 255), (80, 85, 84, 255), 10),
        ((455, 195, 1945, 1655), 82, (42, 44, 43, 255), (128, 131, 127, 255), 8),
        ((500, 245, 1900, 1605), 68, (14, 18, 19, 255), (63, 68, 68, 255), 7),
    ]
    for bounds, cut, fill, outline, width in layers:
        points = chamfered_box(bounds, cut)
        draw.polygon(points, fill=fill)
        draw.line(points + [points[0]], fill=outline, width=width, joint="curve")

    draw.polygon(
        chamfered_box((630, 350, 1770, 1510), 88),
        fill=(7, 10, 11, 255),
        outline=(58, 65, 65, 255),
        width=7,
    )

    # Four corner armour blocks share the frame geometry and never intersect
    # the blue rail.
    corner_blocks = [
        [(470, 210), (720, 210), (800, 300), (685, 420), (500, 400), (455, 340)],
        [(1680, 210), (1930, 210), (1945, 340), (1900, 400), (1715, 420), (1600, 300)],
        [(455, 1510), (500, 1430), (685, 1410), (800, 1530), (720, 1635), (470, 1635)],
        [(1600, 1530), (1715, 1410), (1900, 1430), (1945, 1510), (1930, 1635), (1680, 1635)],
    ]
    for block in corner_blocks:
        draw.polygon(block, fill=(49, 52, 51, 255))
        draw.line(block + [block[0]], fill=(145, 149, 145, 255), width=8, joint="curve")

    # The lower stepped depth is made of parallel uninterrupted layers.
    for index, y in enumerate((1655, 1695, 1735, 1775)):
        inset = index * 18
        draw.line(
            (475 + inset, y, 1925 - inset, y),
            fill=(100 - index * 13, 104 - index * 13, 101 - index * 13, 255),
            width=11,
        )
        draw.line(
            (530 + inset, y + 14, 1870 - inset, y + 14),
            fill=(7, 9, 10, 255),
            width=12,
        )

    # Hardware is point-based and cannot create accidental line fragments.
    screw_points = [
        (530, 275), (1870, 275), (530, 1565), (1870, 1565),
        (580, 500), (1820, 500), (580, 1360), (1820, 1360),
        (770, 265), (1630, 265), (770, 1580), (1630, 1580),
        (485, 690), (1915, 690), (485, 1170), (1915, 1170),
    ]
    for x, y in screw_points:
        draw.ellipse((x - 17, y - 17, x + 17, y + 17), fill=(4, 6, 7, 255), outline=(160, 164, 160, 255), width=5)
        draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(92, 98, 98, 255))


RAIL_PATH = [
    (760, 430),
    (825, 370),
    (1575, 370),
    (1640, 430),
    (1640, 1410),
    (1575, 1470),
    (825, 1470),
    (760, 1410),
    (760, 430),
]


def draw_blue_rail(image: Image.Image) -> None:
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(RAIL_PATH, fill=(0, 112, 255, 165), width=48, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    image.alpha_composite(glow)

    draw = ImageDraw.Draw(image)
    draw.line(RAIL_PATH, fill=(0, 24, 52, 255), width=34, joint="curve")
    draw.line(RAIL_PATH, fill=BLUE, width=24, joint="curve")
    draw.line(RAIL_PATH, fill=BLUE_CORE, width=7, joint="curve")

    # Collars sit on the same centerline; none introduces a branch.
    collars = [
        ((1200, 370), "v"), ((1200, 1470), "v"),
        ((760, 920), "h"), ((1640, 920), "h"),
    ]
    for (x, y), direction in collars:
        if direction == "v":
            bounds = (x - 26, y - 42, x + 26, y + 42)
        else:
            bounds = (x - 42, y - 26, x + 42, y + 26)
        draw.rounded_rectangle(bounds, radius=12, fill=(28, 35, 39, 255), outline=(160, 172, 172, 255), width=6)
        if direction == "v":
            draw.line((x, y - 35, x, y + 35), fill=BLUE_CORE, width=8)
        else:
            draw.line((x - 35, y, x + 35, y), fill=BLUE_CORE, width=8)


def draw_center_module(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    center_x, center_y = 1200, 930

    # Neutral connectors remain continuous behind the raised module.
    line_with_highlight(draw, [(760, center_y), (1000, center_y)], (51, 57, 58, 255), 22)
    line_with_highlight(draw, [(1400, center_y), (1640, center_y)], (51, 57, 58, 255), 22)
    line_with_highlight(draw, [(center_x, 370), (center_x, 665)], (51, 57, 58, 255), 20)
    line_with_highlight(draw, [(center_x, 1195), (center_x, 1470)], (51, 57, 58, 255), 20)

    module_layers = [
        ((965, 645, 1435, 1225), 54, (8, 10, 11, 255), (85, 90, 88, 255), 9),
        ((990, 670, 1410, 1195), 42, (29, 31, 31, 255), (166, 169, 165, 255), 10),
        ((1015, 700, 1385, 1160), 30, (16, 18, 19, 255), (103, 108, 106, 255), 7),
    ]
    for bounds, cut, fill, outline, width in module_layers:
        points = chamfered_box(bounds, cut)
        draw.polygon(points, fill=fill)
        draw.line(points + [points[0]], fill=outline, width=width, joint="curve")

    inner = (1048, 738, 1352, 1122)
    draw.rectangle(inner, fill=(20, 23, 23, 255), outline=(117, 122, 119, 255), width=7)

    spoke_targets = [
        (1058, 748), (1200, 748), (1342, 748),
        (1058, 930), (1342, 930),
        (1058, 1112), (1200, 1112), (1342, 1112),
    ]
    for target in spoke_targets:
        draw.line((center_x, center_y, target[0], target[1]), fill=(89, 96, 96, 255), width=8)
        draw.line((center_x, center_y, target[0], target[1]), fill=(26, 30, 31, 255), width=3)

    draw.ellipse((center_x - 40, center_y - 40, center_x + 40, center_y + 40), fill=(9, 12, 13, 255), outline=(142, 149, 147, 255), width=8)
    draw.ellipse((center_x - 14, center_y - 14, center_x + 14, center_y + 14), fill=(60, 67, 67, 255), outline=(8, 10, 11, 255), width=4)

    for x, y in ((1045, 730), (1355, 730), (1045, 1130), (1355, 1130)):
        draw.ellipse((x - 12, y - 12, x + 12, y + 12), fill=(4, 6, 7, 255), outline=(170, 174, 170, 255), width=5)


def validate_blue_rail(image: Image.Image) -> None:
    pixels = np.asarray(image)
    blue = (
        (pixels[:, :, 2] > 145)
        & (pixels[:, :, 1] > 80)
        & (pixels[:, :, 2] > pixels[:, :, 0] * 1.7)
    )

    def has_blue(x: int, y: int, radius: int = 18) -> bool:
        region = blue[max(0, y - radius): y + radius + 1, max(0, x - radius): x + radius + 1]
        return bool(region.any())

    samples: list[tuple[int, int]] = []
    for x in range(825, 1576, 35):
        samples.extend(((x, 370), (x, 1470)))
    for y in range(430, 1411, 35):
        samples.extend(((760, y), (1640, y)))
    for start, end in zip(RAIL_PATH, RAIL_PATH[1:]):
        for step in range(1, 10):
            ratio = step / 10
            samples.append((round(start[0] + (end[0] - start[0]) * ratio), round(start[1] + (end[1] - start[1]) * ratio)))

    missing = [point for point in samples if not has_blue(*point)]
    if missing:
        raise RuntimeError(f"blue rail continuity failed at {missing[:8]}")

    # Every blue pixel must remain close to the one approved closed rail.
    allowed = Image.new("1", image.size, 0)
    allowed_draw = ImageDraw.Draw(allowed)
    allowed_draw.line(RAIL_PATH, fill=1, width=92, joint="curve")
    allowed_array = np.asarray(allowed, dtype=bool)
    extras = blue & ~allowed_array
    if int(extras.sum()) > 40:
        raise RuntimeError(f"unexpected blue geometry: {int(extras.sum())} pixels")


def build() -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), BACKGROUND)
    draw_background(image)
    draw_measurement_field(image)
    draw_frame(image)
    draw_blue_rail(image)
    draw_center_module(image)
    validate_blue_rail(image)
    return image.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--public-dir", type=Path, required=True)
    args = parser.parse_args()

    master = build()
    args.master.parent.mkdir(parents=True, exist_ok=True)
    args.public_dir.mkdir(parents=True, exist_ok=True)
    master.save(args.master, optimize=True)

    for width in (960, 1440, 2400):
        height = round(master.height * width / master.width)
        output = master.resize((width, height), Image.Resampling.LANCZOS)
        output.save(
            args.public_dir / f"closing-core-v08-{width}.webp",
            "WEBP",
            quality=94,
            method=6,
        )

    print(f"built continuous closing geometry: {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
