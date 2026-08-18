from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageStat


SITE_ROOT = Path(__file__).resolve().parents[1]
V04_REFERENCE = SITE_ROOT / "public" / "illustrations" / "grow-v04-1920.webp"
V06_MASTER = SITE_ROOT / "artwork" / "v06" / "grow-master.png"
V11_ARTWORK = SITE_ROOT / "artwork" / "v11-desktop"
OUTPUT = SITE_ROOT / "public" / "illustrations"

REFERENCE_BOX = (1100, 450, 1470, 725)
TARGET_BOX = (895, 340, 1180, 546)
MASTER_CROP = (0, 50, 1518, 950)
OUTPUT_WIDTH = 1500
PYRAMID_SCALE = 4
SOURCE_SUPPORT_BOXES = (
    (44, 50, 348, 223),
    (21, 34, 71, 236),
    (252, 72, 289, 218),
    (327, 33, 366, 236),
)
EXPECTED_SOURCE_SHA256 = (
    "490ea5da4235ce86a07aff7e2a7749710537ee3c87364b7a6482603388ae5761"
)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_approved_source_pixels() -> Image.Image:
    return Image.open(V04_REFERENCE).convert("RGB").crop(REFERENCE_BOX)


def derive_connector_mask_from_reference(reference: Image.Image) -> Image.Image:
    width, height = reference.size
    values: list[int] = []
    for y in range(height):
        for x in range(width):
            alpha = 0
            for left, top, right, bottom in SOURCE_SUPPORT_BOXES:
                if left <= x < right and top <= y < bottom:
                    distance = min(x - left, right - 1 - x, y - top, bottom - 1 - y)
                    alpha = max(alpha, min(255, 96 + distance * 96))
            values.append(alpha)
    mask = Image.new("L", reference.size)
    mask.putdata(values)
    return mask.filter(ImageFilter.GaussianBlur(0.55))


def deblock_source_pixels(reference: Image.Image) -> Image.Image:
    luminance, blue_chroma, red_chroma = reference.convert("YCbCr").split()
    width, height = luminance.size
    source_values = list(luminance.getdata())
    filtered_values: list[int] = []
    radius = 2
    spatial_sigma = 1.35
    range_sigma = 24.0
    spatial_weights = {
        (delta_x, delta_y): math.exp(
            -(delta_x * delta_x + delta_y * delta_y) / (2 * spatial_sigma**2)
        )
        for delta_y in range(-radius, radius + 1)
        for delta_x in range(-radius, radius + 1)
    }
    for y in range(height):
        for x in range(width):
            center = source_values[y * width + x]
            weighted_sum = 0.0
            total_weight = 0.0
            for delta_y in range(-radius, radius + 1):
                sample_y = min(height - 1, max(0, y + delta_y))
                for delta_x in range(-radius, radius + 1):
                    sample_x = min(width - 1, max(0, x + delta_x))
                    sample = source_values[sample_y * width + sample_x]
                    difference = sample - center
                    range_weight = math.exp(
                        -(difference * difference) / (2 * range_sigma**2)
                    )
                    weight = spatial_weights[(delta_x, delta_y)] * range_weight
                    weighted_sum += sample * weight
                    total_weight += weight
            filtered_values.append(round(weighted_sum / total_weight))
    bilateral = Image.new("L", luminance.size)
    bilateral.putdata(filtered_values)
    luminance = Image.blend(luminance, bilateral, 0.92)
    blue_chroma = Image.blend(
        blue_chroma,
        blue_chroma.filter(ImageFilter.GaussianBlur(1.2)),
        0.9,
    )
    red_chroma = Image.blend(
        red_chroma,
        red_chroma.filter(ImageFilter.GaussianBlur(1.2)),
        0.9,
    )
    return Image.merge("YCbCr", (luminance, blue_chroma, red_chroma)).convert("RGB")


def iterative_back_projection(
    source: Image.Image,
    target_size: tuple[int, int],
    iterations: int = 4,
) -> Image.Image:
    reconstructed = source.resize(target_size, Image.Resampling.LANCZOS)
    for _ in range(iterations):
        projected = reconstructed.resize(source.size, Image.Resampling.LANCZOS)
        residual = ImageChops.subtract(source, projected, scale=1.0, offset=128)
        residual = residual.resize(target_size, Image.Resampling.BICUBIC)
        reconstructed = ImageChops.add(
            reconstructed,
            residual,
            scale=1.0,
            offset=-128,
        )
    return reconstructed


