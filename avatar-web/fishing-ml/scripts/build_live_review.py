#!/usr/bin/env python3
"""Build a standalone manual-review report from a live fishing capture."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import sys
from pathlib import Path
from typing import Sequence

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json_object(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def encode_verified_png(path: Path, expected_sha256: str) -> str:
    if not path.is_file() or path.read_bytes()[:8] != PNG_SIGNATURE:
        raise ValueError(f"missing or invalid PNG: {path}")
    if sha256_file(path) != expected_sha256.lower():
        raise ValueError(f"PNG checksum mismatch: {path}")
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def required_int(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    return value


def required_number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a number")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{label} must be finite")
    return result


def safe_child(root: Path, relative: str) -> Path:
    if not relative or Path(relative).is_absolute():
        raise ValueError(f"unsafe relative path: {relative}")
    candidate = (root / relative).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"path escapes session: {relative}")
    return candidate


def build_payload(manifest_path: Path) -> dict[str, object]:
    manifest_path = manifest_path.resolve()
    manifest = read_json_object(manifest_path)
    if manifest.get("schemaVersion") != 1:
        raise ValueError("manifest must use schemaVersion 1")
    session_id = manifest.get("sessionId")
    if not isinstance(session_id, str) or not session_id.startswith("live-review-"):
        raise ValueError("invalid sessionId")
    batches_value = manifest.get("batches")
    if not isinstance(batches_value, list) or not 1 <= len(batches_value) <= 100:
        raise ValueError("manifest must contain 1–100 batches")
    session_root = manifest_path.parent.resolve()
    seen_batches: set[str] = set()
    model_ids: set[str] = set()
    embedded: list[dict[str, object]] = []
    total_queries = accepted_count = 0

    def batch_key(item: object) -> tuple[str, str]:
        return (str(item.get("capturedAt", "")), str(item.get("batchId", ""))) if isinstance(item, dict) else ("", "")

    for item in sorted(batches_value, key=batch_key):
        if not isinstance(item, dict):
            raise ValueError("batch record must be an object")
        batch_id = item.get("batchId")
        relative_prediction = item.get("predictionPath")
        if not isinstance(batch_id, str) or not batch_id.startswith("live-") or batch_id in seen_batches:
            raise ValueError("invalid or duplicate batchId")
        if not isinstance(relative_prediction, str):
            raise ValueError(f"missing predictionPath: {batch_id}")
        seen_batches.add(batch_id)
        prediction_path = safe_child(session_root, relative_prediction)
        document = read_json_object(prediction_path)
        if document.get("schemaVersion") != 1 or document.get("batchId") != batch_id:
            raise ValueError(f"prediction identity mismatch: {batch_id}")
        files = document.get("files")
        refs_value = document.get("images")
        queries_value = document.get("imagesNew")
        inference = document.get("inference")
        if not isinstance(files, dict) or not isinstance(refs_value, list) or len(refs_value) != 6:
            raise ValueError(f"invalid reference metadata: {batch_id}")
        if not isinstance(queries_value, list) or not 1 <= len(queries_value) <= 255 or not isinstance(inference, dict):
            raise ValueError(f"invalid query/inference metadata: {batch_id}")
        if inference.get("status") != "ok" or not isinstance(inference.get("modelId"), str):
            raise ValueError(f"batch has no successful inference: {batch_id}")
        model_id = str(inference["modelId"])
        model_ids.add(model_id)
        batch_root = prediction_path.parent.resolve()

        def load_images(entries: list[object], expected_count: int | None) -> list[dict[str, object]]:
            output: list[dict[str, object]] = []
            indexes: set[int] = set()
            for entry in entries:
                if not isinstance(entry, dict):
                    raise ValueError(f"invalid image entry: {batch_id}")
                index = required_int(entry.get("index"), "image index")
                relative = entry.get("path")
                if not isinstance(relative, str) or index in indexes or not isinstance(files.get(relative), str):
                    raise ValueError(f"invalid image metadata: {batch_id}")
                indexes.add(index)
                output.append({"index": index, "src": encode_verified_png(safe_child(batch_root, relative), str(files[relative]))})
            if indexes != set(range(expected_count if expected_count is not None else len(entries))):
                raise ValueError(f"image indexes are not contiguous: {batch_id}")
            return sorted(output, key=lambda row: int(row["index"]))

        references = load_images(refs_value, 6)
        query_images = {int(row["index"]): str(row["src"]) for row in load_images(queries_value, None)}
        predictions = inference.get("predictions")
        if not isinstance(predictions, list) or len(predictions) != len(query_images):
            raise ValueError(f"prediction/query count mismatch: {batch_id}")
        seen_queries: set[int] = set()
        queries: list[dict[str, object]] = []
        for prediction in predictions:
            if not isinstance(prediction, dict):
                raise ValueError(f"invalid prediction: {batch_id}")
            query_index = required_int(prediction.get("queryIndex"), "queryIndex")
            reference_index = required_int(prediction.get("referenceIndex"), "referenceIndex")
            if query_index not in query_images or query_index in seen_queries or not 0 <= reference_index < 6:
                raise ValueError(f"prediction index invalid: {batch_id}")
            margin_value = prediction.get("margin")
            margin = None if margin_value is None else required_number(margin_value, "margin")
            accepted = prediction.get("accepted")
            if not isinstance(accepted, bool):
                raise ValueError("accepted must be boolean")
            seen_queries.add(query_index)
            accepted_count += int(accepted)
            queries.append({"newIndex": query_index, "src": query_images[query_index], "predictedImgIndex": reference_index, "similarity": required_number(prediction.get("similarity"), "similarity"), "margin": margin, "accepted": accepted, "modelId": model_id})
        if seen_queries != set(query_images):
            raise ValueError(f"incomplete prediction coverage: {batch_id}")
        total_queries += len(queries)
        embedded.append({"batchId": batch_id, "capturedAt": item.get("capturedAt"), "references": references, "queries": sorted(queries, key=lambda row: int(row["newIndex"]))})

    return {"schemaVersion": 1, "mode": "live-review", "sessionId": session_id, "manifestSha256": sha256_file(manifest_path), "modelIds": sorted(model_ids), "summary": {"totalBatches": len(embedded), "totalQueries": total_queries, "acceptedCount": accepted_count}, "batches": embedded}


HTML_TEMPLATE = r'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fishing Live Review</title>
<style>:root{--bg:#07111f;--panel:#0d1c2f;--line:#29415d;--text:#edf7ff;--muted:#9bb1c8;--green:#67df9a;--red:#ff7185;--amber:#ffc66d;--blue:#77a9ff;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui}.shell{width:min(1400px,calc(100% - 28px));margin:auto;padding:30px 0 70px}h1{margin:0}.sub,.count{color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:22px 0}.metric,.query{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}.metric strong{display:block;font-size:24px}.controls{position:sticky;top:0;z-index:3;background:#07111fee;padding:12px 0;display:flex;gap:10px;flex-wrap:wrap}button,select{font:inherit;color:var(--text);background:#12243a;border:1px solid var(--line);border-radius:9px;padding:9px 12px;cursor:pointer}.controls .count{margin-left:auto}.batch{margin:24px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.head{display:flex;justify-content:space-between}.badge{font-size:12px;border:1px solid;border-radius:99px;padding:2px 8px}.accepted{color:var(--green)}.rejected{color:var(--amber)}.visual{display:grid;grid-template-columns:140px 1fr;gap:12px;margin-top:12px}.target{border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center}.target img{width:100%;height:105px;object-fit:contain}.refs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.ref{position:relative;padding:6px}.ref img{width:100%;height:54px;object-fit:contain;display:block}.ref.predicted{box-shadow:inset 0 0 0 2px var(--blue)}.ref.manual{border-color:var(--green)}.idx{position:absolute;right:4px;top:3px;background:#06101dcc;padding:0 5px;border-radius:4px}.details{color:var(--muted);font-size:12px;margin-top:10px}.wrong{border-color:var(--red)}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}}@media(max-width:560px){.visual{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}}</style></head><body><div class="shell"><h1>Fishing Live Review</h1><p class="sub" id="subtitle"></p><section class="metrics" id="metrics"></section><div class="controls"><select id="filter"><option value="all">Tất cả</option><option value="unreviewed">Chưa review</option><option value="reviewed">Đã review</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="correct">Model đúng</option><option value="wrong">Model sai</option></select><select id="batch"><option value="all">Tất cả batch</option></select><button id="next">Tới mục chưa review</button><button id="export">Xuất JSON</button><button id="reset">Xóa review</button><span class="count" id="count"></span></div><main id="list"></main></div>
<script id="review-data" type="application/json">__DATA__</script><script>
const data=JSON.parse(document.getElementById('review-data').textContent);const key=`fishing-live-review:v1:${data.sessionId}:${data.manifestSha256}`;let reviews={};try{reviews=JSON.parse(localStorage.getItem(key)||'{}')}catch{};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const qkey=(b,q)=>`${b}:${q}`;const pct=(n,d)=>d?`${(100*n/d).toFixed(2)}%`:'—';
const rows=data.batches.flatMap(b=>b.queries.map(q=>({b,q,key:qkey(b.batchId,q.newIndex)})));document.getElementById('subtitle').textContent=`${data.summary.totalBatches} batch · ${data.summary.totalQueries} query · model: ${data.modelIds.join(', ')}`;
const batchSelect=document.getElementById('batch');data.batches.forEach(b=>batchSelect.insertAdjacentHTML('beforeend',`<option value="${esc(b.batchId)}">${esc(b.batchId)}</option>`));
function metrics(){const reviewed=rows.filter(r=>reviews[r.key]!==undefined);const correct=reviewed.filter(r=>reviews[r.key]===r.q.predictedImgIndex);const accepted=rows.filter(r=>r.q.accepted);const acceptedReviewed=reviewed.filter(r=>r.q.accepted);const acceptedCorrect=acceptedReviewed.filter(r=>reviews[r.key]===r.q.predictedImgIndex);const rejectedCorrect=correct.filter(r=>!r.q.accepted);const cards=[['Đã capture',`${data.summary.totalBatches} batch / ${rows.length} query`],['Tỷ lệ accepted',pct(accepted.length,rows.length)],['Tiến độ review',`${reviewed.length}/${rows.length}`],['Top-1 thủ công',pct(correct.length,reviewed.length)],['Đúng trong accepted',pct(acceptedCorrect.length,acceptedReviewed.length)],['Rejected nhưng đúng',String(rejectedCorrect.length)]];document.getElementById('metrics').innerHTML=cards.map(([a,b])=>`<div class="metric"><span class="sub">${a}</span><strong>${b}</strong></div>`).join('')}
function visible(r){const f=document.getElementById('filter').value,b=document.getElementById('batch').value,m=reviews[r.key],reviewed=m!==undefined;return(b==='all'||r.b.batchId===b)&&(f==='all'||f==='unreviewed'&&!reviewed||f==='reviewed'&&reviewed||f==='accepted'&&r.q.accepted||f==='rejected'&&!r.q.accepted||f==='correct'&&reviewed&&m===r.q.predictedImgIndex||f==='wrong'&&reviewed&&m!==r.q.predictedImgIndex)}
function render(){metrics();let shown=0;document.getElementById('list').innerHTML=data.batches.map(b=>{const qs=b.queries.filter(q=>visible({b,q,key:qkey(b.batchId,q.newIndex)}));shown+=qs.length;if(!qs.length)return'';return`<section class="batch"><h2>${esc(b.batchId)}</h2><div class="grid">${qs.map(q=>{const k=qkey(b.batchId,q.newIndex),m=reviews[k],reviewed=m!==undefined,correct=reviewed&&m===q.predictedImgIndex;return`<article class="query ${reviewed&&!correct?'wrong':''}" id="q-${esc(k)}"><div class="head"><b>Query ${q.newIndex}</b><span class="badge ${q.accepted?'accepted':'rejected'}">${q.accepted?'Accepted':'Rejected'}</span></div><div class="visual"><div class="target"><img src="${q.src}" alt="query"><small>Ảnh cần nhận diện</small></div><div class="refs">${b.references.map(r=>`<button class="ref ${r.index===q.predictedImgIndex?'predicted':''} ${m===r.index?'manual':''}" data-key="${esc(k)}" data-index="${r.index}"><span class="idx">${r.index}</span><img src="${r.src}" alt="reference ${r.index}"></button>`).join('')}</div></div><div class="details">Model chọn ảnh ${q.predictedImgIndex} · similarity ${q.similarity.toFixed(4)} · margin ${q.margin===null?'—':q.margin.toFixed(4)} · ${reviewed?(correct?'✓ Bạn xác nhận đúng':'✗ Bạn xác nhận sai'):'Chưa review'} <button data-clear="${esc(k)}">Không xác định</button></div></article>`}).join('')}</div></section>`}).join('');document.getElementById('count').textContent=`Đang hiện ${shown}/${rows.length} query`;document.querySelectorAll('[data-key]').forEach(el=>el.onclick=()=>{reviews[el.dataset.key]=Number(el.dataset.index);save()});document.querySelectorAll('[data-clear]').forEach(el=>el.onclick=()=>{reviews[el.dataset.clear]=null;save()})}
function save(){try{localStorage.setItem(key,JSON.stringify(reviews))}catch{}render()}document.getElementById('filter').onchange=render;batchSelect.onchange=render;document.getElementById('next').onclick=()=>{const row=rows.find(r=>reviews[r.key]===undefined);if(row){document.getElementById('filter').value='all';batchSelect.value='all';render();document.getElementById(`q-${row.key}`).scrollIntoView({behavior:'smooth'})}};document.getElementById('reset').onclick=()=>{if(confirm('Xóa toàn bộ review của session này?')){reviews={};save()}};document.getElementById('export').onclick=()=>{const reviewed=rows.filter(r=>reviews[r.key]!==undefined);const correct=reviewed.filter(r=>reviews[r.key]===r.q.predictedImgIndex);const out={schemaVersion:1,sessionId:data.sessionId,manifestSha256:data.manifestSha256,summary:{totalQueries:rows.length,reviewedCount:reviewed.length,correctCount:correct.length,top1Accuracy:reviewed.length?correct.length/reviewed.length:null},reviews:Object.keys(reviews).sort().map(k=>({key:k,selectedReferenceIndex:reviews[k]}))};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download=`${data.sessionId}-reviews.json`;a.click();URL.revokeObjectURL(a.href)};render();
</script></body></html>'''


def render_html(payload: dict[str, object]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return HTML_TEMPLATE.replace("__DATA__", encoded)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        payload = build_payload(args.manifest)
        body = render_html(payload)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temp = args.output.with_name(args.output.name + ".tmp")
        temp.write_text(body, encoding="utf-8")
        os.replace(temp, args.output)
        print(f"built {args.output}: {payload['summary']['totalBatches']} batches, {payload['summary']['totalQueries']} queries")
        return 0
    except Exception as error:
        print(f"build live review failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
