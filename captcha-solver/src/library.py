"""Xây thư viện font glyph từ các nhóm ảnh cùng nhãn bằng majority-vote.

Ý tưởng cốt lõi: captcha dùng font bitmap cố định (glyph = khối pixel bất biến).
Nhiễu là pixel ngẫu nhiên KHÔNG lặp lại giữa các lần render. Do đó với một nhóm
ảnh cùng chuỗi ký tự:
- Vote đa số theo pixel => bitmap chữ SẠCH hoàn toàn (nhiễu bị loại).
- Tách glyph trên bitmap sạch theo cột trống => template chính xác từng ký tự.
- DP matching với thư viện glyph => auto-label mọi ảnh + đo độ khớp (mismatch).

char map (tên ký tự) gán theo nhãn người đọc; bitmap identity mới là chìa khóa.
"""
from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

from src.captcha_io import list_dataset_images, load_alpha_binary
from src.denoise import remove_isolated_noise


def group_by_label(labels: dict[str, str]) -> dict[str, list[str]]:
    """Nhóm tên file theo nhãn giống nhau."""
    groups: dict[str, list[str]] = defaultdict(list)
    for name, lab in labels.items():
        groups[lab].append(name)
    return dict(groups)


def majority_bitmap(members: list[np.ndarray],
                    threshold: float = 0.5) -> tuple[np.ndarray, float]:
    """Vote pixel trong nhóm ảnh cùng chuỗi → bitmap sạch.

    Returns:
        (bitmap sạch 0/1 cùng shape, chỉ số nhất quán 0..1)
    """
    stack = np.stack(members).astype(np.float32)
    mean = stack.mean(axis=0)
    clean = (mean >= threshold).astype(np.uint8)
    dists = [float(np.abs(m - clean).sum()) for m in members]
    consistency = 1.0 - float(np.mean(dists)) / max(1, int(clean.sum()))
    return clean, consistency


def segment_clean(clean: np.ndarray, min_width: int = 1) -> list[np.ndarray]:
    """Tách glyph trên bitmap sạch theo cột trống (vertical projection)."""
    col = clean.sum(axis=0)
    glyphs: list[np.ndarray] = []
    start: int | None = None
    for x in range(len(col)):
        if col[x] > 0 and start is None:
            start = x
        elif col[x] == 0 and start is not None:
            if x - start >= min_width:
                glyphs.append(clean[:, start:x].copy())
            start = None
    if start is not None and len(col) - start >= min_width:
        glyphs.append(clean[:, start:].copy())
    return glyphs


def bitmap_hash(glyph: np.ndarray) -> str:
    """Hash bitmap glyph (bao gồm shape)."""
    payload = glyph.tobytes() + f"{glyph.shape}".encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def glyph_to_rows(glyph: np.ndarray) -> list[str]:
    """Mảng binary → list chuỗi '0101...' dạng JSON-safe."""
    return ["".join(str(int(v)) for v in row) for row in glyph]