def enforce_source_scale_consistency(
    source: Image.Image,
    reconstructed: Image.Image,
    iterations: int = 3,
) -> Image.Image:
    corrected = reconstructed
    for _ in range(iterations):
        projected = corrected.resize(source.size, Image.Resampling.LANCZOS)
        residual = ImageChops.subtract(source, projected, scale=1.0, offset=128)
        residual = residual.resize(corrected.size, Image.Resampling.BICUBIC)
        corrected = ImageChops.add(corrected, residual, scale=1.0, offset=-128)
    return corrected


def edge_guided_source_detail(
    source: Image.Image,
    reconstructed: Image.Image,
    final_stage: bool = False,
) -> Image.Image:
    edge_mask = source.convert("L").filter(ImageFilter.FIND_EDGES)
    if final_stage:
        edge_mask = edge_mask.point(
            lambda value: 0 if value < 18 else min(255, (value - 18) * 7)
        )
        edge_mask = edge_mask.filter(ImageFilter.MaxFilter(5))
        edge_mask = edge_mask.filter(ImageFilter.GaussianBlur(0.4))
        edge_mask = ImageEnhance.Brightness(edge_mask).enhance(1.8)
    else:
        edge_mask = edge_mask.filter(ImageFilter.GaussianBlur(0.35))
        edge_mask = ImageEnhance.Contrast(edge_mask).enhance(1.2)
    edge_mask = edge_mask.resize(reconstructed.size, Image.Resampling.LANCZOS)
    fine_percent = 62
    broad_percent = 42
    fine_radius = 0.9
    broad_radius = 2.4
    detail_blend = 0.42
    if final_stage:
        fine_percent = 650
        broad_percent = 315
        fine_radius = 1.05
        broad_radius = 2.2
        detail_blend = 0.35
    fine_detail = reconstructed.filter(
        ImageFilter.UnsharpMask(radius=fine_radius, percent=fine_percent, threshold=2)
    )
    broad_detail = fine_detail.filter(
        ImageFilter.UnsharpMask(radius=broad_radius, percent=broad_percent, threshold=3)
    )
    sharpened = Image.blend(fine_detail, broad_detail, detail_blend)
    restored = Image.composite(sharpened, reconstructed, edge_mask)
    if final_stage:
        restored = enforce_source_scale_consistency(source, restored)
    return restored


def reconstruct_source_pixel_pyramid(
    reference: Image.Image,
    mask: Image.Image,
) -> Image.Image:
    deblocked = deblock_source_pixels(reference)
    stage_two = iterative_back_projection(
        deblocked,
        (reference.width * 2, reference.height * 2),
    )
    stage_two = edge_guided_source_detail(reference, stage_two)
    stage_four = iterative_back_projection(
        stage_two,
        (reference.width * PYRAMID_SCALE, reference.height * PYRAMID_SCALE),
    )
    stage_four = edge_guided_source_detail(deblocked, stage_four, final_stage=True)

    reconstructed_mask = iterative_back_projection(
        mask,
        stage_four.size,
        iterations=3,
    ).filter(ImageFilter.GaussianBlur(0.8))
    reconstructed = stage_four.convert("RGBA")
    reconstructed.putalpha(reconstructed_mask)
    return reconstructed


def fit_source_pixels_to_v06_anchors(reconstructed: Image.Image) -> Image.Image:
    width = TARGET_BOX[2] - TARGET_BOX[0]
    height = TARGET_BOX[3] - TARGET_BOX[1]
    return reconstructed.resize((width, height), Image.Resampling.LANCZOS)


def masked_mean(image: Image.Image, mask: Image.Image) -> float:
    return float(ImageStat.Stat(image, mask=mask).mean[0])


def texture_energy(image: Image.Image, mask: Image.Image) -> float:
    luminance = image.convert("L")
    low_frequency = luminance.filter(ImageFilter.GaussianBlur(1.0))
    residual = ImageChops.difference(luminance, low_frequency)
    return masked_mean(residual, mask)


