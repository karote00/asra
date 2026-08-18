from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


REPO_ROOT = Path(__file__).resolve().parents[3]
REFERENCE = (
    REPO_ROOT
    / "docs"
    / "ai"
    / "framework"
    / "website"
    / "asyra-landing-v04-approved.png"
)
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "illustrations"

# Coordinates are measured directly against the immutable 864 x 1821 V04
# authority. Each box intentionally retains the original measurement grid,
# embedded labels, shadows, and surrounding surface plate.
CROPS = {
    "hero-core-v04": ((440, 70, 850, 435), (960, 1536, 2400)),
    "domain-rail-v04": ((0, 610, 864, 745), (1280, 2048, 3200)),
    "grow-v04": ((58, 785, 408, 1005), (720, 1280, 1920)),
    "same-path-v04": ((385, 1015, 830, 1235), (720, 1280, 1920)),
    "one-source-v04": ((55, 1230, 415, 1435), (720, 1280, 1920)),
    "visible-change-v04": ((335, 1435, 835, 1635), (720, 1280, 1920)),
    "closing-core-v04": ((385, 1640, 555, 1760), (480, 960, 1440)),
}


def feather_light_plate(asset: Image.Image) -> Image.Image:
    width, height = asset.size
    edge = max(6, round(width * 0.015))
    mask = Image.new("L", asset.size, 0)
    ImageDraw.Draw(mask).rectangle(
        (edge, edge, width - edge - 1, height - edge - 1), fill=255
    )
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, edge / 2)))
    result = asset.convert("RGBA")
    result.putalpha(mask)
    return result


def restore_v04_edges(crop: Image.Image) -> Image.Image:
    """Restore edge contrast lost when V04 was approved as an 864px review image."""

    return crop.filter(ImageFilter.UnsharpMask(radius=1.15, percent=185, threshold=2))


def main() -> None:
    reference = Image.open(REFERENCE).convert("RGB")
    if reference.size != (864, 1821):
        raise RuntimeError(f"Unexpected V04 dimensions: {reference.size}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    expected = {
        f"{name}-{width}.webp"
        for name, (_, widths) in CROPS.items()
        for width in widths
    }
    for existing in OUTPUT.glob("*.webp"):
        if existing.name not in expected:
            existing.unlink()

    for name, (box, widths) in CROPS.items():
        crop = restore_v04_edges(reference.crop(box))
        for width in widths:
            height = round(crop.height * width / crop.width)
            asset = crop.resize((width, height), Image.Resampling.LANCZOS)
            asset = asset.filter(
                ImageFilter.UnsharpMask(radius=0.85, percent=115, threshold=1)
            )
            if name not in {"domain-rail-v04", "closing-core-v04"}:
                asset = feather_light_plate(asset)
            asset.save(
                OUTPUT / f"{name}-{width}.webp",
                format="WEBP",
                lossless=True,
                method=6,
            )


if __name__ == "__main__":
    main()
