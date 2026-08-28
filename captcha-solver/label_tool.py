"""Label tool gán nhãn captcha qua trình duyệt — chỉ dùng Python stdlib + Pillow.

Chạy:
    python label_tool.py --dataset <thu_muc_anh> --out data/labels.csv [--port 8641]

Mở http://localhost:8641:
- Mỗi ảnh unique (dedupe theo hash kênh alpha) hiển thị upscale x8 (nền trắng, chữ đen).
- Ảnh trùng hash không hiển thị.
- Ô input pre-fill từ labels.csv nếu đã có; viền đỏ nếu label lệch format.
- Nút "Save all" POST /save ghi toàn bộ nhãn xuống labels.csv (UTF-8).

Format nhãn mong muốn: `<1-2 chữ số>Đ<từ tiếng Việt thường>` (VD: 1Đnai, 7Đbông).
"""
from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.captcha_io import alpha_sha256, list_dataset_images, load_alpha_binary  # noqa: E402
from src.denoise import remove_isolated_noise  # noqa: E402

LABEL_RE = re.compile(r"^[0-9]{1,2}Đ[a-zà-ỹđ]+$")
RENDER_SCALE = 8


def render_b64(arr: np.ndarray, scale: int = RENDER_SCALE) -> str:
    """Render mảng binary (đã denoise) thành PNG base64: nền trắng, chữ đen."""
    den = remove_isolated_noise(arr)
    binimg = np.where(den > 0, 0, 255).astype(np.uint8)
    im = Image.fromarray(binimg, mode="L").resize(
        (arr.shape[1] * scale, arr.shape[0] * scale), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


class LabelState:
    """Trạng thái phiên labeling: danh sách ảnh unique + nhãn hiện có."""

    def __init__(self, dataset_dir: Path, out_csv: Path):
        self.dataset_dir = dataset_dir
        self.out_csv = out_csv
        self.items: list[dict] = []
        self._load()

    def _load_existing_labels(self) -> dict[str, str]:
        existing: dict[str, str] = {}
        if self.out_csv.exists():
            with open(self.out_csv, newline="", encoding="utf-8") as f:
                for row in csv.reader(f):
                    if len(row) == 2 and row[0] != "filename":
                        existing[row[0]] = row[1]
        return existing

    def _load(self) -> None:
        existing = self._load_existing_labels()
        seen: set[str] = set()
        for p in list_dataset_images(self.dataset_dir):
            arr = load_alpha_binary(p)
            digest = alpha_sha256(arr)
            if digest in seen:
                continue
            seen.add(digest)
            self.items.append({
                "file": p.name,
                "b64": render_b64(arr),
                "existing": existing.get(p.name, ""),
            })

    def save(self, rows: list[dict]) -> int:
        """Ghi danh sách {filename,label} vào CSV. Trả về số dòng đã ghi."""
        self.out_csv.parent.mkdir(parents=True, exist_ok=True)
        cleaned = [(r["filename"].strip(), r["label"].strip()) for r in rows
                   if r.get("filename") and r.get("label")]
        with open(self.out_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["filename", "label"])
            writer.writerows(sorted(cleaned))
        return len(cleaned)

    def to_json(self) -> str:
        return json.dumps({"items": self.items}, ensure_ascii=False)

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Avatar Captcha Label Tool</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 24px; background: #f5f5f5; }
  h1 { font-size: 20px; }
  .item { background: #fff; border: 1px solid #ddd; border-radius: 8px;
          padding: 12px; margin-bottom: 14px; display: flex; align-items: center;
          gap: 16px; }
  .item img { image-rendering: pixelated; border: 1px solid #eee; }
  .meta { flex: 1; }
  .file { font-size: 12px; color: #666; margin-bottom: 6px; }
  input.label { font-size: 18px; padding: 6px 10px; width: 220px;
                border: 2px solid #ccc; border-radius: 6px; }
  input.label.bad { border-color: #e53935; background: #ffebee; }
  input.label.good { border-color: #43a047; }
  #toolbar { position: sticky; top: 0; background: #f5f5f5; padding: 10px 0;
             z-index: 10; }
  button { font-size: 16px; padding: 10px 22px; border: 0; border-radius: 6px;
           background: #1e88e5; color: #fff; cursor: pointer; }
  button:disabled { background: #999; }
  #status { margin-left: 12px; font-size: 14px; }
</style>
</head>
<body>
<h1>Avatar Captcha Label Tool — __COUNT__ ảnh unique</h1>
<div id="toolbar">
  <button id="save">Save all</button>
  <span id="status"></span>
</div>
<div id="list"></div>
<script>
const PATTERN = __PATTERN__;
const items = __ITEMS__.items;
const list = document.getElementById('list');
items.forEach(it => {
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = `<img src="data:image/png;base64,${it.b64}">
    <div class="meta">
      <div class="file">${it.file}</div>
      <input class="label" data-file="${it.file}" value="${it.existing}"
             placeholder="VD: 1Dnai">
    </div>`;
  list.appendChild(div);
});
function validate() {
  document.querySelectorAll('input.label').forEach(inp => {
    inp.classList.remove('good', 'bad');
    if (inp.value.trim() === '') return;
    inp.classList.add(PATTERN.test(inp.value.trim()) ? 'good' : 'bad');
  });
}
document.addEventListener('input', validate);
validate();
document.getElementById('save').onclick = async () => {
  const btn = document.getElementById('save');
  const status = document.getElementById('status');
  const rows = [...document.querySelectorAll('input.label')]
    .filter(inp => inp.value.trim() !== '')
    .map(inp => ({filename: inp.dataset.file, label: inp.value.trim()}));
  if (rows.length === 0) { status.textContent = 'Chưa có nhãn nào.'; return; }
  btn.disabled = true; status.textContent = 'Đang lưu...';
  try {
    const res = await fetch('/save', {method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(rows)});
    const data = await res.json();
    status.textContent = `Đã lưu ${data.saved} nhãn vào labels.csv OK`;
  } catch (e) { status.textContent = 'Lỗi: ' + e; }
  btn.disabled = false;
};
</script>
</body>
</html>"""

STATE: LabelState | None = None


class LabelHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # đỡ spam console
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/":
            self._send(404, b"not found", "text/plain")
            return
        assert STATE is not None
        page = (PAGE_TEMPLATE
                .replace("__COUNT__", str(len(STATE.items)))
                .replace("__PATTERN__", json.dumps(LABEL_RE.pattern))
                .replace("__ITEMS__", STATE.to_json()))
        self._send(200, page.encode("utf-8"), "text/html; charset=utf-8")

    def do_POST(self) -> None:
        if self.path != "/save":
            self._send(404, b"not found", "text/plain")
            return
        assert STATE is not None
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        saved = STATE.save(payload)
        body = json.dumps({"saved": saved}).encode()
        self._send(200, body, "application/json")


def main() -> None:
    global STATE
    parser = argparse.ArgumentParser(description="Avatar captcha label tool")
    parser.add_argument("--dataset", required=True, help="Thư mục captcha PNG")
    parser.add_argument("--out", default="captcha-solver/data/labels.csv")
    parser.add_argument("--port", type=int, default=8641)
    args = parser.parse_args()

    STATE = LabelState(Path(args.dataset), Path(args.out))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), LabelHandler)
    print(f"Label tool: {len(STATE.items)} ảnh unique")
    print(f"Mở http://localhost:{args.port} — Ctrl+C để thoát")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã thoát.")


if __name__ == "__main__":
    main()
