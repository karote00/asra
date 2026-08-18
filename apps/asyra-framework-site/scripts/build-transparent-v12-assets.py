from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from scipy import ndimage


SITE_ROOT = Path(__file__).resolve().parents[1]
PUBLIC = SITE_ROOT / "public" / "illustrations"
ARTWORK = SITE_ROOT / "artwork" / "v12-transparent"
ONE_SOURCE_FONT = Path(
    "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
)
ONE_SOURCE_LABELS = (
    ((273, 84), (273, 113), "3D VIEW"),
    ((1260, 84), (1260, 113), "ANALYTICS"),
    ((273, 469), (273, 499), "LIST VIEW"),
    ((1260, 469), (1260, 499), "DETAIL VIEW"),
)
ONE_SOURCE_PENDING_DIAGRAMS = (
    ((1165, 105, 1370, 260), 0.62),
    ((185, 495, 365, 630), 0.62),
)


@dataclass(frozen=True)
class AssetSpec:
    name: str
    source: Path
    widths: tuple[int, ...]
    background: str
    threshold: float
    minimum_component_area: int
    fill_all_holes: bool = False


SPECS = (
    AssetSpec(
        "hero-core-v12",
        PUBLIC / "hero-core-v06-1400.webp",
        (720, 1080, 1400),
        "light",
        6.0,
        180,
    ),
    AssetSpec(
        "hero-core-v12-desktop",
        PUBLIC / "hero-core-v08-desktop-1400.webp",
        (1400,),
        "light",
        6.0,
        180,
    ),
    AssetSpec(
        "domain-rail-v12",
        PUBLIC / "domain-rail-v06-4800.webp",
        (1600, 3200, 4800),
        "dark",
        40.0,
        120,
    ),
    AssetSpec(
        "domain-rail-v12-desktop",
        PUBLIC / "domain-rail-v08-desktop-4800.webp",
        (4800,),
        "dark",
        40.0,
        120,
    ),
    AssetSpec(
        "grow-v12",
        PUBLIC / "grow-v06-1500.webp",
        (720, 1200, 1500),
        "light",
        8.0,
        140,
    ),
    AssetSpec(
        "same-path-v12",
        PUBLIC / "same-path-v06-1774.webp",
        (720, 1280, 1774),
        "light",
        8.0,
        120,
    ),
    AssetSpec(
        "one-source-v12",
        PUBLIC / "one-source-v06-1536.webp",
        (720, 1280, 1536),
        "light",
        8.0,
        140,
    ),
    AssetSpec(
        "one-source-v12-desktop",
        PUBLIC / "one-source-v08-desktop-1536.webp",
        (1536,),
        "light",
        8.0,
        140,
    ),
    AssetSpec(
        "closing-core-v12",
        SITE_ROOT / "artwork" / "v09" / "closing-core-v09-master.png",
        (960, 1280, 1536),
        "dark",
        8.0,
        160,
        fill_all_holes=True,
    ),
)


def disk(radius: int) -> np.ndarray:
    axis = np.arange(-radius, radius + 1)
    yy, xx = np.meshgrid(axis, axis, indexing="ij")
    return xx * xx + yy * yy <= radius * radius


