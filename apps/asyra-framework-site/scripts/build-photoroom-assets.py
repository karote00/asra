from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


SITE_ROOT = Path(__file__).resolve().parents[1]
ARTWORK = SITE_ROOT / "artwork" / "photoroom"
PUBLIC = SITE_ROOT / "public" / "illustrations"


@dataclass(frozen=True)
class AssetSpec:
    name: str
    source: str
    widths: tuple[int, ...]


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


def build_asset(spec: AssetSpec) -> None:
    source_path = ARTWORK / spec.source
    source = Image.open(source_path).convert("RGBA")
    assert_true_alpha(source, spec.source)

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
