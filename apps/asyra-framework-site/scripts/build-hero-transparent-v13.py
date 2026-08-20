from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


SITE_ROOT = Path(__file__).resolve().parents[1]
SOURCE = SITE_ROOT / "artwork" / "v08-desktop" / "hero-core-v08-desktop-master.png"
SUBJECT_MASK = (
    SITE_ROOT
    / "artwork"
    / "v12-transparent"
    / "algorithmic-masks"
    / "hero-core-v12-desktop-grabcut.png"
)
CHROMA_REFERENCE = Path(
    "/Users/asa/.codex/generated_images/01a0065e-cd89-7740-8f6e-3f991979007c/"
    "exec-fdc0e7a2-501b-418d-9305-6dacc65834cc.png"
)
OUTPUT_DIR = SITE_ROOT / "artwork" / "v13-transparent-redraw"
OUTPUT = OUTPUT_DIR / "hero-core-v13-transparent-master.png"
PREVIEW = OUTPUT_DIR / "hero-core-v13-transparent-dark-preview.png"


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


def estimate_background(rgb: np.ndarray, subject: np.ndarray) -> np.ndarray:
    height, width = rgb.shape[:2]
    features = polynomial_features(width, height)
    brightness = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    far_from_subject = ~ndimage.binary_dilation(subject, iterations=52)

    # Bright, nearly neutral pixels away from the machine are the untouched
    # warm canvas. Dark construction marks and contact shadows are excluded.
    samples = far_from_subject & (brightness >= 221.0) & (spread <= 24.0)
    sample_y, sample_x = np.nonzero(samples)
    if sample_x.size < 20_000:
        raise RuntimeError("Not enough clean background samples")

    stride = max(1, sample_x.size // 180_000)
    sample_y = sample_y[::stride]
    sample_x = sample_x[::stride]
    design = features[sample_y, sample_x]
    observed = rgb[sample_y, sample_x].astype(np.float64)

    # Iteratively remove darker residuals so original grid and soft shadows
    # cannot pull the fitted background toward themselves.
    keep = np.ones(design.shape[0], dtype=bool)
    coefficients = np.zeros((design.shape[1], 3), dtype=np.float64)
    for _ in range(4):
        coefficients, *_ = np.linalg.lstsq(design[keep], observed[keep], rcond=None)
        prediction = design @ coefficients
        residual = observed - prediction
        residual_norm = np.linalg.norm(residual, axis=1)
        luminance_residual = residual.mean(axis=1)
        keep = (residual_norm <= 9.0) & (luminance_residual >= -3.5)

    background = features.reshape(-1, features.shape[-1]) @ coefficients
    return np.clip(background.reshape(height, width, 3), 0.0, 255.0)


def minimum_valid_alpha(rgb: np.ndarray, background: np.ndarray) -> np.ndarray:
    eps = 1e-6
    darker = np.maximum(background - rgb, 0.0) / np.maximum(background, eps)
    lighter = np.maximum(rgb - background, 0.0) / np.maximum(255.0 - background, eps)
    return np.maximum(darker.max(axis=2), lighter.max(axis=2))


def disk(radius: int) -> np.ndarray:
    axis = np.arange(-radius, radius + 1)
    yy, xx = np.meshgrid(axis, axis, indexing="ij")
    return xx * xx + yy * yy <= radius * radius


def semantic_subject_mask(size: tuple[int, int]) -> np.ndarray:
    if not CHROMA_REFERENCE.exists():
        raise RuntimeError("Hero chroma reconstruction is unavailable")
    chroma = Image.open(CHROMA_REFERENCE).convert("RGB").resize(
        size,
        Image.Resampling.LANCZOS,
    )
    array = np.asarray(chroma, dtype=np.float64)
    red, green, blue = (array[:, :, index] for index in range(3))
    magenta_strength = np.minimum(red, blue) - green
    candidate = (
        (magenta_strength < 72.0)
        | (green > 52.0)
        | ((blue - red) > 28.0)
    )
    candidate = ndimage.binary_opening(candidate, structure=disk(2))
    labels, count = ndimage.label(candidate)
    if count == 0:
        raise RuntimeError("Hero chroma reconstruction has no subject")
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    subject = labels == int(np.argmax(areas))
    subject = ndimage.binary_closing(subject, structure=disk(3))
    subject = ndimage.binary_fill_holes(subject)
    return subject


def retain_structural_marks(
    alpha: np.ndarray,
    rgb: np.ndarray,
    background: np.ndarray,
    subject: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    luminance = rgb.mean(axis=2)
    background_luminance = background.mean(axis=2)
    darkness = np.maximum(background_luminance - luminance, 0.0)

    # Construction marks are coherent dark strokes. A deliberately high
    # threshold rejects the canvas grain before connected-component filtering.
    candidate = (alpha >= 0.085) & (darkness >= 13.0) & ~subject
    labels, count = ndimage.label(candidate)
    if count == 0:
        structure = np.zeros_like(alpha, dtype=bool)
    else:
        areas = np.bincount(labels.ravel())
        objects = ndimage.find_objects(labels)
        keep = np.zeros(count + 1, dtype=bool)
        for label, slices in enumerate(objects, start=1):
            if slices is None or areas[label] < 8:
                continue
            height = slices[0].stop - slices[0].start
            width = slices[1].stop - slices[1].start
            box_area = max(width * height, 1)
            fill_ratio = areas[label] / box_area
            elongation = max(width, height) / max(min(width, height), 1)
            local_darkness = darkness[slices][labels[slices] == label]
            peak_darkness = float(local_darkness.max(initial=0.0))
            is_line = min(width, height) <= 10 or (
                elongation >= 6.0 and fill_ratio <= 0.20
            )
            is_registration_mark = areas[label] <= 320 and peak_darkness >= 42.0
            keep[label] = is_line or is_registration_mark
        structure = keep[labels]
        structure = ndimage.binary_dilation(structure, iterations=1)

    structure_alpha = np.where(structure, alpha, 0.0)

    # Average away the canvas grain before reconstructing the broad natural
    # contact shadows. Keep them only in a narrow band around the silhouette.
    shadow_signal = ndimage.gaussian_filter(darkness, sigma=5.0)
    distance_from_subject = ndimage.distance_transform_edt(~subject)
    shadow_falloff = np.exp(-np.square(distance_from_subject / 34.0))
    shadow_alpha = np.clip((shadow_signal - 1.5) / 180.0, 0.0, 0.55)
    shadow_alpha *= shadow_falloff
    shadow_alpha = np.where(~subject, shadow_alpha, 0.0)
    shadow_alpha[shadow_alpha < 0.012] = 0.0

    return structure_alpha, shadow_alpha


def unblend(
    rgb: np.ndarray,
    background: np.ndarray,
    alpha: np.ndarray,
) -> np.ndarray:
    safe_alpha = np.maximum(alpha[..., None], 1.0 / 255.0)
    foreground = (rgb - (1.0 - safe_alpha) * background) / safe_alpha
    foreground = np.clip(np.round(foreground), 0.0, 255.0)
    foreground[alpha <= 0.0] = 0.0
    return foreground.astype(np.uint8)


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    rgb = np.asarray(source, dtype=np.float64)
    mask_image = Image.open(SUBJECT_MASK).convert("L")
    if mask_image.size != source.size:
        raise RuntimeError("Subject mask dimensions do not match the Hero source")

    subject = np.asarray(mask_image, dtype=np.uint8) >= 128
    semantic_subject = semantic_subject_mask(source.size)
    subject &= ndimage.binary_dilation(semantic_subject, structure=disk(6))
    subject = ndimage.binary_fill_holes(subject)
    subject = ndimage.binary_closing(subject, iterations=1)
    background = estimate_background(rgb, subject)
    raw_alpha = minimum_valid_alpha(rgb, background)
    structure_alpha, shadow_alpha = retain_structural_marks(
        raw_alpha,
        rgb,
        background,
        subject,
    )
    background_art = np.maximum(structure_alpha, shadow_alpha)

    inside = ndimage.distance_transform_edt(subject)
    outside = ndimage.distance_transform_edt(~subject)
    signed_distance = inside - outside
    edge_alpha = np.clip((signed_distance + 1.5) / 3.0, 0.0, 1.0)
    alpha = np.maximum(edge_alpha, background_art)
    alpha[subject & (inside >= 2.0)] = 1.0
    alpha[alpha < 0.008] = 0.0
    alpha = np.clip(alpha, 0.0, 1.0)

    foreground = unblend(rgb, background, alpha)
    shadow_only = (shadow_alpha > structure_alpha) & ~subject
    foreground[shadow_only] = np.array((0, 0, 0), dtype=np.uint8)
    opaque_core = subject & (inside >= 2.0)
    foreground[opaque_core] = np.asarray(source, dtype=np.uint8)[opaque_core]
    alpha_u8 = np.round(alpha * 255.0).astype(np.uint8)
    rgba = np.dstack((foreground, alpha_u8))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(OUTPUT, optimize=True)

    # A dark composite exposes beige fringes, missing grid marks, and broken
    # shadow gradients much more clearly than a checkerboard alone.
    dark = Image.new("RGBA", source.size, (20, 25, 29, 255))
    dark.alpha_composite(Image.fromarray(rgba))
    dark.convert("RGB").save(PREVIEW, optimize=True)

    transparent_fraction = float(np.mean(alpha_u8 == 0))
    soft_fraction = float(np.mean((alpha_u8 > 0) & (alpha_u8 < 255)))
    outside_nonzero = int(np.count_nonzero((alpha_u8 > 0) & ~subject))
    if source.size != (1400, 1254):
        raise RuntimeError("Hero dimensions changed")
    if alpha_u8.min() != 0 or alpha_u8.max() != 255:
        raise RuntimeError("Hero output is not genuinely transparent RGBA")
    if not 0.28 <= transparent_fraction <= 0.49:
        raise RuntimeError("Hero transparent coverage is implausible")
    if soft_fraction < 0.01:
        raise RuntimeError("Hero lost its antialiasing or original soft shadows")
    if outside_nonzero < 18_000:
        raise RuntimeError("Hero lost construction grid or surrounding shadows")

    print(f"output={OUTPUT}")
    print(f"preview={PREVIEW}")
    print(f"transparent={transparent_fraction:.1%}")
    print(f"soft-alpha={soft_fraction:.1%}")
    print(f"retained-grid-shadow-pixels={outside_nonzero}")


if __name__ == "__main__":
    build()
