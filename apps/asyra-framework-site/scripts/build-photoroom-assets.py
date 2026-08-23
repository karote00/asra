from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


SITE_ROOT = Path(__file__).resolve().parents[1]
ARTWORK = SITE_ROOT / "artwork" / "photoroom"
PUBLIC = SITE_ROOT / "public" / "illustrations"
ONE_SOURCE_FONT_PATH = Path(
    "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
)
ONE_SOURCE_LABEL_SIZE = 28
ONE_SOURCE_LABEL_COLOR = (255, 255, 255, 255)
ONE_SOURCE_LABEL_EDITS = (
    ("3D VIEW", "3D", (273, 84)),
    ("LIST VIEW", "LIST", (273, 469)),
    ("DETAIL VIEW", "DETAIL", (1260, 469)),
)


@dataclass(frozen=True)
class AssetSpec:
    name: str
    source: str
    widths: tuple[int, ...]
    crop: tuple[int, int, int, int] | None = None


SPECS = (
    AssetSpec(
        "hero-core-v08-desktop-photoroom",
        "hero-core-v08-desktop-master-Photoroom.png",
        (720, 1080, 1400),
    ),
    AssetSpec(
        "domain-rail-v08-desktop-photoroom",
        "domain-rail-v08-desktop-master-Photoroom.png",
        (800, 1600, 2400),
    ),
    AssetSpec(
        "domain-rail-v08-desktop-photoroom-row-1",
        "domain-rail-v08-desktop-master-Photoroom.png",
        (800, 1200),
        (0, 0, 1200, 325),
    ),
    AssetSpec(
        "domain-rail-v08-desktop-photoroom-row-2",
        "domain-rail-v08-desktop-master-Photoroom.png",
        (800, 1200),
        (1200, 0, 2400, 325),
    ),
    AssetSpec(
        "grow-photoroom",
        "grow-master-Photoroom.png",
        (720, 1200, 1518),
    ),
    AssetSpec(
        "same-path-photoroom",
        "same-path-master-Photoroom.png",
        (720, 1280, 1774),
    ),
    AssetSpec(
        "one-source-v08-desktop-photoroom",
        "one-source-v08-desktop-master-Photoroom.png",
        (720, 1280, 1536),
    ),
    AssetSpec(
        "closing-core-v09-photoroom",
        "closing-core-v09-master-Photoroom.png",
        (960, 1280, 1536),
    ),
)


def premultiplied_resize(image: Image.Image, width: int) -> Image.Image:
    if image.width == width:
        return image.copy()

    height = round(image.height * width / image.width)
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    alpha = rgba[:, :, 3:4] / 255.0
    premultiplied = np.concatenate((rgba[:, :, :3] * alpha, rgba[:, :, 3:4]), axis=2)
    resized = Image.fromarray(
        np.clip(np.round(premultiplied), 0, 255).astype(np.uint8)
    ).resize((width, height), Image.Resampling.LANCZOS)

    resized_array = np.asarray(resized, dtype=np.float32)
    resized_alpha = resized_array[:, :, 3:4]
    rgb = np.zeros_like(resized_array[:, :, :3])
    np.divide(
        resized_array[:, :, :3] * 255.0,
        resized_alpha,
        out=rgb,
        where=resized_alpha > 0,
    )
    output = np.concatenate((np.clip(rgb, 0, 255), resized_alpha), axis=2)
    return Image.fromarray(np.round(output).astype(np.uint8))


def assert_true_alpha(image: Image.Image, label: str) -> None:
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    if int(alpha.min()) != 0 or int(alpha.max()) != 255:
        raise RuntimeError(f"{label} must contain transparent and opaque pixels")
    if float(np.count_nonzero(alpha == 0)) / alpha.size < 0.05:
        raise RuntimeError(f"{label} does not contain enough transparent background")


def assert_changes_within_regions(
    before: Image.Image,
    after: Image.Image,
    regions: tuple[tuple[int, int, int, int], ...],
) -> None:
    before_rgba = np.asarray(before.convert("RGBA"), dtype=np.uint8)
    after_rgba = np.asarray(after.convert("RGBA"), dtype=np.uint8)
    changed = np.any(before_rgba != after_rgba, axis=2)
    allowed = np.zeros(changed.shape, dtype=bool)
    for left, top, right, bottom in regions:
        allowed[top:bottom, left:right] = True

    if np.any(changed & ~allowed):
        raise RuntimeError("One Source label edit changed pixels outside label regions")
    if not np.any(changed):
        raise RuntimeError("One Source label edit did not change any pixels")
    if not np.array_equal(before_rgba[:, :, 3], after_rgba[:, :, 3]):
        raise RuntimeError("One Source label edit changed the alpha channel")


def replace_one_source_labels(source: Image.Image) -> Image.Image:
    result = source.convert("RGBA").copy()
    if not ONE_SOURCE_FONT_PATH.exists():
        raise RuntimeError(f"Missing One Source label font: {ONE_SOURCE_FONT_PATH}")
    label_font = ImageFont.truetype(
        ONE_SOURCE_FONT_PATH,
        size=ONE_SOURCE_LABEL_SIZE,
    )
    regions: list[tuple[int, int, int, int]] = []

    for current_label, next_label, center in ONE_SOURCE_LABEL_EDITS:
        measure = ImageDraw.Draw(result)
        left, top, right, bottom = measure.textbbox(
            center,
            current_label,
            font=label_font,
            anchor="mm",
        )
        label_region = (left - 5, top - 5, right + 5, bottom + 5)
        regions.append(label_region)

        source_region = result.crop(label_region)
        source_pixels = np.asarray(source_region.convert("RGBA"), dtype=np.uint8)
        bright_text = np.min(source_pixels[:, :, :3], axis=2) >= 145
        label_mask = Image.fromarray(bright_text.astype(np.uint8) * 255).filter(
            ImageFilter.MaxFilter(5)
        )
        clean_background = source_region.filter(ImageFilter.MedianFilter(31))
        result.paste(
            clean_background,
            label_region[:2],
            label_mask.filter(ImageFilter.GaussianBlur(0.7)),
        )

    draw = ImageDraw.Draw(result)
    for _, next_label, center in ONE_SOURCE_LABEL_EDITS:
        draw.text(
            center,
            next_label,
            fill=ONE_SOURCE_LABEL_COLOR,
            font=label_font,
            anchor="mm",
        )

    assert_changes_within_regions(source, result, tuple(regions))
    return result


def build_asset(spec: AssetSpec) -> None:
    source_path = (ARTWORK / spec.source).resolve()
    source = Image.open(source_path).convert("RGBA")
    assert_true_alpha(source, spec.source)
    if spec.name == "one-source-v08-desktop-photoroom":
        source = replace_one_source_labels(source)
    if spec.crop is not None:
        source = source.crop(spec.crop)
        assert_true_alpha(source, f"{spec.source} crop {spec.crop}")

    for width in spec.widths:
        if width > source.width:
            raise RuntimeError(
                f"Requested width {width} exceeds {spec.source} width {source.width}"
            )
        output = premultiplied_resize(source, width)
        output_path = PUBLIC / f"{spec.name}-{width}.webp"
        output.save(
            output_path,
            format="WEBP",
            lossless=True,
            method=6,
            exact=True,
        )
        decoded = Image.open(output_path).convert("RGBA")
        assert_true_alpha(decoded, output_path.name)
        print(f"wrote {output_path.relative_to(SITE_ROOT)} {decoded.size}")


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for spec in SPECS:
        build_asset(spec)


if __name__ == "__main__":
    main()
