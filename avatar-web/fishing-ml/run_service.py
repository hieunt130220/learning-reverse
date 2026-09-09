#!/usr/bin/env python3
"""Production PM2 runner for fishing-ml inference service."""
import sys
from pathlib import Path

# Đảm bảo src/ nằm trong sys.path độc lập với việc đã pip install -e hay chưa
root_dir = Path(__file__).resolve().parent
src_dir = root_dir / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fishing_ml.inference_service import main

if __name__ == "__main__":
    default_frozen = (
        root_dir
        / "artifacts"
        / "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"
        / "frozen"
    )
    if "--frozen-dir" not in sys.argv:
        sys.argv.extend(["--frozen-dir", str(default_frozen)])
    sys.exit(main())
