#!/usr/bin/env python3
"""Build border-free PoC storyboard split crops from one reviewed preview."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


EXPECTED_SOURCE_SIZE = (1774, 887)
HORIZONTAL_BORDER_INSET = 6
VERTICAL_BORDER_INSET = 2
PANEL_BOUNDS = {
    "01": (84, 470),
    "02": (487, 875),
    "03": (895, 1281),
    "04": (1302, 1688),
}
TRADITIONAL_Y = (197, 426)
ASYRA_Y = (428, 649)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "illustrations",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.source).convert("RGB")
    if source.size != EXPECTED_SOURCE_SIZE:
        raise ValueError(
            f"Expected source size {EXPECTED_SOURCE_SIZE}, received {source.size}"
        )

    args.output.mkdir(parents=True, exist_ok=True)
    for stage, (left, right) in PANEL_BOUNDS.items():
        for path_name, (top, bottom) in (
            ("traditional", TRADITIONAL_Y),
            ("asyra", ASYRA_Y),
        ):
            crop = source.crop(
                (
                    left + HORIZONTAL_BORDER_INSET,
                    top + VERTICAL_BORDER_INSET,
                    right - HORIZONTAL_BORDER_INSET,
                    bottom - VERTICAL_BORDER_INSET,
                )
            )
            destination = (
                args.output / f"poc-storyboard-stage-{stage}-{path_name}.png"
            )
            crop.save(destination, optimize=True)
            print(f"{destination.name}: {crop.width}x{crop.height}")


if __name__ == "__main__":
    main()
