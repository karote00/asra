from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


SITE_ROOT = Path(__file__).resolve().parents[1]
SOURCE = SITE_ROOT / "artwork" / "v08-desktop" / "hero-core-v08-desktop-master.png"
MACHINE_SELECTOR = (
    SITE_ROOT
    / "artwork"
    / "v12-transparent"
    / "algorithmic-masks"
    / "hero-core-v12-desktop-grabcut.png"
)
OUTPUT_DIR = SITE_ROOT / "artwork" / "pixel-selected"
OUTPUT = OUTPUT_DIR / "hero-core-v08-desktop-master-transparent-pixel-selected.png"
MASK_OUTPUT = OUTPUT_DIR / "hero-core-v08-desktop-master-pixel-selection-mask.png"
QA_DIR = OUTPUT_DIR / "qa"

VERTICAL_GRID_LINES = (115, 415, 918, 1022, 1255)
HORIZONTAL_GRID_LINES = (90, 184, 378, 811, 1027, 1115)


def polynomial_features(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width]
    x = xx.astype(np.float64) / max(width - 1, 1) * 2.0 - 1.0
    y = yy.astype(np.float64) / max(height - 1, 1) * 2.0 - 1.0
    return np.stack(
        (
            np.ones_like(x),
            x,
            y,
            x * x,
            x * y,
            y * y,
            x * x * x,
            x * x * y,
            x * y * y,
            y * y * y,
        ),
        axis=-1,
    )