def estimate_background(rgb: np.ndarray) -> np.ndarray:
    sample_size = max(24, min(rgb.shape[:2]) // 18)
    corners = np.concatenate(
        (
            rgb[:sample_size, :sample_size].reshape(-1, 3),
            rgb[:sample_size, -sample_size:].reshape(-1, 3),
            rgb[-sample_size:, :sample_size].reshape(-1, 3),
            rgb[-sample_size:, -sample_size:].reshape(-1, 3),
        )
    )
    return np.median(corners, axis=0)


def retain_large_components(mask: np.ndarray, minimum_area: int) -> np.ndarray:
    labels, count = ndimage.label(mask)
    if count == 0:
        raise RuntimeError("Foreground extraction found no components")
    areas = np.bincount(labels.ravel())
    keep = areas >= minimum_area
    keep[0] = False
    return keep[labels]


def fill_small_holes(mask: np.ndarray, maximum_area: int) -> np.ndarray:
    filled = ndimage.binary_fill_holes(mask)
    holes = filled & ~mask
    labels, count = ndimage.label(holes)
    if count == 0:
        return mask
    areas = np.bincount(labels.ravel())
    keep = areas <= maximum_area
    keep[0] = False
    return mask | keep[labels]


def one_source_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if ONE_SOURCE_FONT.exists():
        return ImageFont.truetype(ONE_SOURCE_FONT, size=size)
    return ImageFont.load_default(size=size)


def scale_one_source_icon(
    image: Image.Image,
    box: tuple[int, int, int, int],
    scale: float,
) -> None:
    crop = image.crop(box).convert("RGBA")
    crop_rgb = np.asarray(crop.convert("RGB"), dtype=np.uint8)
    luminance = np.mean(crop_rgb.astype(np.float32), axis=2)
    candidate = luminance >= 100
    labels, count = ndimage.label(candidate)
    areas = np.bincount(labels.ravel())
    touches_edge = np.zeros(count + 1, dtype=bool)
    touches_edge[np.unique(labels[0, :])] = True
    touches_edge[np.unique(labels[-1, :])] = True
    touches_edge[np.unique(labels[:, 0])] = True
    touches_edge[np.unique(labels[:, -1])] = True
    keep = (areas >= 3) & ~touches_edge
    keep[0] = False
    mask_array = keep[labels]
    ys, xs = np.nonzero(mask_array)
    if xs.size == 0:
        raise RuntimeError(f"One Source icon mask is empty for {box}")
    bounds = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

    clearing_array = ndimage.binary_dilation(mask_array, structure=disk(4))
    repaired = crop_rgb.copy().astype(np.float32)
    observed = repaired.copy()
    observed[clearing_array] = np.nan
    for channel in range(3):
        plane = observed[:, :, channel]
        row = np.nanmedian(plane, axis=1)
        column = np.nanmedian(plane, axis=0)
        overall = np.nanmedian(plane)
        reconstruction = row[:, None] + column[None, :] - overall
        repaired[:, :, channel][clearing_array] = reconstruction[clearing_array]
    repaired = np.clip(np.round(repaired), 0, 255).astype(np.uint8)
    cleared = Image.fromarray(repaired).convert("RGBA")

    icon = crop.crop(bounds).copy()
    soft_alpha = np.clip((luminance - 62.0) / 48.0, 0.0, 1.0)
    soft_alpha *= ndimage.binary_dilation(mask_array, structure=disk(1))
    icon_mask = Image.fromarray(
        np.round(
            soft_alpha[bounds[1] : bounds[3], bounds[0] : bounds[2]] * 255
        ).astype(np.uint8)
    )
    icon.putalpha(icon_mask)
    scaled_size = (
        round(icon.width * scale),
        round(icon.height * scale),
    )
    scaled = premultiplied_resize(icon, scaled_size)
    center = ((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
    offset = (
        center[0] - scaled.width // 2,
        center[1] - scaled.height // 2,
    )
    cleared.alpha_composite(scaled, offset)
    image.paste(cleared, box[:2])


def erase_one_source_label(
    image: Image.Image,
    center: tuple[int, int],
    text: str,
) -> None:
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.text(center, text, font=one_source_font(28), fill=255, anchor="mm")
    mask_array = np.asarray(
        mask.filter(ImageFilter.MaxFilter(9)), dtype=np.uint8
    ) > 0
    ys, xs = np.nonzero(mask_array)
    padding = 12
    left = max(0, int(xs.min()) - padding)
    top = max(0, int(ys.min()) - padding)
    right = min(image.width, int(xs.max()) + padding + 1)
    bottom = min(image.height, int(ys.max()) + padding + 1)
    local_mask = mask_array[top:bottom, left:right]
    repaired = np.asarray(image.convert("RGB"))[top:bottom, left:right].astype(
        np.float32
    )
    observed = repaired.copy()
    observed[local_mask] = np.nan
    for channel in range(3):
        plane = observed[:, :, channel]
        row = np.nanmedian(plane, axis=1)
        column = np.nanmedian(plane, axis=0)
        overall = np.nanmedian(plane)
        reconstruction = row[:, None] + column[None, :] - overall
        repaired[:, :, channel][local_mask] = reconstruction[local_mask]
    repaired = np.clip(np.round(repaired), 0, 255).astype(np.uint8)
    image.paste(Image.fromarray(repaired), (left, top))


def correct_one_source_desktop_source(source: Image.Image) -> Image.Image:
    original = source.convert("RGB")
    corrected = source.convert("RGBA")
    for box, scale in ONE_SOURCE_PENDING_DIAGRAMS:
        scale_one_source_icon(corrected, box, scale)
    for old_center, _, text in ONE_SOURCE_LABELS:
        erase_one_source_label(corrected, old_center, text)
    draw = ImageDraw.Draw(corrected)
    for _, new_center, text in ONE_SOURCE_LABELS:
        draw.text(
            new_center,
            text,
            font=one_source_font(28),
            fill=(255, 255, 255),
            anchor="mm",
        )
    corrected_rgb = corrected.convert("RGB")
    verify_one_source_correction_scope(original, corrected_rgb)
    return corrected_rgb


def verify_one_source_correction_scope(
    original: Image.Image,
    corrected: Image.Image,
) -> None:
    difference = np.any(
        np.asarray(original, dtype=np.int16)
        != np.asarray(corrected, dtype=np.int16),
        axis=2,
    )
    allowed = np.zeros(difference.shape, dtype=bool)
    for (left, top, right, bottom), _ in ONE_SOURCE_PENDING_DIAGRAMS:
        allowed[top:bottom, left:right] = True
    scratch = ImageDraw.Draw(Image.new("L", original.size, 0))
    for old_center, new_center, text in ONE_SOURCE_LABELS:
        for center in (old_center, new_center):
            left, top, right, bottom = scratch.textbbox(
                center,
                text,
                font=one_source_font(28),
                anchor="mm",
            )
            allowed[
                max(0, top - 4) : min(original.height, bottom + 5),
                max(0, left - 4) : min(original.width, right + 5),
            ] = True
    unauthorized = difference & ~allowed
    if np.any(unauthorized):
        count = int(np.count_nonzero(unauthorized))
        raise RuntimeError(
            f"One Source correction changed {count} pixels outside six approved ROIs"
        )
    if int(np.count_nonzero(difference)) < 1_000:
        raise RuntimeError("One Source correction did not update the requested ROIs")


def load_source(spec: AssetSpec) -> Image.Image:
    source = Image.open(spec.source).convert("RGB")
    if spec.name == "one-source-v12-desktop":
        return correct_one_source_desktop_source(source)
    return source


def mask_canvas(size: tuple[int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("L", size, 0)
    return image, ImageDraw.Draw(image)


def strong_detail_in(
    distance: np.ndarray,
    support: Image.Image,
    threshold: float,
) -> np.ndarray:
    supported = np.asarray(support, dtype=np.uint8) > 0
    detail = distance >= threshold
    detail = ndimage.binary_dilation(detail, structure=disk(1))
    detail = ndimage.binary_closing(detail, structure=disk(2))
    return detail & supported


def mechanical_connector_detail_in(
    rgb: np.ndarray,
    support: Image.Image,
    chroma_threshold: float = 30.0,
) -> np.ndarray:
    """Keep connector hardware without retaining the source's cast shadows.

    The previous luminance ceiling (155) classified the soft grey-brown cast
    shadows below every module as hardware.  Real rails are either visibly
    coloured or nearly black; the detached shadows are neither.
    """
    supported = np.asarray(support, dtype=np.uint8) > 0
    maximum = np.max(rgb, axis=2)
    minimum = np.min(rgb, axis=2)
    chroma = maximum - minimum
    luminance = np.mean(rgb, axis=2)
    coloured = (chroma >= chroma_threshold) & supported
    # Keep only the near-black contour immediately attached to a coloured
    # rail.  A general dark-pixel allowance would bring the cast shadow back.
    near_coloured = ndimage.binary_dilation(coloured, structure=disk(2))
    detail = (coloured | ((luminance <= 85.0) & near_coloured)) & supported
    detail = ndimage.binary_dilation(detail, structure=disk(1))
    detail = ndimage.binary_closing(detail, structure=disk(2))
    detail = fill_small_holes(detail, 120)
    return detail & supported


def dark_detail_in(rgb: np.ndarray, support: Image.Image) -> np.ndarray:
    """Extract deliberate black labels/marks, excluding soft grey shadows."""
    supported = np.asarray(support, dtype=np.uint8) > 0
    luminance = np.mean(rgb, axis=2)
    detail = (luminance <= 82.0) & supported
    detail = ndimage.binary_dilation(detail, structure=disk(1))
    detail = ndimage.binary_closing(detail, structure=disk(1))
    return detail & supported


def local_paper_estimate(
    rgb: np.ndarray,
    core: np.ndarray,
    maximum_distance: float,
) -> np.ndarray:
    """Estimate only the paper hidden by the object and its existing shadow."""
    core = np.asarray(core, dtype=bool)
    distance = ndimage.distance_transform_edt(~core)
    expanded = distance <= maximum_distance
    nearest = ndimage.distance_transform_edt(
        expanded,
        return_distances=False,
        return_indices=True,
    )
    paper = rgb.astype(np.float32).copy()
    for channel in range(3):
        plane = paper[:, :, channel]
        plane[expanded] = rgb[:, :, channel][
            nearest[0][expanded], nearest[1][expanded]
        ]
        paper[:, :, channel] = ndimage.gaussian_filter(
            plane,
            sigma=max(10.0, maximum_distance / 3.0),
            mode="nearest",
        )
    return paper


def original_shadow_from_core(
    rgb: np.ndarray,
    core: np.ndarray,
    maximum_distance: float,
    darkness_margin: float = 8.0,
    minimum_area: int = 16,
) -> np.ndarray:
    """Select only the source-authored shadow immediately around an object.

    The object core is expanded solely to define a review radius. A smooth
    local paper estimate is sampled from outside that radius, then compared to
    the untouched source pixels. The returned mask never paints, blurs, or
    recolours the asset; it only exposes source pixels that are genuinely
    darker than their local paper background.
    """
    core = np.asarray(core, dtype=bool)
    distance = ndimage.distance_transform_edt(~core)
    expanded = distance <= maximum_distance
    review_region = expanded & ~core

    # Replace the object and its near-shadow review area with the nearest
    # untouched outer-paper sample, then smooth only that estimate. This
    # follows slow paper gradients without mistaking them for object shadow.
    paper = local_paper_estimate(rgb, core, maximum_distance)

    source_luminance = np.mean(rgb.astype(np.float32), axis=2)
    paper_luminance = np.mean(paper, axis=2)
    retained = (
        (paper_luminance - source_luminance >= darkness_margin)
        & review_region
    )
    retained = ndimage.binary_closing(retained, structure=disk(2))
    retained = retain_large_components(retained, minimum_area)
    retained = ndimage.binary_dilation(retained, structure=disk(1))
    return retained & review_region


def chamfered_boxes(
    size: tuple[int, int],
    boxes: tuple[tuple[int, int, int, int], ...],
    cuts: tuple[int, ...],
) -> np.ndarray:
    """Return exact hard silhouettes for solid chamfered modules."""
    mask, draw = mask_canvas(size)
    for (left, top, right, bottom), cut in zip(boxes, cuts):
        draw.polygon(
            (
                (left + cut, top),
                (right - cut, top),
                (right, top + cut),
                (right, bottom - cut),
                (right - cut, bottom),
                (left + cut, bottom),
                (left, bottom - cut),
                (left, top + cut),
            ),
            fill=255,
        )
    return np.asarray(mask, dtype=np.uint8) > 0


def enclosed_subject_in(
    distance: np.ndarray,
    support: Image.Image,
    threshold: float,
    minimum_area: int,
    close_radius: int = 3,
    maximum_hole_area: int = 800,
) -> np.ndarray:
    """Keep real object pixels and enclosed pale faces, never the support box."""
    supported = np.asarray(support, dtype=np.uint8) > 0
    subject = (distance >= threshold) & supported
    subject = ndimage.binary_closing(subject, structure=disk(close_radius))
    subject = retain_large_components(subject, minimum_area)
    subject = fill_small_holes(subject, maximum_hole_area) & supported
    subject = ndimage.binary_dilation(subject, structure=disk(1)) & supported
    return subject


def hero_geometry(
    size: tuple[int, int],
    distance: np.ndarray,
    rgb: np.ndarray,
    desktop: bool,
    include_shadow: bool = True,
) -> np.ndarray:
    width, height = size
    if (width, height) != (1400, 1254):
        raise RuntimeError(f"Unexpected Hero geometry: {size}")
    main_support, main_draw = mask_canvas(size)
    main_draw.polygon(
        (
            (286, 128),
            (1118, 128),
            (1174, 210),
            (1174, 976),
            (1108, 1043),
            (296, 1043),
            (226, 976),
            (226, 210),
        ),
        fill=255,
    )
    subject = enclosed_subject_in(
        distance,
        main_support,
        16.0,
        80,
        close_radius=4,
    )
    # Follow the actual five connector silhouettes while separately retaining
    # their source-authored shadows from the untouched pre-alpha master.
    connectors, connector_draw = mask_canvas(size)
    if desktop:
        connector_draw.ellipse((650, 42, 750, 138), fill=255)
        connector_draw.rounded_rectangle(
            (674, 118, 726, 170), radius=12, fill=255
        )
        connector_draw.ellipse((72, 510, 151, 594), fill=255)
        connector_draw.rounded_rectangle(
            (128, 536, 216, 574), radius=8, fill=255
        )
        connector_draw.ellipse((1223, 510, 1304, 594), fill=255)
        connector_draw.rounded_rectangle(
            (1178, 536, 1250, 574), radius=8, fill=255
        )
        connector_draw.ellipse((320, 1080, 397, 1170), fill=255)
        connector_draw.rounded_rectangle(
            (331, 1008, 384, 1113), radius=10, fill=255
        )
        connector_draw.ellipse((990, 1080, 1069, 1170), fill=255)
        connector_draw.rounded_rectangle(
            (1001, 1008, 1056, 1113), radius=10, fill=255
        )
    else:
        connector_draw.ellipse((657, 79, 743, 160), fill=255)
        connector_draw.rounded_rectangle(
            (679, 132, 721, 183), radius=10, fill=255
        )
        connector_draw.ellipse((163, 518, 232, 594), fill=255)
        connector_draw.rounded_rectangle(
            (216, 540, 304, 575), radius=8, fill=255
        )
        connector_draw.ellipse((1168, 518, 1237, 594), fill=255)
        connector_draw.rounded_rectangle(
            (1093, 540, 1182, 575), radius=8, fill=255
        )
        connector_draw.ellipse((399, 1028, 480, 1120), fill=255)
        connector_draw.rounded_rectangle(
            (409, 960, 470, 1055), radius=10, fill=255
        )
        connector_draw.ellipse((920, 1028, 1001, 1120), fill=255)
        connector_draw.rounded_rectangle(
            (931, 960, 991, 1055), radius=10, fill=255
        )
    solid, solid_draw = mask_canvas(size)
    solid_draw.rounded_rectangle((386, 178, 1014, 886), radius=72, fill=255)

    core = (
        subject
        | (np.asarray(connectors, dtype=np.uint8) > 0)
        | (np.asarray(solid, dtype=np.uint8) > 0)
    )
    if not include_shadow:
        return core
    original_shadow = original_shadow_from_core(
        rgb,
        core,
        maximum_distance=72.0,
        darkness_margin=7.0,
        minimum_area=18,
    )
    return core | original_shadow


def domain_geometry(
    size: tuple[int, int], distance: np.ndarray
) -> np.ndarray:
    width, height = size
    if (width, height) != (4800, 650):
        raise RuntimeError(f"Unexpected domain rail geometry: {size}")
    mask, draw = mask_canvas(size)
    for index in range(10):
        left = 300 + index * 425
        draw.rounded_rectangle(
            (left - 8, 70, left + 404, 632), radius=42, fill=255
        )
    rail_support, rail_draw = mask_canvas(size)
    rail_draw.rectangle((0, 168, width, 520), fill=255)
    cards = enclosed_subject_in(distance, mask, 48.0, 240, close_radius=3)
    rail = strong_detail_in(distance, rail_support, 16.0)
    rail = retain_large_components(rail, 80)
    return cards | rail


def grow_geometry(
    size: tuple[int, int],
    distance: np.ndarray,
    rgb: np.ndarray,
    include_shadow: bool = True,
) -> np.ndarray:
    width, height = size
    if (width, height) != (1500, 889):
        raise RuntimeError(f"Unexpected Grow geometry: {size}")
    mask, draw = mask_canvas(size)
    module_boxes = (
        (194, 74, 426, 330),
        (442, 74, 677, 330),
        (692, 74, 928, 330),
        (194, 326, 426, 588),
        (692, 326, 928, 588),
        (194, 584, 426, 821),
        (442, 584, 677, 821),
        (692, 584, 928, 821),
        (1135, 274, 1373, 608),
    )
    for box in module_boxes:
        draw.rounded_rectangle(box, radius=28, fill=255)
    draw.rounded_rectangle((112, 388, 218, 498), radius=50, fill=255)

    support, support_draw = mask_canvas(size)
    for start, end in (
        ((176, 322), (960, 322)),
        ((176, 582), (960, 582)),
        ((430, 250), (430, 670)),
        ((684, 250), (684, 670)),
        ((934, 250), (934, 670)),
        ((900, 420), (1165, 420)),
        ((900, 505), (1165, 505)),
        ((112, 443), (218, 443)),
    ):
        support_draw.line((start, end), fill=255, width=18)
    modules = chamfered_boxes(
        size,
        module_boxes,
        (18, 18, 18, 18, 18, 18, 18, 18, 24),
    )
    left_connector, left_connector_draw = mask_canvas(size)
    left_connector_draw.ellipse((118, 410, 183, 476), fill=255)
    modules |= np.asarray(left_connector, dtype=np.uint8) > 0
    connected_detail = mechanical_connector_detail_in(rgb, support)
    core = modules | connected_detail
    if not include_shadow:
        return core
    original_shadow = original_shadow_from_core(
        rgb,
        core,
        maximum_distance=56.0,
        darkness_margin=7.0,
        minimum_area=20,
    )
    return core | original_shadow


def same_path_geometry(
    size: tuple[int, int],
    distance: np.ndarray,
    rgb: np.ndarray,
    include_shadow: bool = True,
) -> np.ndarray:
    width, height = size
    if (width, height) != (1774, 740):
        raise RuntimeError(f"Unexpected Same path geometry: {size}")
    mask, draw = mask_canvas(size)
    module_boxes = (
        (146, 116, 337, 333),
        (146, 412, 337, 634),
        (507, 161, 622, 288),
        (507, 455, 622, 584),
        (778, 307, 876, 384),
        (778, 420, 876, 498),
        (944, 107, 1160, 633),
        (1253, 301, 1375, 434),
        (1472, 259, 1665, 488),
    )
    for box in module_boxes:
        draw.rounded_rectangle(box, radius=24, fill=255)

    support, support_draw = mask_canvas(size)
    support_draw.line(
        ((320, 245), (690, 245), (790, 350), (968, 350)),
        fill=255,
        width=20,
        joint="curve",
    )
    support_draw.line(
        ((320, 539), (690, 539), (790, 445), (968, 445)),
        fill=255,
        width=20,
        joint="curve",
    )
    support_draw.line(((1140, 394), (1495, 394)), fill=255, width=18)
    label_support, label_draw = mask_canvas(size)
    for box in (
        # Tight text-only supports deliberately stop before the blueprint
        # registration dots and crosses surrounding each label. Those marks
        # belong to the removable paper background, not to the illustration.
        (188, 38, 326, 78),
        (220, 344, 266, 382),
        (972, 36, 1140, 78),
        (1480, 214, 1648, 252),
    ):
        label_draw.rectangle(box, fill=255)
    solid, solid_draw = mask_canvas(size)
    for left, top, right, bottom in module_boxes:
        inset = 14 if right - left < 150 else 20
        solid_draw.rounded_rectangle(
            (left + inset, top + inset, right - inset, bottom - inset),
            radius=12,
            fill=255,
        )
    modules = enclosed_subject_in(distance, mask, 34.0, 70, close_radius=3)
    modules |= np.asarray(solid, dtype=np.uint8) > 0
    connected_detail = mechanical_connector_detail_in(
        rgb, support, chroma_threshold=18.0
    )
    labels = dark_detail_in(rgb, label_support)
    core = modules | connected_detail | labels
    if not include_shadow:
        return core
    original_shadow = original_shadow_from_core(
        rgb,
        core,
        maximum_distance=48.0,
        darkness_margin=7.0,
        minimum_area=18,
    )
    return core | original_shadow


def one_source_geometry(
    size: tuple[int, int],
    distance: np.ndarray,
    rgb: np.ndarray,
    include_shadow: bool = True,
) -> np.ndarray:
    width, height = size
    if (width, height) != (1536, 800):
        raise RuntimeError(f"Unexpected One source geometry: {size}")
    mask, draw = mask_canvas(size)
    module_boxes = (
        (132, 35, 417, 329),
        (1114, 35, 1402, 329),
        (132, 421, 417, 716),
        (1114, 421, 1402, 716),
        (548, 120, 990, 649),
    )
    for box in module_boxes:
        draw.rounded_rectangle(box, radius=30, fill=255)
    support, support_draw = mask_canvas(size)
    for start, end in (
        ((385, 184), (575, 184)),
        ((385, 561), (575, 561)),
        ((960, 184), (1150, 184)),
        ((960, 561), (1150, 561)),
    ):
        support_draw.line((start, end), fill=255, width=18)
    solid, solid_draw = mask_canvas(size)
    for left, top, right, bottom in module_boxes:
        inset = 18 if right - left < 320 else 26
        solid_draw.rounded_rectangle(
            (left + inset, top + inset, right - inset, bottom - inset),
            radius=18,
            fill=255,
        )
    modules = enclosed_subject_in(distance, mask, 34.0, 90, close_radius=3)
    modules |= np.asarray(solid, dtype=np.uint8) > 0
    connected_detail = mechanical_connector_detail_in(rgb, support)
    core = modules | connected_detail
    if not include_shadow:
        return core
    original_shadow = original_shadow_from_core(
        rgb,
        core,
        maximum_distance=52.0,
        darkness_margin=7.0,
        minimum_area=18,
    )
    return core | original_shadow


def closing_geometry(size: tuple[int, int], distance: np.ndarray) -> np.ndarray:
    width, height = size
    if (width, height) != (1536, 1024):
        raise RuntimeError(f"Unexpected closing geometry: {size}")
    mask, draw = mask_canvas(size)
    draw.polygon(
        (
            (276, 48),
            (445, 48),
            (486, 87),
            (1049, 87),
            (1090, 48),
            (1256, 48),
            (1270, 63),
            (1270, 958),
            (1255, 974),
            (1091, 974),
            (1052, 936),
            (484, 936),
            (445, 974),
            (277, 974),
            (262, 958),
            (262, 64),
        ),
        fill=255,
    )
    return enclosed_subject_in(
        distance,
        mask,
        30.0,
        100,
        close_radius=5,
        maximum_hole_area=150_000,
    )


def geometry_foreground(
    source: Image.Image,
    spec: AssetSpec,
    distance: np.ndarray,
    rgb: np.ndarray,
    include_shadow: bool = True,
) -> np.ndarray:
    if spec.name.startswith("hero-core"):
        return hero_geometry(
            source.size,
            distance,
            rgb,
            desktop=spec.name.endswith("desktop"),
            include_shadow=include_shadow,
        )
    if spec.name.startswith("domain-rail"):
        return domain_geometry(source.size, distance)
    if spec.name.startswith("grow"):
        return grow_geometry(
            source.size, distance, rgb, include_shadow=include_shadow
        )
    if spec.name.startswith("same-path"):
        return same_path_geometry(
            source.size, distance, rgb, include_shadow=include_shadow
        )
    if spec.name.startswith("one-source"):
        return one_source_geometry(
            source.size, distance, rgb, include_shadow=include_shadow
        )
    if spec.name.startswith("closing-core"):
        return closing_geometry(source.size, distance)
    raise RuntimeError(f"Missing geometry contract for {spec.name}")


def algorithmic_shadow_contract(
    spec: AssetSpec,
) -> tuple[float, float, float, int] | None:
    if spec.name.startswith("hero-core"):
        return (50.0, 8.0, 0.022, 120)
    if spec.name.startswith("grow"):
        return (46.0, 9.0, 0.025, 180)
    if spec.name.startswith("same-path"):
        return (42.0, 8.0, 0.022, 100)
    if spec.name.startswith("one-source"):
        return (45.0, 8.0, 0.022, 100)
    return None


def load_algorithmic_mask(spec: AssetSpec, size: tuple[int, int]) -> np.ndarray:
    path = ARTWORK / "algorithmic-masks" / f"{spec.name}-grabcut.png"
    if not path.exists():
        raise RuntimeError(f"Missing deterministic GrabCut mask: {path}")
    with Image.open(path) as image:
        mask = np.asarray(image.convert("L"), dtype=np.float32) / 255.0
    if mask.shape != (size[1], size[0]):
        raise RuntimeError(
            f"GrabCut mask changed dimensions for {spec.name}: {mask.shape}"
        )
    return mask


def source_shadow_plate(
    rgb: np.ndarray,
    object_alpha: np.ndarray,
    maximum_distance: float,
    source_blur: float,
    minimum_strength: float,
    minimum_area: int,
) -> np.ndarray:
    """Extract the source's broad, neutral contact shadow as alpha only.

    GrabCut supplies a deterministic object silhouette from per-image colour
    statistics and explicit foreground/background seeds. Low-pass separation
    then rejects the source paper's thin blueprint grid while retaining only
    broad darkening already present next to that silhouette. The returned
    plate is composited underneath the object; it never invents shadow geometry.
    """
    core = object_alpha >= 0.5
    distance = ndimage.distance_transform_edt(~core)
    expanded = distance <= maximum_distance
    paper = local_paper_estimate(rgb, core, maximum_distance)
    smooth_source = np.stack(
        [
            ndimage.gaussian_filter(
                rgb[:, :, channel], sigma=source_blur, mode="nearest"
            )
            for channel in range(3)
        ],
        axis=2,
    )
    ratio = np.mean(smooth_source / np.maximum(paper, 1.0), axis=2)
    strength = np.clip(1.0 - ratio, 0.0, 1.0)
    candidate = (
        (distance > 1.0)
        & expanded
        & (strength >= minimum_strength)
    )
    labels, count = ndimage.label(candidate)
    if count == 0:
        raise RuntimeError("Source shadow extraction found no components")
    areas = np.bincount(labels.ravel())
    near_subject = distance <= 6.0
    touches_subject = np.zeros(count + 1, dtype=bool)
    touches_subject[np.unique(labels[near_subject])] = True
    keep = (areas >= minimum_area) & touches_subject
    keep[0] = False
    candidate = keep[labels]
    strength *= candidate
    strength = ndimage.gaussian_filter(strength, sigma=1.2, mode="nearest")
    strength[~expanded] = 0.0
    strength[strength < (1.0 / 255.0)] = 0.0
    return np.clip(strength, 0.0, 0.65)


def extract_alpha(source: Image.Image, spec: AssetSpec) -> tuple[Image.Image, np.ndarray]:
    rgb_image = source.convert("RGB")
    rgb = np.asarray(rgb_image, dtype=np.float32)
    background = estimate_background(rgb)
    distance = np.sqrt(np.sum((rgb - background) ** 2, axis=2))

    manual_core = geometry_foreground(
        source,
        spec,
        distance,
        rgb,
        include_shadow=False,
    )
    contract = algorithmic_shadow_contract(spec)
    if contract is None:
        foreground = geometry_foreground(source, spec, distance, rgb)
        output_rgb = np.asarray(rgb_image, dtype=np.uint8).copy()
        output_alpha = np.where(foreground, 255, 0).astype(np.uint8)
        result = Image.fromarray(np.dstack((output_rgb, output_alpha)))
        return result, manual_core

    object_alpha = load_algorithmic_mask(spec, source.size)
    shadow_alpha = source_shadow_plate(rgb, object_alpha, *contract)
    combined_alpha = object_alpha + shadow_alpha * (1.0 - object_alpha)

    # The extracted source shadow is a neutral multiplicative plate underneath
    # the untouched object. Premultiplied composition keeps every opaque source
    # pixel byte-identical while giving the original shadow real transparency.
    output_rgb = np.zeros_like(rgb, dtype=np.float32)
    active = combined_alpha > 0.0
    output_rgb[active] = (
        rgb[active] * object_alpha[active, None]
    ) / combined_alpha[active, None]
    result = Image.fromarray(
        np.dstack(
            (
                np.clip(np.round(output_rgb), 0, 255).astype(np.uint8),
                np.round(combined_alpha * 255.0).astype(np.uint8),
            )
        )
    )
    opaque_core = object_alpha >= (254.0 / 255.0)
    return result, opaque_core


def premultiplied_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    if image.size == size:
        return image.copy()
    return image.convert("RGBa").resize(
        size, Image.Resampling.LANCZOS
    ).convert("RGBA")


def verify_lossless_subject(
    source: Image.Image,
    decoded: Image.Image,
    foreground: np.ndarray,
) -> None:
    source_rgb = np.asarray(source.convert("RGB"), dtype=np.int16)
    decoded_rgba = np.asarray(decoded.convert("RGBA"), dtype=np.int16)
    if decoded_rgba.shape[:2] != source_rgb.shape[:2]:
        raise RuntimeError("Decoded transparent asset changed dimensions")
    decoded_alpha = decoded_rgba[:, :, 3]
    if int(decoded_alpha[foreground].min()) < 250:
        raise RuntimeError("A retained subject pixel lost opacity")
    difference = np.abs(decoded_rgba[:, :, :3] - source_rgb)
    maximum_difference = int(difference[foreground].max())
    if maximum_difference != 0:
        raise RuntimeError(
            f"Retained subject RGB drifted by {maximum_difference} levels"
        )
    corner_alpha = (
        decoded_alpha[0, 0],
        decoded_alpha[0, -1],
        decoded_alpha[-1, 0],
        decoded_alpha[-1, -1],
    )
    if max(corner_alpha) > 2:
        raise RuntimeError(f"Background corner is not transparent: {corner_alpha}")
    transparent_fraction = float(np.mean(decoded_alpha <= 2))
    if transparent_fraction < 0.12:
        raise RuntimeError(
            f"Only {transparent_fraction:.1%} of the canvas is transparent"
        )


def build(spec: AssetSpec) -> None:
    source = load_source(spec)
    master, foreground = extract_alpha(source, spec)
    ARTWORK.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    master.save(
        ARTWORK / f"{spec.name}-master.png",
        format="PNG",
        optimize=True,
    )

    for width in spec.widths:
        height = round(source.height * width / source.width)
        asset = premultiplied_resize(master, (width, height))
        output = PUBLIC / f"{spec.name}-{width}.webp"
        asset.save(output, format="WEBP", lossless=True, method=6, exact=True)
        if width == source.width:
            with Image.open(output) as decoded:
                verify_lossless_subject(source, decoded, foreground)
    print(
        f"{spec.name}: source={spec.source.name}, "
        f"size={source.width}x{source.height}, alpha=verified"
    )


def main() -> None:
    for spec in SPECS:
        build(spec)


if __name__ == "__main__":
    main()
