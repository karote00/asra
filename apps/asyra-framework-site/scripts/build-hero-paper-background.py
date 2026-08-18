from __future__ import annotations

from pathlib import Path
import re

import numpy as np
from PIL import Image
from scipy import ndimage


SITE_ROOT = Path(__file__).resolve().parents[1]
SOURCE = SITE_ROOT / "artwork" / "v08-desktop" / "hero-core-v08-desktop-master.png"
CSS_SOURCE = SITE_ROOT / "app" / "globals.css"
SUBJECT_PROTECTION = (
    SITE_ROOT
    / "artwork"
    / "v12-transparent"
    / "algorithmic-masks"
    / "hero-core-v12-desktop-grabcut.png"
)
OUTPUT_DIR = SITE_ROOT / "artwork" / "hero-paper-background"
OUTPUT = OUTPUT_DIR / "hero-core-v08-desktop-paper-background.png"
QA_MASK = OUTPUT_DIR / "qa" / "recoloured-background-mask.png"
QA_SEAM = OUTPUT_DIR / "qa" / "paper-seam-preview.png"


def read_paper_colour() -> np.ndarray:
    css = CSS_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"--paper:\s*#([0-9a-fA-F]{6})\s*;", css)
    if match is None:
        raise RuntimeError("Unable to find --paper in app/globals.css")
    value = match.group(1)
    return np.array(
        [int(value[index : index + 2], 16) for index in (0, 2, 4)],
        dtype=np.float64,
    )


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


def estimate_canvas_field(rgb: np.ndarray) -> np.ndarray:
    height, width = rgb.shape[:2]
    features = polynomial_features(width, height)
    brightness = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    yy, xx = np.mgrid[0:height, 0:width]
    outer_band = (
        (xx < width * 0.16)
        | (xx >= width * 0.84)
        | (yy < height * 0.12)
        | (yy >= height * 0.91)
    )
    samples = outer_band & (brightness >= 220.0) & (spread <= 24.0)
    sample_y, sample_x = np.nonzero(samples)
    if sample_x.size < 25_000:
        raise RuntimeError("Insufficient clean canvas samples")

    stride = max(1, sample_x.size // 160_000)
    sample_y = sample_y[::stride]
    sample_x = sample_x[::stride]
    design = features[sample_y, sample_x]
    observed = rgb[sample_y, sample_x]
    keep = np.ones(design.shape[0], dtype=bool)
    coefficients = np.zeros((design.shape[1], 3), dtype=np.float64)
    for _ in range(5):
        coefficients, *_ = np.linalg.lstsq(design[keep], observed[keep], rcond=None)
        residual = observed - design @ coefficients
        keep = (
            (np.linalg.norm(residual, axis=1) <= 7.0)
            & (residual.mean(axis=1) >= -2.5)
            & (residual.mean(axis=1) <= 4.0)
        )
    field = features.reshape(-1, features.shape[-1]) @ coefficients
    return np.clip(field.reshape(height, width, 3), 0.0, 255.0)


def connected_canvas_selector(
    rgb: np.ndarray,
    field: np.ndarray,
    protected_subject: np.ndarray,
) -> np.ndarray:
    height, width = rgb.shape[:2]
    residual = rgb - field
    residual_norm = np.linalg.norm(residual, axis=2)
    brightness = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    darkness = field.mean(axis=2) - brightness

    # Only canvas-like pixels may participate.  Flooding from the image edge
    # means similarly coloured white machinery enclosed by its dark outline is
    # not recoloured.
    passable = (
        (brightness >= 168.0)
        & (spread <= 52.0)
        & (residual_norm <= 58.0)
        & (darkness <= 48.0)
    )
    passable &= ~protected_subject
    seed = np.zeros((height, width), dtype=bool)
    seed[:4, :] = passable[:4, :]
    seed[-4:, :] = passable[-4:, :]
    seed[:, :4] = passable[:, :4]
    seed[:, -4:] = passable[:, -4:]
    return ndimage.binary_propagation(
        seed,
        structure=np.ones((3, 3), dtype=bool),
        mask=passable,
    )


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    source_rgb = np.asarray(source, dtype=np.uint8)
    source_float = source_rgb.astype(np.float64)
    protection_image = Image.open(SUBJECT_PROTECTION).convert("L")
    if protection_image.size != source.size:
        raise RuntimeError("Subject protection dimensions differ from the Hero")
    protected_subject = np.asarray(protection_image, dtype=np.uint8) >= 128
    protected_subject = ndimage.binary_fill_holes(protected_subject)
    protected_subject = ndimage.binary_closing(protected_subject, iterations=1)
    target = read_paper_colour()
    field = estimate_canvas_field(source_float)
    canvas = connected_canvas_selector(source_float, field, protected_subject)

    # Move the connected canvas field to the site's --paper hue.  Clean paper
    # pixels converge to the exact CSS colour so the rectangular image bounds
    # disappear; larger residuals (grid antialiasing and original shadows)
    # retain their source-relative contrast.
    recoloured = source_float.copy()
    residual = source_float - field
    residual_norm = np.linalg.norm(residual, axis=2)
    preserve = 1.0 - np.exp(-np.square(residual_norm / 10.0))
    paper_mapped = target.reshape(1, 1, 3) + residual * preserve[:, :, None]
    recoloured[canvas] = paper_mapped[canvas]
    recoloured = np.clip(np.round(recoloured), 0.0, 255.0).astype(np.uint8)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(recoloured).save(OUTPUT, optimize=True)
    QA_MASK.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.where(canvas, 255, 0).astype(np.uint8)).save(
        QA_MASK,
        optimize=True,
    )
    seam_preview = Image.new(
        "RGB",
        (source.width + 200, source.height + 200),
        tuple(int(value) for value in target),
    )
    seam_preview.paste(Image.fromarray(recoloured), (100, 100))
    seam_preview.save(QA_SEAM, optimize=True)

    changed = np.any(recoloured != source_rgb, axis=2)
    if source.size != (1400, 1254):
        raise RuntimeError("Hero dimensions changed")
    if not np.array_equal(recoloured[~canvas], source_rgb[~canvas]):
        raise RuntimeError("A protected non-background pixel was modified")
    if np.any(changed & ~canvas):
        raise RuntimeError("A changed pixel exists outside the canvas selector")
    if np.mean(changed[canvas]) < 0.95:
        raise RuntimeError("Too few selected canvas pixels changed after rounding")

    selected_mean = recoloured[canvas].mean(axis=0)
    print(f"output={OUTPUT}")
    print(f"source-size={source.width}x{source.height}")
    print(f"paper-colour={','.join(str(int(value)) for value in target)}")
    print(f"recoloured-pixels={int(np.count_nonzero(canvas))}")
    print(f"recoloured-fraction={np.mean(canvas):.1%}")
    print(
        "selected-output-mean="
        + ",".join(f"{value:.2f}" for value in selected_mean)
    )
    print("protected-pixel-difference=0")


if __name__ == "__main__":
    build()