def estimate_background(rgb: np.ndarray, machine: np.ndarray) -> np.ndarray:
    height, width = rgb.shape[:2]
    features = polynomial_features(width, height)
    brightness = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    outside = ~ndimage.binary_dilation(machine, iterations=75)
    samples = outside & (brightness >= 223.0) & (spread <= 22.0)
    ys, xs = np.nonzero(samples)
    if xs.size < 20_000:
        raise RuntimeError("Insufficient background samples")
    stride = max(1, xs.size // 180_000)
    ys = ys[::stride]
    xs = xs[::stride]
    design = features[ys, xs]
    observed = rgb[ys, xs]
    keep = np.ones(design.shape[0], dtype=bool)
    coefficients = np.zeros((design.shape[1], 3), dtype=np.float64)
    for _ in range(4):
        coefficients, *_ = np.linalg.lstsq(design[keep], observed[keep], rcond=None)
        residual = observed - design @ coefficients
        keep = (
            (np.linalg.norm(residual, axis=1) <= 8.0)
            & (residual.mean(axis=1) >= -3.0)
        )
    background = features.reshape(-1, features.shape[-1]) @ coefficients
    return np.clip(background.reshape(height, width, 3), 0.0, 255.0)


def refine_machine_selector(
    coarse: np.ndarray,
    rgb: np.ndarray,
    background: np.ndarray,
) -> np.ndarray:
    """Remove canvas pixels previously swallowed by the coarse silhouette.

    The interior remains selected as a solid object.  Only the narrow outer
    band is reclassified from its original pixels; no output colour is ever
    synthesized here.
    """
    luminance = rgb.mean(axis=2)
    background_luminance = background.mean(axis=2)
    darkness = np.maximum(background_luminance - luminance, 0.0)
    residual = np.linalg.norm(rgb - background, axis=2)
    inside = ndimage.distance_transform_edt(coarse)

    core = coarse & (inside >= 15.0)
    structural_boundary = coarse & ((darkness >= 18.0) | (residual >= 28.0))
    structural_boundary = ndimage.binary_dilation(structural_boundary, iterations=1)
    refined = (core | structural_boundary) & coarse
    refined = ndimage.binary_closing(refined, iterations=1)
    return refined


def grid_selector(
    darkness: np.ndarray,
    machine: np.ndarray,
) -> np.ndarray:
    height, width = darkness.shape
    stroke_corridor = np.zeros((height, width), dtype=bool)
    for x in VERTICAL_GRID_LINES:
        stroke_corridor[:, max(0, x - 3) : min(width, x + 4)] = True
    for y in HORIZONTAL_GRID_LINES:
        stroke_corridor[max(0, y - 3) : min(height, y + 4), :] = True

    registration_windows = np.zeros((height, width), dtype=bool)
    for x in VERTICAL_GRID_LINES:
        for y in HORIZONTAL_GRID_LINES:
            registration_windows[
                max(0, y - 18) : min(height, y + 19),
                max(0, x - 18) : min(width, x + 19),
            ] = True

    # Grow only the lightly anti-aliased pixels that are directly attached to
    # a dark grid/registration stroke.  This avoids classifying the warm
    # canvas texture inside each corridor as part of the line.
    corridor = stroke_corridor | registration_windows
    weak = corridor & ~machine & (darkness >= 5.5)
    strong = corridor & ~machine & (darkness >= 11.0)
    labels, count = ndimage.label(weak)
    keep = np.zeros(count + 1, dtype=bool)
    if count:
        areas = np.bincount(labels.ravel())
        objects = ndimage.find_objects(labels)
        for label, slices in enumerate(objects, start=1):
            if slices is None or areas[label] < 4:
                continue
            h = slices[0].stop - slices[0].start
            w = slices[1].stop - slices[1].start
            component = labels[slices] == label
            peak = float(darkness[slices][component].max(initial=0.0))
            has_strong_seed = bool(np.any(strong[slices] & component))
            line_like = min(w, h) <= 7 or max(w, h) >= 3.5 * min(w, h)
            registration_mark = (
                areas[label] <= 520
                and peak >= 24.0
                and bool(np.any(registration_windows[slices] & component))
            )
            keep[label] = has_strong_seed and (line_like or registration_mark)
    selected = keep[labels]
    return selected & corridor & ~machine


def shadow_selector(
    darkness: np.ndarray,
    machine: np.ndarray,
    grid: np.ndarray,
) -> np.ndarray:
    # This mask only classifies pixels. It never changes their RGB values or
    # computes replacement shadow colours/opacity.
    broad_darkness = ndimage.gaussian_filter(darkness, sigma=4.0)
    distance = ndimage.distance_transform_edt(~machine)
    shadow = (
        ~machine
        & ~grid
        & (distance <= 8.0)
        & (broad_darkness >= 10.0)
        & (darkness >= 35.0)
    )
    labels, count = ndimage.label(shadow)
    if count == 0:
        return shadow
    areas = np.bincount(labels.ravel())
    keep = areas >= 5
    keep[0] = False
    return keep[labels]


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    source_rgb = np.asarray(source, dtype=np.uint8)
    selector_image = Image.open(MACHINE_SELECTOR).convert("L")
    if selector_image.size != source.size:
        raise RuntimeError("Machine selector size differs from the source")

    coarse_machine = np.asarray(selector_image, dtype=np.uint8) >= 128
    coarse_machine = ndimage.binary_fill_holes(coarse_machine)
    coarse_machine = ndimage.binary_closing(coarse_machine, iterations=1)

    source_float = source_rgb.astype(np.float64)
    background = estimate_background(source_float, coarse_machine)
    machine = coarse_machine
    luminance = source_rgb.astype(np.float64).mean(axis=2)
    background_luminance = background.mean(axis=2)
    darkness = np.maximum(background_luminance - luminance, 0.0)

    grid = grid_selector(darkness, machine)
    # The coarse silhouette already contains the original contact-shadow
    # pixels selected by the source-only segmentation.  Adding a second halo
    # would duplicate those shadows and retain canvas-coloured slabs.
    shadow = np.zeros_like(machine, dtype=bool)
    selected = machine | grid | shadow

    alpha = np.where(selected, 255, 0).astype(np.uint8)
    rgba = np.zeros((source.height, source.width, 4), dtype=np.uint8)
    rgba[:, :, :3][selected] = source_rgb[selected]
    rgba[:, :, 3] = alpha

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(OUTPUT, optimize=True)
    Image.fromarray(alpha).save(MASK_OUTPUT, optimize=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.where(machine, 255, 0).astype(np.uint8)).save(
        QA_DIR / "machine-mask.png",
        optimize=True,
    )
    Image.fromarray(np.where(grid, 255, 0).astype(np.uint8)).save(
        QA_DIR / "grid-mask.png",
        optimize=True,
    )
    Image.fromarray(np.where(shadow, 255, 0).astype(np.uint8)).save(
        QA_DIR / "shadow-mask.png",
        optimize=True,
    )
    rendered = Image.fromarray(rgba)
    for name, colour in (
        ("light-preview.png", (246, 241, 235, 255)),
        ("dark-preview.png", (18, 22, 26, 255)),
    ):
        preview = Image.new("RGBA", source.size, colour)
        preview.alpha_composite(rendered)
        preview.convert("RGB").save(QA_DIR / name, optimize=True)

    output = np.asarray(Image.open(OUTPUT).convert("RGBA"), dtype=np.uint8)
    unique_alpha = set(np.unique(output[:, :, 3]).tolist())
    if source.size != (1400, 1254):
        raise RuntimeError("Source dimensions are not 1400 × 1254")
    if unique_alpha != {0, 255}:
        raise RuntimeError(f"Alpha is not binary: {sorted(unique_alpha)}")
    if not np.array_equal(output[:, :, :3][selected], source_rgb[selected]):
        raise RuntimeError("At least one selected source pixel was modified")
    if np.any(output[:, :, 3][~selected] != 0):
        raise RuntimeError("At least one rejected pixel is not transparent")

    print(f"output={OUTPUT}")
    print(f"mask={MASK_OUTPUT}")
    print(f"source-size={source.width}x{source.height}")
    print(f"selected={np.mean(selected):.1%}")
    print(f"machine-pixels={int(np.count_nonzero(machine))}")
    print(f"grid-pixels={int(np.count_nonzero(grid & ~machine))}")
    print(f"shadow-pixels={int(np.count_nonzero(shadow & ~machine & ~grid))}")
    print("selected-rgb-difference=0")
    print("alpha-values=0,255")


if __name__ == "__main__":
    build()
