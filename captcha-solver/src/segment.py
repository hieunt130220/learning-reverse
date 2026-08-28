"""Wrapper module cho plan cũ (`python -m src.segment`).

Toàn bộ logic font-library / DP-matching nằm trong `src.library`.
"""
from __future__ import annotations

from src.library import (  # noqa: F401
    bitmap_hash,
    build_font_library,
    build_library_from_file,
    decode_dp,
    dump_glyphs,
    glyph_lookup,
    glyph_to_rows,
    load_library,
    majority_bitmap,
    match_cost,
    rows_to_glyph,
    segment_clean,
)

from src.library import main

if __name__ == "__main__":
    main()