def edge_energy(image: Image.Image, mask: Image.Image) -> float:
    edges = image.convert("L").filter(ImageFilter.FIND_EDGES)
    return masked_mean(edges, mask)


def chroma_artifact_energy(image: Image.Image, mask: Image.Image) -> float:
    _, blue_chroma, red_chroma = image.convert("YCbCr").split()
    energies = []
    for channel in (blue_chroma, red_chroma):
        local_average = channel.filter(ImageFilter.GaussianBlur(0.85))
        energies.append(masked_mean(ImageChops.difference(channel, local_average), mask))
    return sum(energies) / len(energies)


def luma_artifact_energy(image: Image.Image, mask: Image.Image) -> float:
    luminance = image.convert("L")
    local_median = luminance.filter(ImageFilter.MedianFilter(3))
    return masked_mean(ImageChops.difference(luminance, local_median), mask)


def measure_source_fidelity(
    reference: Image.Image,
    source_mask: Image.Image,
    reconstructed: Image.Image,
) -> dict[str, float | str]:
    round_trip = reconstructed.convert("RGB").resize(
        reference.size,
        Image.Resampling.LANCZOS,
    )
    round_trip_alpha = reconstructed.getchannel("A").resize(
        source_mask.size,
        Image.Resampling.LANCZOS,
    )
    difference = ImageChops.difference(reference, round_trip)
    channel_means = ImageStat.Stat(difference, mask=source_mask).mean
    mean_absolute_error = sum(channel_means) / len(channel_means)

    source_edge = edge_energy(reference, source_mask)
    restored_edge = edge_energy(round_trip, source_mask)
    source_texture = texture_energy(reference, source_mask)
    restored_texture = texture_energy(round_trip, source_mask)
    source_chroma_artifacts = chroma_artifact_energy(reference, source_mask)
    restored_chroma_artifacts = chroma_artifact_energy(round_trip, source_mask)
    source_luma_artifacts = luma_artifact_energy(reference, source_mask)
    restored_luma_artifacts = luma_artifact_energy(round_trip, source_mask)
    high_resolution_mask = source_mask.resize(
        reconstructed.size,
        Image.Resampling.LANCZOS,
    )
    simple_enlargement = deblock_source_pixels(reference).resize(
        reconstructed.size,
        Image.Resampling.LANCZOS,
    )
    high_resolution_edge_gain = edge_energy(
        reconstructed.convert("RGB"),
        high_resolution_mask,
    ) / edge_energy(simple_enlargement, high_resolution_mask)

    support = derive_connector_mask_from_reference(reference).point(
        lambda value: 255 if value >= 16 else 0
    )
    source_pixels = sum(1 for value in source_mask.getdata() if value >= 16)
    covered_pixels = sum(
        1
        for source_alpha, restored_alpha in zip(
            source_mask.getdata(),
            round_trip_alpha.getdata(),
        )
        if source_alpha >= 16 and restored_alpha >= 16
    )

    total_alpha = sum(round_trip_alpha.getdata())
    outside_support_alpha = sum(
        alpha
        for alpha, support_alpha in zip(
            round_trip_alpha.getdata(),
            support.getdata(),
        )
        if support_alpha == 0
    )
    left = min(box[0] for box in SOURCE_SUPPORT_BOXES)
    top = min(box[1] for box in SOURCE_SUPPORT_BOXES)
    right = max(box[2] for box in SOURCE_SUPPORT_BOXES)
    bottom = max(box[3] for box in SOURCE_SUPPORT_BOXES)
    background_alpha = 0
    for y in range(reference.height):
        for x in range(reference.width):
            if x < left or x >= right or y < top or y >= bottom:
                background_alpha += round_trip_alpha.getpixel((x, y))

    return {
        "mode": "source-pixel-pyramid",
        "sourceAssetSha256": file_sha256(V04_REFERENCE),
        "roundTripMeanAbsoluteError": round(mean_absolute_error, 4),
        "edgeEnergyRatio": round(restored_edge / source_edge, 4),
        "textureEnergyRatio": round(restored_texture / source_texture, 4),
        "sourcePixelCoverage": round(covered_pixels / source_pixels, 4),
        "backgroundLeakRatio": round(background_alpha / total_alpha, 6),
        "outsideSupportAlphaRatio": round(outside_support_alpha / total_alpha, 6),
        "chromaArtifactRatio": round(
            restored_chroma_artifacts / source_chroma_artifacts,
            4,
        ),
        "lumaArtifactRatio": round(
            restored_luma_artifacts / source_luma_artifacts,
            4,
        ),
        "highResolutionEdgeGain": round(high_resolution_edge_gain, 4),
    }


