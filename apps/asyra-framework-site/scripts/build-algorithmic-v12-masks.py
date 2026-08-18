from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage


SITE_ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = SITE_ROOT / "scripts" / "build-transparent-v12-assets.py"
MASK_ROOT = SITE_ROOT / "artwork" / "v12-transparent" / "algorithmic-masks"

SEED_THRESHOLDS = {
    "hero-core-v12": 5.0,
    "hero-core-v12-desktop": 5.0,
    "grow-v12": 5.0,
    "same-path-v12": 5.0,
    "one-source-v12": 5.0,
    "one-source-v12-desktop": 5.0,
}


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


def retain_seeded_components(
    candidate: np.ndarray,
    sure_foreground: np.ndarray,
) -> np.ndarray:
    labels, count = ndimage.label(candidate)
    if count == 0:
        raise RuntimeError("GrabCut returned no foreground components")
    keep = np.zeros(count + 1, dtype=bool)
    keep[np.unique(labels[sure_foreground])] = True
    keep[0] = False
    return keep[labels]


def build_mask(module, spec) -> None:
    source = module.load_source(spec)
    rgb = np.asarray(source.convert("RGB"), dtype=np.uint8)
    background = module.estimate_background(rgb.astype(np.float32))
    colour_distance = np.sqrt(
        np.sum((rgb.astype(np.float32) - background) ** 2, axis=2)
    )
    manual_core = module.geometry_foreground(
        source,
        spec,
        colour_distance,
        rgb.astype(np.float32),
        include_shadow=False,
    )

    support = ndimage.binary_dilation(manual_core, structure=module.disk(28))
    sure_foreground = manual_core & (
        colour_distance >= SEED_THRESHOLDS[spec.name]
    )
    sure_foreground = ndimage.binary_closing(
        sure_foreground,
        structure=module.disk(1),
    )
    sure_foreground = module.retain_large_components(sure_foreground, 6)

    grabcut_mask = np.full(manual_core.shape, cv2.GC_PR_BGD, dtype=np.uint8)
    grabcut_mask[~support] = cv2.GC_BGD
    grabcut_mask[manual_core] = cv2.GC_PR_FGD
    grabcut_mask[sure_foreground] = cv2.GC_FGD

    background_model = np.zeros((1, 65), dtype=np.float64)
    foreground_model = np.zeros((1, 65), dtype=np.float64)
    cv2.grabCut(
        cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR),
        grabcut_mask,
        None,
        background_model,
        foreground_model,
        8,
        cv2.GC_INIT_WITH_MASK,
    )
    candidate = np.isin(grabcut_mask, (cv2.GC_FGD, cv2.GC_PR_FGD))
    candidate |= sure_foreground
    candidate = retain_seeded_components(candidate, sure_foreground)
    candidate &= ndimage.binary_dilation(
        manual_core,
        structure=module.disk(3),
    )
    candidate = ndimage.binary_closing(candidate, structure=module.disk(1))
    candidate = module.fill_small_holes(candidate, 96)

    MASK_ROOT.mkdir(parents=True, exist_ok=True)
    output = MASK_ROOT / f"{spec.name}-grabcut.png"
    Image.fromarray(candidate.astype(np.uint8) * 255).save(
        output,
        format="PNG",
        optimize=True,
    )
    print(
        f"{spec.name}: foreground={np.mean(candidate):.1%}, "
        f"sure={np.mean(sure_foreground):.1%}"
    )


def main() -> None:
    module = load_builder()
    selected = [
        spec for spec in module.SPECS if spec.name in SEED_THRESHOLDS
    ]
    if len(selected) != len(SEED_THRESHOLDS):
        raise RuntimeError("Missing an algorithmic mask specification")
    for spec in selected:
        build_mask(module, spec)


if __name__ == "__main__":
    main()
