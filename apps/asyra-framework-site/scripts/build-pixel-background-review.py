from __future__ import annotations

"""Build review-only, deterministic before/after background-removal sheets.

This script never writes website assets.  It uses only colour distance,
edge-connected flood fill, connected components, and small morphological
operations.  Source RGB values are copied byte-for-byte wherever alpha is
retained.
"""

from dataclasses import dataclass
import importlib.util
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from scipy import ndimage


SITE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = SITE_ROOT / "test-results" / "pixel-background-removal-review-final"


def load_geometry_module():
    path = SITE_ROOT / "scripts" / "build-transparent-v12-assets.py"
    module_spec = importlib.util.spec_from_file_location("transparent_v12", path)
    if module_spec is None or module_spec.loader is None:
        raise RuntimeError(f"Unable to load deterministic geometry module: {path}")
    module = importlib.util.module_from_spec(module_spec)
    sys.modules[module_spec.name] = module
    module_spec.loader.exec_module(module)
    return module


GEOMETRY = load_geometry_module()
GEOMETRY_SPECS = {spec.name: spec for spec in GEOMETRY.SPECS}


@dataclass(frozen=True)
class ReviewSpec:
    name: str
    source: Path
    threshold: float
    close_radius: int
    minimum_component_area: int
    support: tuple[int, int, int, int] | None = None


SPECS = (
    ReviewSpec(
        "hero-core-v12",
        SITE_ROOT / "public" / "illustrations" / "hero-core-v06-1400.webp",
        85.0,
        12,
        100,
        (130, 45, 1270, 1160),
    ),
    ReviewSpec(
        "hero-core-v12-desktop",
        SITE_ROOT
        / "public"
        / "illustrations"
        / "hero-core-v08-desktop-1400.webp",
        80.0,
        12,
        100,
        (45, 20, 1340, 1200),
    ),
    ReviewSpec(
        "domain-rail-v12",
        SITE_ROOT / "public" / "illustrations" / "domain-rail-v06-4800.webp",
        30.0,
        3,
        80,
        (0, 40, 4800, 650),
    ),
    ReviewSpec(
        "domain-rail-v12-desktop",
        SITE_ROOT
        / "public"
        / "illustrations"
        / "domain-rail-v08-desktop-4800.webp",
        30.0,
        3,
        80,
        (0, 40, 4800, 650),
    ),
    ReviewSpec(
        "grow-v12",
        SITE_ROOT / "public" / "illustrations" / "grow-v06-1500.webp",
        30.0,
        10,
        120,
        (60, 25, 1430, 860),
    ),
    ReviewSpec(
        "same-path-v12",
        SITE_ROOT / "public" / "illustrations" / "same-path-v06-1774.webp",
        30.0,
        10,
        100,
        (55, 20, 1710, 720),
    ),
    ReviewSpec(
        "one-source-v12",
        SITE_ROOT / "public" / "illustrations" / "one-source-v06-1536.webp",
        28.0,
        10,
        120,
        (65, 15, 1470, 770),
    ),
    ReviewSpec(
        "one-source-v12-desktop",
        SITE_ROOT
        / "public"
        / "illustrations"
        / "one-source-v08-desktop-1536.webp",
        28.0,
        10,
        120,
        (65, 15, 1470, 770),
    ),
    ReviewSpec(
        "closing-core-v12",
        SITE_ROOT / "artwork" / "v09" / "closing-core-v09-master.png",
        34.0,
        4,
        120,
        (250, 35, 1285, 990),
    ),
)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    if path.exists():
        return ImageFont.truetype(path, size=size)
    return ImageFont.load_default(size=size)