def verify_source_texture_fidelity(metrics: dict[str, float | str]) -> None:
    if metrics["sourceAssetSha256"] != EXPECTED_SOURCE_SHA256:
        raise RuntimeError("V11 source asset no longer matches the approved V04 Grow")
    if float(metrics["roundTripMeanAbsoluteError"]) > 4:
        raise RuntimeError(f"V11 source round-trip drifted: {metrics}")
    if not 0.9 <= float(metrics["edgeEnergyRatio"]) <= 1.35:
        raise RuntimeError(f"V11 edge energy drifted: {metrics}")
    if not 0.85 <= float(metrics["textureEnergyRatio"]) <= 1.4:
        raise RuntimeError(f"V11 texture energy drifted: {metrics}")
    if float(metrics["sourcePixelCoverage"]) < 0.98:
        raise RuntimeError(f"V11 source-pixel coverage drifted: {metrics}")
    if float(metrics["backgroundLeakRatio"]) > 0.01:
        raise RuntimeError(f"V11 background leaked outside connector bounds: {metrics}")
    if float(metrics["outsideSupportAlphaRatio"]) > 0.01:
        raise RuntimeError(f"V11 alpha leaked outside source support: {metrics}")
    if float(metrics["chromaArtifactRatio"]) > 0.9:
        raise RuntimeError(f"V11 chroma blocking was not reduced: {metrics}")
    if float(metrics["lumaArtifactRatio"]) > 0.95:
        raise RuntimeError(f"V11 luma blocking was not reduced: {metrics}")
    if not 1.4 <= float(metrics["highResolutionEdgeGain"]) <= 2:
        raise RuntimeError(f"V11 high-resolution edge gain drifted: {metrics}")


def build() -> tuple[
    Image.Image,
    Image.Image,
    Image.Image,
    Image.Image,
    Image.Image,
    dict,
]:
    reference = extract_approved_source_pixels()
    source_mask = derive_connector_mask_from_reference(reference)
    reconstructed = reconstruct_source_pixel_pyramid(reference, source_mask)
    fitted = fit_source_pixels_to_v06_anchors(reconstructed)
    master = Image.open(V06_MASTER).convert("RGBA").crop(MASTER_CROP)
    master.alpha_composite(fitted, TARGET_BOX[:2])
    metrics = measure_source_fidelity(reference, source_mask, reconstructed)
    verify_source_texture_fidelity(metrics)
    if master.size != (1518, 900):
        raise RuntimeError(f"Unexpected V11 master size: {master.size}")
    return reference, source_mask, reconstructed, fitted, master, metrics


def main() -> None:
    reference, source_mask, reconstructed, fitted, master, metrics = build()
    V11_ARTWORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    reference.save(
        V11_ARTWORK / "grow-v11-approved-source-pixels.png",
        format="PNG",
        optimize=True,
    )
    source_mask.save(
        V11_ARTWORK / "grow-v11-source-mask.png",
        format="PNG",
        optimize=True,
    )
    reconstructed.save(
        V11_ARTWORK / "grow-v11-reconstructed-4x.png",
        format="PNG",
        optimize=True,
    )
    fitted.save(
        V11_ARTWORK / "grow-v11-fitted-connector.png",
        format="PNG",
        optimize=True,
    )
    master.save(
        V11_ARTWORK / "grow-v11-desktop-master.png",
        format="PNG",
        optimize=True,
    )
    (V11_ARTWORK / "grow-v11-source-fidelity.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    output_height = round(master.height * OUTPUT_WIDTH / master.width)
    master.resize((OUTPUT_WIDTH, output_height), Image.Resampling.LANCZOS).save(
        OUTPUT / f"grow-v11-desktop-{OUTPUT_WIDTH}.webp",
        format="WEBP",
        quality=96,
        method=6,
    )


if __name__ == "__main__":
    main()
