#!/usr/bin/env python3
"""Build the landing-owned derivative of the canonical Asyra Design proof."""

from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image


SITE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SITE_ROOT.parents[1]
SOURCE = REPO_ROOT / "docs/public/assets/asyra-design-7076-product-evidence.jpg"
OUTPUT = (
    SITE_ROOT
    / "public/product-evidence/asyra-design-7076-product-evidence.webp"
)
SOURCE_SHA256 = "bb9903dd93dbdf7a5ae4220bea223bfa35ad1748ca1e42752622354545e2e470"


def main() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise RuntimeError(f"Unexpected product evidence source hash: {digest}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as image:
        if image.size != (1280, 720):
            raise RuntimeError(f"Unexpected product evidence dimensions: {image.size}")
        image.save(OUTPUT, "WEBP", quality=86, method=6)


if __name__ == "__main__":
    main()