def polynomial_background(rgb: np.ndarray) -> np.ndarray:
    """Fit a smooth quadratic colour field from a robust canvas-edge sample."""
    height, width = rgb.shape[:2]
    band = max(12, min(height, width) // 32)
    yy, xx = np.indices((height, width), dtype=np.float32)
    edge = (xx < band) | (xx >= width - band) | (yy < band) | (yy >= height - band)
    x = (xx[edge] / max(width - 1, 1)) * 2.0 - 1.0
    y = (yy[edge] / max(height - 1, 1)) * 2.0 - 1.0
    design = np.column_stack((np.ones_like(x), x, y, x * x, y * y, x * y))
    values = rgb[edge].astype(np.float32)
    keep = np.ones(values.shape[0], dtype=bool)
    coefficients = np.zeros((design.shape[1], 3), dtype=np.float32)
    for _ in range(5):
        coefficients, *_ = np.linalg.lstsq(design[keep], values[keep], rcond=None)
        residual = np.sqrt(np.sum((values - design @ coefficients) ** 2, axis=1))
        median = float(np.median(residual[keep]))
        mad = float(np.median(np.abs(residual[keep] - median))) + 1.0
        keep = residual <= median + 3.0 * mad
    full_x = (xx / max(width - 1, 1)) * 2.0 - 1.0
    full_y = (yy / max(height - 1, 1)) * 2.0 - 1.0
    full_design = np.stack(
        (
            np.ones_like(full_x),
            full_x,
            full_y,
            full_x * full_x,
            full_y * full_y,
            full_x * full_y,
        ),
        axis=2,
    )
    return np.clip(full_design @ coefficients, 0.0, 255.0)


def disk(radius: int) -> np.ndarray:
    axis = np.arange(-radius, radius + 1)
    yy, xx = np.meshgrid(axis, axis, indexing="ij")
    return xx * xx + yy * yy <= radius * radius


def retain_subject_components(mask: np.ndarray, minimum_area: int) -> np.ndarray:
    labels, count = ndimage.label(mask)
    if count == 0:
        return mask
    areas = np.bincount(labels.ravel())
    keep = areas >= minimum_area
    keep[0] = False
    return keep[labels]


def hero_review_mask(
    source: Image.Image,
    rgb: np.ndarray,
    distance: np.ndarray,
    desktop: bool,
) -> np.ndarray:
    """Recover the closed machine silhouette without its paper cast-shadow."""
    size = source.size
    support, draw = GEOMETRY.mask_canvas(size)
    draw.polygon(
        (
            (286, 128),
            (1118, 128),
            (1174, 210),
            (1174, 976),
            (1108, 1043),
            (296, 1043),
            (226, 976),
            (226, 210),
        ),
        fill=255,
    )
    subject = GEOMETRY.enclosed_subject_in(
        distance,
        support,
        150.0,
        70,
        close_radius=7,
        maximum_hole_area=1_200,
    )
    # The source contains a broad, opaque paper cast-shadow on the right and
    # bottom.  Keep the closed mechanism envelope and discard those exterior
    # pixels; the five protruding connectors are restored from their own
    # source-pixel supports below.
    envelope, envelope_draw = GEOMETRY.mask_canvas(size)
    envelope_draw.polygon(
        (
            (300, 128),
            (1100, 128),
            (1150, 185),
            (1150, 925),
            (1080, 995),
            (320, 995),
            (250, 925),
            (250, 185),
        ),
        fill=255,
    )
    subject &= np.asarray(envelope, dtype=np.uint8) > 0

    connectors, connector_draw = GEOMETRY.mask_canvas(size)
    if desktop:
        connector_draw.ellipse((650, 42, 750, 138), fill=255)
        connector_draw.rounded_rectangle((674, 118, 726, 170), radius=12, fill=255)
        connector_draw.ellipse((72, 510, 151, 594), fill=255)
        connector_draw.rounded_rectangle((128, 536, 216, 574), radius=8, fill=255)
        connector_draw.ellipse((1223, 510, 1304, 594), fill=255)
        connector_draw.rounded_rectangle((1178, 536, 1250, 574), radius=8, fill=255)
        connector_draw.ellipse((320, 1080, 397, 1170), fill=255)
        connector_draw.rounded_rectangle((331, 1008, 384, 1113), radius=10, fill=255)
        connector_draw.ellipse((990, 1080, 1069, 1170), fill=255)
        connector_draw.rounded_rectangle((1001, 1008, 1056, 1113), radius=10, fill=255)
    else:
        connector_draw.ellipse((657, 79, 743, 160), fill=255)
        connector_draw.rounded_rectangle((679, 132, 721, 183), radius=10, fill=255)
        connector_draw.ellipse((163, 518, 232, 594), fill=255)
        connector_draw.rounded_rectangle((216, 540, 304, 575), radius=8, fill=255)
        connector_draw.ellipse((1168, 518, 1237, 594), fill=255)
        connector_draw.rounded_rectangle((1093, 540, 1182, 575), radius=8, fill=255)
        connector_draw.ellipse((399, 1028, 480, 1120), fill=255)
        connector_draw.rounded_rectangle((409, 960, 470, 1055), radius=10, fill=255)
        connector_draw.ellipse((920, 1028, 1001, 1120), fill=255)
        connector_draw.rounded_rectangle((931, 960, 991, 1055), radius=10, fill=255)

    solid, solid_draw = GEOMETRY.mask_canvas(size)
    solid_draw.rounded_rectangle((386, 178, 1014, 886), radius=72, fill=255)
    connector_subject = GEOMETRY.enclosed_subject_in(
        distance,
        connectors,
        60.0,
        8,
        close_radius=3,
        maximum_hole_area=400,
    )
    core = subject | connector_subject | (np.asarray(solid, dtype=np.uint8) > 0)
    return core


def closing_review_mask(mask: np.ndarray) -> np.ndarray:
    """Reject blueprint registration marks protruding from the mechanism."""
    support = np.zeros(mask.shape, dtype=bool)
    support[58:964, 288:1248] = True
    return mask & support


def edge_connected_foreground(source: Image.Image, spec: ReviewSpec) -> np.ndarray:
    rgba = np.asarray(source.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[:, :, :3].astype(np.float32)
    existing_alpha = rgba[:, :, 3]
    estimate = polynomial_background(rgb)
    distance = np.sqrt(np.sum((rgb - estimate) ** 2, axis=2))
    candidate = distance <= spec.threshold
    candidate |= existing_alpha == 0
    candidate = ndimage.binary_closing(candidate, structure=disk(spec.close_radius))

    seeds = np.zeros(candidate.shape, dtype=bool)
    seeds[0, :] = True
    seeds[-1, :] = True
    seeds[:, 0] = True
    seeds[:, -1] = True
    seeds &= candidate
    background = ndimage.binary_propagation(seeds, mask=candidate)
    foreground = ~background
    foreground &= existing_alpha > 0

    if spec.support is not None:
        left, top, right, bottom = spec.support
        supported = np.zeros(foreground.shape, dtype=bool)
        supported[top:bottom, left:right] = True
        foreground &= supported

    foreground = retain_subject_components(foreground, spec.minimum_component_area)

    # The edge-connected pass identifies the removable colour family.  The
    # per-illustration geometry pass is the protected subject seed: it keeps
    # enclosed pale object faces from being mistaken for the pale paper and
    # rejects blueprint marks that merely happen to differ from the paper.
    geometry_spec = GEOMETRY_SPECS[spec.name]
    geometry_background = GEOMETRY.estimate_background(rgb)
    geometry_distance = np.sqrt(
        np.sum((rgb - geometry_background) ** 2, axis=2)
    )
    protected_subject = GEOMETRY.geometry_foreground(
        source,
        geometry_spec,
        geometry_distance,
        rgb,
        include_shadow=False,
    )
    if spec.name == "hero-core-v12":
        protected_subject = hero_review_mask(
            source,
            rgb,
            geometry_distance,
            desktop=False,
        )
    elif spec.name == "closing-core-v12":
        protected_subject = closing_review_mask(protected_subject)
    return protected_subject & (existing_alpha > 0)


def checkerboard(size: tuple[int, int], tile: int = 36) -> Image.Image:
    width, height = size
    yy, xx = np.indices((height, width))
    pattern = ((xx // tile + yy // tile) % 2).astype(np.uint8)
    values = np.where(pattern[:, :, None] == 0, 232, 194).astype(np.uint8)
    return Image.fromarray(np.repeat(values, 3, axis=2), mode="RGB").convert("RGBA")


def contain(image: Image.Image, box: tuple[int, int], background: Image.Image) -> Image.Image:
    fitted = ImageOps.contain(image, box, Image.Resampling.LANCZOS)
    left = (box[0] - fitted.width) // 2
    top = (box[1] - fitted.height) // 2
    background.alpha_composite(fitted, (left, top))
    return background


def report(spec: ReviewSpec) -> tuple[Image.Image, Image.Image]:
    with Image.open(spec.source) as opened:
        source = opened.convert("RGBA")
    foreground = edge_connected_foreground(source, spec)
    rgba = np.asarray(source, dtype=np.uint8).copy()
    rgba[:, :, 3] = np.where(foreground, rgba[:, :, 3], 0)
    result = Image.fromarray(rgba, mode="RGBA")

    preview_path = OUTPUT / f"{spec.name}-transparent-preview.png"
    result.save(preview_path, format="PNG", optimize=True)

    panel_size = (800, 560)
    label_height = 58
    page = Image.new("RGB", (panel_size[0] * 2, panel_size[1] + label_height), "#f6f6f6")
    before_panel = contain(source, panel_size, Image.new("RGBA", panel_size, "#ffffff"))
    after_panel = contain(result, panel_size, checkerboard(panel_size))
    page.paste(before_panel.convert("RGB"), (0, label_height))
    page.paste(after_panel.convert("RGB"), (panel_size[0], label_height))
    draw = ImageDraw.Draw(page)
    draw.text((20, 16), "SOURCE — BACKGROUND PRESENT", fill="#151515", font=font(26))
    draw.text((panel_size[0] + 20, 16), "RESULT — TRANSPARENT", fill="#151515", font=font(26))
    report_path = OUTPUT / f"{spec.name}-before-after.png"
    page.save(report_path, format="PNG", optimize=True)
    return page, result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    pages: list[tuple[str, Image.Image]] = []
    for spec in SPECS:
        page, _ = report(spec)
        pages.append((spec.name, page))
        print(f"{spec.name}: {spec.source.relative_to(SITE_ROOT)}")

    width = 1600
    row_height = 680
    sheet = Image.new("RGB", (width, row_height * len(pages)), "#eeeeee")
    draw = ImageDraw.Draw(sheet)
    for index, (name, page) in enumerate(pages):
        y = index * row_height
        draw.text((20, y + 12), name, fill="#111111", font=font(30))
        scaled = ImageOps.contain(page, (width, row_height - 58), Image.Resampling.LANCZOS)
        sheet.paste(scaled, ((width - scaled.width) // 2, y + 58))
    sheet.save(OUTPUT / "all-site-images-before-after.png", format="PNG", optimize=True)


if __name__ == "__main__":
    main()
