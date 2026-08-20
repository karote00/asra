from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


SITE_ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = SITE_ROOT / "scripts" / "build-transparent-v12-assets.py"
REPORT_ROOT = SITE_ROOT / "test-results" / "transparent-v12-audit"


def load_builder():
    specification = importlib.util.spec_from_file_location(
        "transparent_v12_builder", BUILDER_PATH
    )
    if specification is None or specification.loader is None:
        raise RuntimeError("Unable to load transparent V12 builder")
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


def checkerboard(size: tuple[int, int], square: int = 28) -> Image.Image:
    width, height = size
    result = Image.new("RGB", size, (232, 232, 232))
    draw = ImageDraw.Draw(result)
    for top in range(0, height, square):
        for left in range(0, width, square):
            if (left // square + top // square) % 2:
                draw.rectangle(
                    (left, top, left + square - 1, top + square - 1),
                    fill=(198, 198, 198),
                )
    return result


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    result.alpha_composite(
        copy,
        ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2),
    )
    return result


def icon_bounds(
    image: Image.Image,
    box: tuple[int, int, int, int],
    ndimage,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    rgb = np.asarray(image.convert("RGB"))[top:bottom, left:right]
    candidate = np.mean(rgb.astype(np.float32), axis=2) >= 100
    labels, _ = ndimage.label(candidate)
    areas = np.bincount(labels.ravel())
    keep = areas >= 8
    keep[0] = False
    ys, xs = np.nonzero(keep[labels])
    if xs.size == 0:
        raise RuntimeError(f"One Source icon is empty in {box}")
    return (
        left + int(xs.min()),
        top + int(ys.min()),
        left + int(xs.max()) + 1,
        top + int(ys.max()) + 1,
    )


def verify_one_source_desktop_geometry(module, corrected: Image.Image) -> None:
    card_tops = (46, 46, 430, 430)
    for card_top, (old_center, new_center, text) in zip(
        card_tops, module.ONE_SOURCE_LABELS
    ):
        font = module.one_source_font(28)
        old_top = ImageDraw.Draw(Image.new("L", (1, 1))).textbbox(
            old_center, text, font=font, anchor="mm"
        )[1]
        new_top = ImageDraw.Draw(Image.new("L", (1, 1))).textbbox(
            new_center, text, font=font, anchor="mm"
        )[1]
        old_gap = old_top - card_top
        new_gap = new_top - card_top
        if new_gap != old_gap * 2:
            raise RuntimeError(
                f"{text} top gap is {new_gap}px; expected exactly {old_gap * 2}px"
            )

    regions = {
        "3D VIEW": (190, 120, 350, 250),
        "ANALYTICS": (1165, 130, 1370, 260),
        "LIST VIEW": (185, 520, 365, 630),
        "DETAIL VIEW": (1180, 510, 1360, 650),
    }
    bounds = {
        name: icon_bounds(corrected, box, module.ndimage)
        for name, box in regions.items()
    }
    spans = {
        name: max(right - left, bottom - top)
        for name, (left, top, right, bottom) in bounds.items()
    }
    baseline_min = min(spans["3D VIEW"], spans["DETAIL VIEW"])
    baseline_max = max(spans["3D VIEW"], spans["DETAIL VIEW"])
    for name in ("ANALYTICS", "LIST VIEW"):
        if not round(baseline_min * 0.8) <= spans[name] <= round(
            baseline_max * 1.1
        ):
            raise RuntimeError(
                f"{name} visual span {spans[name]}px is outside the "
                f"{baseline_min}-{baseline_max}px baseline range"
            )

    original = Image.open(
        SITE_ROOT / "public" / "illustrations" / "one-source-v08-desktop-1536.webp"
    ).convert("RGB")
    original_regions = {
        "ANALYTICS": module.ONE_SOURCE_PENDING_DIAGRAMS[0][0],
        "LIST VIEW": module.ONE_SOURCE_PENDING_DIAGRAMS[1][0],
    }
    for name in ("ANALYTICS", "LIST VIEW"):
        original_bounds = icon_bounds(
            original, original_regions[name], module.ndimage
        )
        corrected_bounds = bounds[name]
        original_center = (
            (original_bounds[0] + original_bounds[2]) / 2,
            (original_bounds[1] + original_bounds[3]) / 2,
        )
        corrected_center = (
            (corrected_bounds[0] + corrected_bounds[2]) / 2,
            (corrected_bounds[1] + corrected_bounds[3]) / 2,
        )
        if max(
            abs(original_center[0] - corrected_center[0]),
            abs(original_center[1] - corrected_center[1]),
        ) > 1.5:
            raise RuntimeError(f"{name} moved away from its original center")


def verify_and_render(module, spec) -> None:
    source = module.load_source(spec)
    if spec.name == "one-source-v12-desktop":
        verify_one_source_desktop_geometry(module, source)
    output_path = (
        SITE_ROOT
        / "public"
        / "illustrations"
        / f"{spec.name}-{source.width}.webp"
    )
    transparent = Image.open(output_path).convert("RGBA")
    if transparent.size != source.size:
        raise RuntimeError(f"{spec.name} changed dimensions")

    source_rgb = np.asarray(source, dtype=np.int16)
    transparent_rgba = np.asarray(transparent, dtype=np.int16)
    alpha = transparent_rgba[:, :, 3]
    expected, opaque_core = module.extract_alpha(source, spec)
    expected_rgba = np.asarray(expected, dtype=np.int16)
    expected_foreground = expected_rgba[:, :, 3] > 2
    maximum_pipeline_difference = int(
        np.abs(transparent_rgba - expected_rgba).max()
    )
    maximum_subject_difference = int(
        np.abs(transparent_rgba[:, :, :3] - source_rgb)[opaque_core].max()
    )
    minimum_subject_alpha = int(alpha[opaque_core].min())
    maximum_background_alpha = int(alpha[~expected_foreground].max())
    soft_alpha_fraction = float(np.mean((alpha > 2) & (alpha < 250)))
    transparent_fraction = float(np.mean(alpha <= 2))
    if (
        maximum_pipeline_difference != 0
        or maximum_subject_difference != 0
        or minimum_subject_alpha < 250
        or maximum_background_alpha > 2
    ):
        raise RuntimeError(
            f"{spec.name} failed subject preservation: "
            f"pipeline={maximum_pipeline_difference}, "
            f"subject-rgb={maximum_subject_difference}, "
            f"subject-alpha={minimum_subject_alpha}, "
            f"background-alpha={maximum_background_alpha}"
        )

    panel_size = (720, 430)
    source_panel = contain(source.convert("RGBA"), panel_size)
    transparent_panel = contain(transparent, panel_size)
    checker_panel = checkerboard(panel_size).convert("RGBA")
    checker_panel.alpha_composite(transparent_panel)
    section_color = (13, 19, 17) if spec.background == "dark" else (241, 234, 227)
    section_panel = Image.new("RGBA", panel_size, (*section_color, 255))
    section_panel.alpha_composite(transparent_panel)

    full_section = Image.new("RGBA", transparent.size, (*section_color, 255))
    full_section.alpha_composite(transparent)

    header = 72
    report = Image.new(
        "RGB", (panel_size[0] * 3, panel_size[1] + header), (247, 247, 247)
    )
    report.paste(source_panel.convert("RGB"), (0, header))
    report.paste(checker_panel.convert("RGB"), (panel_size[0], header))
    report.paste(section_panel.convert("RGB"), (panel_size[0] * 2, header))
    draw = ImageDraw.Draw(report)
    font = ImageFont.load_default(size=20)
    for index, label in enumerate(
        ("CURRENT SOURCE", "TRUE ALPHA", "SECTION BACKGROUND")
    ):
        draw.text((index * panel_size[0] + 24, 18), label, fill=(12, 12, 12), font=font)
    draw.text(
        (24, 46),
        (
            f"{spec.name} | subject RGB max diff: {maximum_subject_difference} | "
            f"min alpha: {minimum_subject_alpha} | "
            f"soft alpha: {soft_alpha_fraction:.1%} | "
            f"transparent: {transparent_fraction:.1%}"
        ),
        fill=(62, 62, 62),
        font=ImageFont.load_default(size=14),
    )
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    report.save(REPORT_ROOT / f"{spec.name}.png", optimize=True)
    source.save(REPORT_ROOT / f"{spec.name}-source-full.png", optimize=True)
    full_section.convert("RGB").save(
        REPORT_ROOT / f"{spec.name}-section-full.png",
        optimize=True,
    )
    print(
        f"{spec.name}: rgb-diff={maximum_subject_difference}, "
        f"subject-alpha={minimum_subject_alpha}, "
        f"soft-alpha={soft_alpha_fraction:.1%}, "
        f"transparent={transparent_fraction:.1%}"
    )


def main() -> None:
    module = load_builder()
    for spec in module.SPECS:
        verify_and_render(module, spec)


if __name__ == "__main__":
    main()
