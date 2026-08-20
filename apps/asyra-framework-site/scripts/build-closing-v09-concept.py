from hashlib import sha256
from pathlib import Path

from PIL import Image


APP_ROOT = Path(__file__).resolve().parents[1]
MASTER = APP_ROOT / "artwork" / "v09" / "closing-core-v09-master.png"
OUTPUT = APP_ROOT / "public" / "illustrations"
EXPECTED_MASTER_HASH = (
    "c9b7d0eb316dda45277f0219c29aa4874089d214dd84ee52ac753850b9135ff7"
)
WIDTHS = (960, 1280, 1536)


def main() -> None:
    master_bytes = MASTER.read_bytes()
    actual_hash = sha256(master_bytes).hexdigest()
    if actual_hash != EXPECTED_MASTER_HASH:
        raise RuntimeError(
            "Unexpected closing V09 master hash: "
            f"expected {EXPECTED_MASTER_HASH}, received {actual_hash}"
        )

    master = Image.open(MASTER).convert("RGB")
    if master.size != (1536, 1024):
        raise RuntimeError(f"Unexpected closing V09 dimensions: {master.size}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for width in WIDTHS:
        height = round(master.height * width / master.width)
        asset = master
        if width != master.width:
            asset = master.resize((width, height), Image.Resampling.LANCZOS)
        asset.save(
            OUTPUT / f"closing-core-v09-{width}.webp",
            format="WEBP",
            lossless=True,
            method=6,
        )


if __name__ == "__main__":
    main()