def rows_to_glyph(rows: list[str]) -> np.ndarray:
    """Chuỗi JSON → mảng binary uint8."""
    h = len(rows)
    w = len(rows[0]) if h else 0
    arr = np.zeros((h, w), dtype=np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '1':
                arr[y, x] = 1
    return arr


def build_font_library(dataset_dir: str | Path, labels: dict[str, str],
                       min_group: int = 2) -> dict:
    """Xây thư viện glyph từ các nhóm ảnh đủ số lượng.

    Returns:
        {
          "glyphs": {hash: {"char": ch, "w": w, "h": h, "rows": [...]}, ...},
          "group_stats": [...],
        }
    """
    files = {p.name: p for p in list_dataset_images(dataset_dir)}
    groups = group_by_label(labels)
    glyphs: dict[str, dict] = {}
    group_stats: list[dict] = []

    for label, names in sorted(groups.items()):
        arrs = [remove_isolated_noise(load_alpha_binary(files[n])) for n in names
                if n in files]
        if len(arrs) < min_group:
            group_stats.append({"label": label, "n": len(arrs), "status": "too_few"})
            continue
        clean, consistency = majority_bitmap(arrs)
        seg = segment_clean(clean)
        status = "ok" if len(seg) == len(label) else "mismatch"
        if status == "ok":
            for glyph, ch in zip(seg, label):
                hsh = bitmap_hash(glyph)
                if hsh not in glyphs:
                    glyphs[hsh] = {"char": ch, "w": int(glyph.shape[1]),
                                   "h": int(glyph.shape[0]), "rows": glyph_to_rows(glyph)}
                elif glyphs[hsh]["char"] != ch:
                    # cùng bitmap 2 char khác nhau — nhãn sai, cảnh báo
                    glyphs[hsh]["conflict"] = sorted(
                        {glyphs[hsh]["char"], ch})
                    glyphs[hsh]["char"] = "?"
        group_stats.append({"label": label, "n": len(arrs), "status": status,
                            "n_glyphs": len(seg),
                            "consistency": round(consistency, 4)})

    return {"glyphs": glyphs, "group_stats": group_stats}
def rows_to_arr(rows: list[str]) -> np.ndarray:
    """Chuỗi JSON → mảng binary uint8."""
    h = len(rows)
    w = len(rows[0]) if h else 0
    arr = np.zeros((h, w), dtype=np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '1':
                arr[y, x] = 1
    return arr


def load_library(path: str | Path) -> dict:
    """Đọc library JSON."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def glyph_lookup(lib: dict) -> dict[str, np.ndarray]:
    """{hash: mảng glyph}."""
    return {h: rows_to_arr(g["rows"]) for h, g in lib["glyphs"].items()}


def match_cost(patch: np.ndarray, glyph: np.ndarray) -> float:
    """XOR patch vs glyph, thử mọi dịch dọc, chuẩn hóa theo pixel chữ glyph."""
    h1, w1 = patch.shape
    h2, w2 = glyph.shape
    if w1 != w2:
        return float("inf")
    best = float("inf")
    for dy in range(-(h2 - h1) + 1, (h1 - h2) + 1):
        top_g = max(0, dy)
        bot_g = min(h2, h1 + dy)
        top_p = max(0, -dy)
        bot_p = int(min(h1, h2 - dy))
        if bot_g - top_g <= 0 or bot_p - top_p <= 0:
            continue
        g = glyph[top_g:bot_g, :]
        p = patch[top_p:bot_p, :]
        cost = int(np.abs(p - g).sum())
        best = min(best, cost / max(1, int(g.sum())))
    return best if best != float("inf") else float("inf")


def decode_dp(den: np.ndarray, lib: dict,
              gap_cost: float = 0.2) -> tuple[str, float, list[str]]:
    """Giải mã ảnh đã denoise thành chuỗi bằng DP khớp glyph.

    Returns:
        (label, normalized_cost, [glyph_hashes]).
        cost = tổng chi phí khớp / số glyph; cao => khả năng đọc sai.
    """
    lookup = glyph_lookup(lib)
    hash2char = {h: g["char"] for h, g in lib["glyphs"].items()}
    glyph_by_w: dict[int, list[np.ndarray]] = defaultdict(list)
    for h, g in lookup.items():
        glyph_by_w[g.shape[1]].append(g)
    widths = sorted(glyph_by_w.keys())
    W = den.shape[1]
    INF = float("inf")

    cost = [INF] * (W + 1)
    prev = [None] * (W + 1)
    glyph_idx = [None] * (W + 1)
    cost[0] = 0.0

    for x in range(W + 1):
        if cost[x] == INF:
            continue
        for w in widths:
            x2 = x + w
            if x2 > W:
                continue
            patch = den[:, x:x2]
            best_c, best_g = INF, None
            for g in glyph_by_w[w]:
                c = match_cost(patch, g)
                if c < best_c:
                    best_c, best_g = c, g
            if best_g is not None and best_c != INF:
                total = cost[x] + best_c
                if total < cost[x2]:
                    cost[x2] = total
                    prev[x2] = x
                    glyph_idx[x2] = best_g

    if cost[W] == INF:
        return "", INF, []

    path: list[np.ndarray] = []
    x = W
    while x > 0:
        path.append(glyph_idx[x])
        x = prev[x]
    path.reverse()

    label = "".join(hash2char.get(bitmap_hash(g2), "?") for g2 in path)
    norm = cost[W] / max(1, len(path))
    return label, norm, [bitmap_hash(g2) for g2 in path]


def dump_glyphs(lib: dict, cols: int = 4) -> str:
    """Render toàn bộ glyph dạng ASCII để review tên ký tự."""
    items = sorted(lib["glyphs"].items(), key=lambda kv: (kv[1]["char"]))
    out: list[str] = []
    for i in range(0, len(items), cols):
        row_items = items[i:i + cols]
        blocks = []
        for h, g in row_items:
            lines = []
            lines.append(f"  {g['char']!r} w={g['w']} {h[:8]}")
            for r in g["rows"]:
                lines.append("   " + r.replace("1", "#").replace("0", "."))
            blocks.append(lines)
        maxh = max(len(b) for b in blocks)
        for k in range(maxh):
            out.append("   ".join(b[k] if k < len(b) else " " * 12 for b in blocks))
        out.append("")
    return "\n".join(out)


def build_library_from_file(dataset_dir: str | Path, labels_csv: str | Path,
                            out_json: str | Path, min_group: int = 2) -> dict:
    """Đọc labels.csv → build font library → ghi JSON.

    Returns:
        Dict kết quả (library + stats).
    """
    labels: dict[str, str] = {}
    with open(labels_csv, newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) == 2 and row[0] != "filename" and row[1].strip():
                labels[row[0]] = row[1].strip()
    lib = build_font_library(dataset_dir, labels, min_group)
    out_json = Path(out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, indent=1)
    return lib


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Font library builder")
    sub = parser.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="Build library từ labels.csv")
    b.add_argument("--dataset", required=True)
    b.add_argument("--labels", required=True)
    b.add_argument("--out", required=True)
    b.add_argument("--min-group", type=int, default=2)

    d = sub.add_parser("dump", help="In ASCII glyphs để review")
    d.add_argument("--lib", required=True)

    c = sub.add_parser("decode", help="Giải mã 1 ảnh bằng DP")
    c.add_argument("--lib", required=True)
    c.add_argument("--image", required=True)

    args = parser.parse_args()

    if args.cmd == "build":
        lib = build_library_from_file(args.dataset, args.labels, args.out,
                                      args.min_group)
        stats = lib["group_stats"]
        ok = sum(1 for s in stats if s["status"] == "ok")
        print(f"Groups: {len(stats)}, ok={ok}, "
              f"glyphs={len(lib['glyphs'])}")
        for s in stats:
            if s["status"] != "ok":
                print(f"  {s['label']} ({s['n']} imgs) -> {s['status']}"
                      f"{' n_glyphs='+str(s['n_glyphs']) if 'n_glyphs' in s else ''}")
        chars = sorted({g["char"] for g in lib["glyphs"].values()
                        if g["char"] != "?"})
        print("Charset:", "".join(chars))
        print("Saved:", args.out)

    elif args.cmd == "dump":
        lib = load_library(args.lib)
        print(dump_glyphs(lib))

    elif args.cmd == "decode":
        lib = load_library(args.lib)
        den = remove_isolated_noise(load_alpha_binary(args.image))
        label, cost, hashes = decode_dp(den, lib)
        print(f"Image: {Path(args.image).name}")
        print(f"Decoded: {label!r}  (norm_cost={cost:.3f})")
        if cost > 0.5:
            print("(!) Chi phí cao — kết quả có thể sai.")


if __name__ == "__main__":
    main()