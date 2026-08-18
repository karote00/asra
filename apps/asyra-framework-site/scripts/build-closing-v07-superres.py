#!/usr/bin/env python3
"""Reconstruct the approved v04 closing illustration with Real-ESRGAN.

The low-resolution v04 crop remains the geometry source. Real-ESRGAN restores
surface and edge detail without replacing the composition with a new render.
"""

from __future__ import annotations

import argparse
from collections.abc import Callable
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.nn import functional as F


class ResidualDenseBlock(nn.Module):
    def __init__(self, features: int = 64, growth: int = 32) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(features, growth, 3, 1, 1)
        self.conv2 = nn.Conv2d(features + growth, growth, 3, 1, 1)
        self.conv3 = nn.Conv2d(features + growth * 2, growth, 3, 1, 1)
        self.conv4 = nn.Conv2d(features + growth * 3, growth, 3, 1, 1)
        self.conv5 = nn.Conv2d(features + growth * 4, features, 3, 1, 1)
        self.activation = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, source: torch.Tensor) -> torch.Tensor:
        feature1 = self.activation(self.conv1(source))
        feature2 = self.activation(self.conv2(torch.cat((source, feature1), 1)))
        feature3 = self.activation(
            self.conv3(torch.cat((source, feature1, feature2), 1))
        )
        feature4 = self.activation(
            self.conv4(torch.cat((source, feature1, feature2, feature3), 1))
        )
        feature5 = self.conv5(
            torch.cat((source, feature1, feature2, feature3, feature4), 1)
        )
        return source + feature5 * 0.2


class RRDB(nn.Module):
    def __init__(self, features: int = 64, growth: int = 32) -> None:
        super().__init__()
        self.rdb1 = ResidualDenseBlock(features, growth)
        self.rdb2 = ResidualDenseBlock(features, growth)
        self.rdb3 = ResidualDenseBlock(features, growth)

    def forward(self, source: torch.Tensor) -> torch.Tensor:
        feature = self.rdb3(self.rdb2(self.rdb1(source)))
        return source + feature * 0.2


def make_layer(factory: Callable[[], nn.Module], count: int) -> nn.Sequential:
    return nn.Sequential(*(factory() for _ in range(count)))


class RRDBNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        features = 64
        self.conv_first = nn.Conv2d(3, features, 3, 1, 1)
        self.body = make_layer(lambda: RRDB(features, 32), 23)
        self.conv_body = nn.Conv2d(features, features, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(features, features, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(features, features, 3, 1, 1)
        self.conv_hr = nn.Conv2d(features, features, 3, 1, 1)
        self.conv_last = nn.Conv2d(features, 3, 3, 1, 1)
        self.activation = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, source: torch.Tensor) -> torch.Tensor:
        feature = self.conv_first(source)
        body_feature = self.conv_body(self.body(feature))
        feature = feature + body_feature
        feature = self.activation(
            self.conv_up1(F.interpolate(feature, scale_factor=2, mode="nearest"))
        )
        feature = self.activation(
            self.conv_up2(F.interpolate(feature, scale_factor=2, mode="nearest"))
        )
        return self.conv_last(self.activation(self.conv_hr(feature)))


def load_model(weights_path: Path, device: torch.device) -> RRDBNet:
    checkpoint = torch.load(weights_path, map_location="cpu", weights_only=True)
    parameters = checkpoint.get("params_ema", checkpoint.get("params", checkpoint))
    model = RRDBNet()
    model.load_state_dict(parameters, strict=True)
    model.eval().to(device)
    return model


def restore_tile(
    model: RRDBNet, source: np.ndarray, device: torch.device
) -> np.ndarray:
    tensor = (
        torch.from_numpy(source.copy())
        .permute(2, 0, 1)
        .unsqueeze(0)
        .to(device=device, dtype=torch.float32)
        / 255.0
    )
    with torch.inference_mode():
        restored = model(tensor).clamp_(0, 1)
    return (
        restored.squeeze(0)
        .permute(1, 2, 0)
        .mul(255.0)
        .round()
        .to(torch.uint8)
        .cpu()
        .numpy()
    )


def restore_image(
    model: RRDBNet,
    source: np.ndarray,
    device: torch.device,
    tile_size: int,
    overlap: int,
) -> np.ndarray:
    scale = 4
    height, width, _ = source.shape
    restored = np.empty((height * scale, width * scale, 3), dtype=np.uint8)

    for top in range(0, height, tile_size):
        bottom = min(top + tile_size, height)
        for left in range(0, width, tile_size):
            right = min(left + tile_size, width)
            padded_top = max(0, top - overlap)
            padded_bottom = min(height, bottom + overlap)
            padded_left = max(0, left - overlap)
            padded_right = min(width, right + overlap)

            tile = source[padded_top:padded_bottom, padded_left:padded_right]
            tile_restored = restore_tile(model, tile, device)

            crop_top = (top - padded_top) * scale
            crop_bottom = crop_top + (bottom - top) * scale
            crop_left = (left - padded_left) * scale
            crop_right = crop_left + (right - left) * scale
            restored[
                top * scale : bottom * scale,
                left * scale : right * scale,
            ] = tile_restored[crop_top:crop_bottom, crop_left:crop_right]

    return restored


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--public-dir", type=Path, required=True)
    parser.add_argument("--tile-size", type=int, default=256)
    parser.add_argument("--overlap", type=int, default=24)
    args = parser.parse_args()

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    source_image = Image.open(args.input).convert("RGB")
    source = np.asarray(source_image)
    model = load_model(args.weights, device)
    restored = Image.fromarray(
        restore_image(model, source, device, args.tile_size, args.overlap)
    )

    args.master.parent.mkdir(parents=True, exist_ok=True)
    args.public_dir.mkdir(parents=True, exist_ok=True)
    restored.save(args.master, optimize=True)

    for width in (960, 1440, 2880):
        height = round(restored.height * width / restored.width)
        web_image = restored.resize((width, height), Image.Resampling.LANCZOS)
        web_image.save(
            args.public_dir / f"closing-core-v07-{width}.webp",
            "WEBP",
            quality=94,
            method=6,
        )

    print(
        f"restored {source_image.width}x{source_image.height} -> "
        f"{restored.width}x{restored.height} on {device.type}"
    )


if __name__ == "__main__":
    main()
