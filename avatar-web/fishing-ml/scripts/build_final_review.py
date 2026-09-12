#!/usr/bin/env python3
"""Build a standalone browser report for manual review of final predictions."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence


DEFAULT_RUN_ID = "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"
EXPECTED_BATCH_COUNT = 30
EXPECTED_QUERY_COUNT = 210
EXPECTED_REFERENCE_COUNT = 6
EXPECTED_CORRECT_COUNT = 209
EXPECTED_ACCEPTED_COUNT = 116
EXPECTED_BATCH_EXACT_COUNT = 29
EXPECTED_ACCEPTED_WRONG_COUNT = 0


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
    if not path.is_file():
        raise ValueError(f"missing PNG: {path}")
    actual = sha256_file(path)
    if actual != expected_sha256.lower():
        raise ValueError(f"PNG checksum mismatch: {path}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _required_int(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")
    return value


def _required_number(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    return float(value)


def _required_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be a boolean")
    return value


def build_payload(project_root: Path, run_id: str) -> dict[str, object]:
    run_dir = project_root / "artifacts" / run_id
    report_path = run_dir / "final-evaluation.json"
    snapshot_path = run_dir / "frozen" / "dataset-snapshot.json"
    report = read_json_object(report_path)
    snapshot = read_json_object(snapshot_path)

    if report.get("schemaVersion") != 1 or report.get("split") != "final":
        raise ValueError("final report must be schema-v1 with split=final")
    predictions_value = report.get("predictions")
    if not isinstance(predictions_value, list) or len(predictions_value) != EXPECTED_QUERY_COUNT:
        raise ValueError(f"final report must contain {EXPECTED_QUERY_COUNT} predictions")
    batches_value = snapshot.get("batches")
    if not isinstance(batches_value, list):
        raise ValueError("dataset snapshot batches must be an array")
    final_batches = [batch for batch in batches_value if isinstance(batch, dict) and batch.get("split") == "final"]
    if len(final_batches) != EXPECTED_BATCH_COUNT:
        raise ValueError(f"dataset snapshot must contain {EXPECTED_BATCH_COUNT} final batches")

    predictions_by_batch: dict[str, list[dict[str, object]]] = {}
    seen_keys: set[tuple[str, int]] = set()
    for position, prediction_value in enumerate(predictions_value):
        if not isinstance(prediction_value, dict):
            raise ValueError(f"prediction {position} must be an object")
        batch_id = prediction_value.get("batchId")
        if not isinstance(batch_id, str) or not batch_id:
            raise ValueError(f"prediction {position} has invalid batchId")
        new_index = _required_int(prediction_value.get("newIndex"), f"prediction {position}.newIndex")
        expected_index = _required_int(prediction_value.get("expectedImgIndex"), f"prediction {position}.expectedImgIndex")
        predicted_index = _required_int(prediction_value.get("predictedImgIndex"), f"prediction {position}.predictedImgIndex")
        if not 0 <= expected_index < EXPECTED_REFERENCE_COUNT or not 0 <= predicted_index < EXPECTED_REFERENCE_COUNT:
            raise ValueError(f"prediction {position} has reference index outside 0..5")
        key = (batch_id, new_index)
        if key in seen_keys:
            raise ValueError(f"duplicate prediction key: {batch_id}:{new_index}")
        seen_keys.add(key)
        prediction = {
            "batchId": batch_id,
            "newIndex": new_index,
            "expectedImgIndex": expected_index,
            "predictedImgIndex": predicted_index,
            "similarity": _required_number(prediction_value.get("similarity"), f"prediction {position}.similarity"),
            "margin": _required_number(prediction_value.get("margin"), f"prediction {position}.margin"),
            "accepted": _required_bool(prediction_value.get("accepted"), f"prediction {position}.accepted"),
        }
        predictions_by_batch.setdefault(batch_id, []).append(prediction)

    embedded_batches: list[dict[str, object]] = []
    batch_exact_count = 0
    snapshot_batch_ids: set[str] = set()
    raw_root = project_root / "data" / "phase2" / "raw"
    for batch in sorted(final_batches, key=lambda item: str(item.get("batchId", ""))):
        batch_id = batch.get("batchId")
        if not isinstance(batch_id, str) or not batch_id:
            raise ValueError("final snapshot batch has invalid batchId")
        if batch_id in snapshot_batch_ids:
            raise ValueError(f"duplicate final snapshot batch: {batch_id}")
        snapshot_batch_ids.add(batch_id)
        manifest = batch.get("manifest")
        files = batch.get("files")
        if not isinstance(manifest, dict) or not isinstance(files, dict):
            raise ValueError(f"snapshot batch has invalid manifest/files: {batch_id}")
        references_value = manifest.get("images")
        queries_value = manifest.get("imagesNew")
        if not isinstance(references_value, list) or len(references_value) != EXPECTED_REFERENCE_COUNT:
            raise ValueError(f"batch {batch_id} must contain six references")
        if not isinstance(queries_value, list):
            raise ValueError(f"batch {batch_id} queries must be an array")

        batch_dir = raw_root / batch_id
        references: list[dict[str, object]] = []
        reference_indexes: set[int] = set()
        for entry in references_value:
            if not isinstance(entry, dict):
                raise ValueError(f"batch {batch_id} reference must be an object")
            index = _required_int(entry.get("index"), f"{batch_id} reference index")
            relative_path = entry.get("path")
            if not isinstance(relative_path, str) or relative_path not in files:
                raise ValueError(f"batch {batch_id} reference path missing from snapshot")
            expected_sha = files[relative_path]
            if not isinstance(expected_sha, str):
                raise ValueError(f"batch {batch_id} reference checksum is invalid")
            reference_indexes.add(index)
            references.append({"index": index, "src": encode_verified_png(batch_dir / relative_path, expected_sha)})
        if reference_indexes != set(range(EXPECTED_REFERENCE_COUNT)):
            raise ValueError(f"batch {batch_id} reference indexes must be 0..5")

        query_entries: dict[int, tuple[str, str]] = {}
        for entry in queries_value:
            if not isinstance(entry, dict):
                raise ValueError(f"batch {batch_id} query must be an object")
            index = _required_int(entry.get("index"), f"{batch_id} query index")
            relative_path = entry.get("path")
            if not isinstance(relative_path, str) or relative_path not in files:
                raise ValueError(f"batch {batch_id} query path missing from snapshot")
            expected_sha = files[relative_path]
            if not isinstance(expected_sha, str) or index in query_entries:
                raise ValueError(f"batch {batch_id} query metadata is invalid")
            query_entries[index] = (relative_path, expected_sha)

        batch_predictions = predictions_by_batch.get(batch_id)
        if not batch_predictions or len(batch_predictions) != len(query_entries):
            raise ValueError(f"batch {batch_id} prediction/query count mismatch")
        queries: list[dict[str, object]] = []
        all_correct = True
        for prediction in sorted(batch_predictions, key=lambda item: int(item["newIndex"])):
            new_index = int(prediction["newIndex"])
            if new_index not in query_entries:
                raise ValueError(f"batch {batch_id} prediction references missing query {new_index}")
            relative_path, expected_sha = query_entries[new_index]
            all_correct = all_correct and prediction["predictedImgIndex"] == prediction["expectedImgIndex"]
            queries.append({
                "newIndex": new_index,
                "src": encode_verified_png(batch_dir / relative_path, expected_sha),
                "expectedImgIndex": prediction["expectedImgIndex"],
                "predictedImgIndex": prediction["predictedImgIndex"],
                "similarity": prediction["similarity"],
                "margin": prediction["margin"],
                "accepted": prediction["accepted"],
            })
        if set(query_entries) != {int(item["newIndex"]) for item in batch_predictions}:
            raise ValueError(f"batch {batch_id} query index coverage mismatch")
        if all_correct:
            batch_exact_count += 1
        embedded_batches.append({
            "batchId": batch_id,
            "references": sorted(references, key=lambda item: int(item["index"])),
            "queries": queries,
        })

    if set(predictions_by_batch) != snapshot_batch_ids:
        raise ValueError("final report and snapshot batch IDs do not match")
    correct_count = sum(item["predictedImgIndex"] == item["expectedImgIndex"] for rows in predictions_by_batch.values() for item in rows)
    accepted_count = sum(bool(item["accepted"]) for rows in predictions_by_batch.values() for item in rows)
    accepted_wrong_count = sum(bool(item["accepted"]) and item["predictedImgIndex"] != item["expectedImgIndex"] for rows in predictions_by_batch.values() for item in rows)
    expected_summary = (
        EXPECTED_CORRECT_COUNT,
        EXPECTED_ACCEPTED_COUNT,
        EXPECTED_BATCH_EXACT_COUNT,
        EXPECTED_ACCEPTED_WRONG_COUNT,
    )
    actual_summary = (correct_count, accepted_count, batch_exact_count, accepted_wrong_count)
    if actual_summary != expected_summary:
        raise ValueError(f"source metrics changed: expected {expected_summary}, got {actual_summary}")

    return {
        "schemaVersion": 1,
        "modelId": run_id,
        "sourceReportSha256": sha256_file(report_path),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalBatches": EXPECTED_BATCH_COUNT,
            "totalQueries": EXPECTED_QUERY_COUNT,
            "datasetCorrect": correct_count,
            "datasetBatchExact": batch_exact_count,
            "acceptedCount": accepted_count,
            "acceptedCorrect": accepted_count - accepted_wrong_count,
        },
        "batches": embedded_batches,
    }


HTML_TEMPLATE = r'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fishing Model Review</title>
<style>
:root{--bg:#07111f;--panel:#0d1c2f;--panel2:#12243a;--line:#29415d;--text:#edf7ff;--muted:#9bb1c8;--cyan:#4dd7d1;--green:#67df9a;--red:#ff7185;--amber:#ffc66d;--blue:#77a9ff;--shadow:0 18px 50px #0005;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% -10%,#193d59 0,transparent 34%),var(--bg);color:var(--text);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,select{font:inherit}button{cursor:pointer}.shell{width:min(1480px,calc(100% - 32px));margin:auto;padding:34px 0 80px}.topbar{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}.eyebrow{margin:0 0 5px;color:var(--cyan);font-weight:800;letter-spacing:.13em;text-transform:uppercase;font-size:12px}h1{margin:0;font-size:clamp(28px,4vw,48px);line-height:1.1}.sub{margin:10px 0 0;color:var(--muted);max-width:900px}.actions{display:flex;gap:10px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:var(--panel2);color:var(--text);padding:10px 14px;border-radius:10px;font-weight:700}.btn:hover,.btn:focus-visible{border-color:var(--cyan);outline:none}.btn.danger{color:#ffdce1}.section-title{margin:28px 0 10px;font-size:16px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(170px,1fr));gap:12px}.metric{background:linear-gradient(145deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow)}.metric .label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.07em}.metric strong{display:block;font-size:25px;margin-top:5px}.metric small{display:block;color:var(--muted);margin-top:4px}.controls{position:sticky;top:0;z-index:20;margin:22px 0;padding:13px;background:#0a1728ee;border:1px solid var(--line);border-radius:14px;backdrop-filter:blur(12px);display:flex;gap:10px;align-items:center;flex-wrap:wrap}.controls select{background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:9px 12px}.count{color:var(--muted);margin-left:auto}.notice{margin:12px 0;padding:12px 14px;border:1px solid #8c6928;background:#382b13;border-radius:10px;color:#ffe1a8}.batch{margin:18px 0 28px}.batch-head{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid var(--line);padding:0 2px 8px}.batch-head h2{font-size:18px;margin:0}.batch-head span{color:var(--muted)}.query-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.query-card{background:linear-gradient(145deg,var(--panel),#0a1727);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow);scroll-margin-top:100px}.query-card.is-wrong{border-color:#923e50}.query-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.query-id{font-weight:800}.badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.badge{border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;border:1px solid currentColor}.good{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--amber)}.info{color:var(--blue)}.visual-row{display:grid;grid-template-columns:150px 1fr;gap:14px;margin-top:14px}.query-image-wrap{background:#06101b;border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}.query-image-wrap img{width:100%;height:120px;object-fit:contain;image-rendering:auto}.caption{font-size:11px;color:var(--muted);margin-top:5px}.references{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.reference{position:relative;background:#081523;border:2px solid transparent;color:var(--text);border-radius:11px;padding:7px;min-width:0}.reference img{width:100%;height:58px;object-fit:contain;display:block}.reference:hover,.reference:focus-visible{outline:none;border-color:var(--cyan)}.reference.model{box-shadow:inset 0 0 0 2px var(--blue)}.reference.expected:after{content:"Nhãn";position:absolute;top:4px;left:4px;background:#44320e;color:var(--amber);font-size:9px;font-weight:900;border-radius:5px;padding:1px 4px}.reference.manual{border-color:var(--green)}.reference-index{position:absolute;right:5px;top:4px;background:#06101dcc;border-radius:5px;padding:1px 5px;font-size:10px;font-weight:900}.details{margin-top:12px;display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:12px}.details b{color:var(--text)}.review-actions{display:flex;gap:8px;margin-top:12px;align-items:center}.review-actions .btn{padding:7px 10px;font-size:12px}.manual-status{margin-left:auto;color:var(--muted);font-size:12px}.empty{padding:60px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px}.footer-note{color:var(--muted);margin-top:35px;font-size:12px;word-break:break-all}@media(max-width:1050px){.metrics{grid-template-columns:repeat(2,1fr)}.query-grid{grid-template-columns:1fr}}@media(max-width:760px){.shell{width:min(100% - 20px,1480px);padding-top:20px}.topbar{display:block}.actions{margin-top:16px}.metrics{grid-template-columns:1fr}.visual-row{grid-template-columns:1fr}.references{grid-template-columns:repeat(2,1fr)}.controls{position:static}.count{width:100%;margin-left:0}}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar" id="report-header">
    <div><p class="eyebrow">Human verification workspace</p><h1>Fishing Model Review</h1><p class="sub" id="report-subtitle"></p></div>
    <div class="actions"><button class="btn" id="export-btn">Xuất JSON</button><button class="btn danger" id="reset-btn">Xóa toàn bộ review</button></div>
  </header>
  <div class="notice" id="storage-warning" role="status" hidden>Không thể lưu vào trình duyệt. Review vẫn dùng được trong phiên này nhưng sẽ mất khi đóng trang.</div>
  <h2 class="section-title">Kết quả theo nhãn dataset</h2><section class="metrics" id="dataset-metrics" aria-label="Chỉ số dataset"></section>
  <h2 class="section-title">Kết quả review thủ công</h2><section class="metrics" id="manual-metrics" aria-label="Chỉ số review thủ công"></section>
  <section class="controls" id="filters" aria-label="Bộ lọc">
    <select id="status-filter" aria-label="Lọc trạng thái"><option value="all">Tất cả</option><option value="unreviewed">Chưa review</option><option value="reviewed">Đã review</option><option value="model-wrong">Model sai nhãn</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="label-disagreement">Bạn khác nhãn</option></select>
    <select id="batch-filter" aria-label="Lọc batch"><option value="all">Tất cả batch</option></select>
    <button class="btn" id="next-btn">Tới mục chưa review tiếp theo</button><span class="count" id="visible-count"></span>
  </section>
  <main id="batch-list"></main>
  <p class="footer-note" id="source-note"></p>
</div>
<script id="review-data" type="application/json">__DATA__</script>
<script>
const DATA=JSON.parse(document.getElementById('review-data').textContent);
const storageKey=`fishing-model-review:v1:${DATA.modelId}:${DATA.sourceReportSha256}`;
let reviews={};
const queryKey=(batchId,newIndex)=>`${batchId}:${newIndex}`;
const pct=(n,d)=>{if(!d)return '—';const value=n*100/d;return `${value.toLocaleString('vi-VN',{minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:2})}%`};
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const allQueries=()=>DATA.batches.flatMap(batch=>batch.queries.map(query=>({batch,query,key:queryKey(batch.batchId,query.newIndex)})));

function validReview(item,batchId,newIndex){return item&&item.batchId===batchId&&item.newIndex===newIndex&&(item.reviewedImgIndex===null||(Number.isInteger(item.reviewedImgIndex)&&item.reviewedImgIndex>=0&&item.reviewedImgIndex<6))&&typeof item.reviewedAt==='string'}
function loadReviews(){try{const raw=localStorage.getItem(storageKey);if(!raw)return;const doc=JSON.parse(raw);if(doc.schemaVersion!==1||doc.modelId!==DATA.modelId||doc.sourceReportSha256!==DATA.sourceReportSha256||!doc.reviews||typeof doc.reviews!=='object')return;const loaded={};for(const {batch,query,key} of allQueries()){const item=doc.reviews[key];if(validReview(item,batch.batchId,query.newIndex))loaded[key]=item}reviews=loaded}catch(error){document.getElementById('storage-warning').hidden=false}}
function saveReviews(){try{localStorage.setItem(storageKey,JSON.stringify({schemaVersion:1,modelId:DATA.modelId,sourceReportSha256:DATA.sourceReportSha256,reviews}));document.getElementById('storage-warning').hidden=true}catch(error){document.getElementById('storage-warning').hidden=false}}
function calculateMetrics(){let manualReviewed=0,manualComparable=0,manualCorrect=0,manualAcceptedComparable=0,manualAcceptedCorrect=0,labelDisagreements=0;for(const {query,key} of allQueries()){if(!(key in reviews))continue;manualReviewed++;const choice=reviews[key].reviewedImgIndex;if(choice===null)continue;manualComparable++;if(query.predictedImgIndex===choice)manualCorrect++;if(choice!==query.expectedImgIndex)labelDisagreements++;if(query.accepted){manualAcceptedComparable++;if(query.predictedImgIndex===choice)manualAcceptedCorrect++}}return{datasetCorrect:DATA.summary.datasetCorrect,totalQueries:DATA.summary.totalQueries,datasetBatchExact:DATA.summary.datasetBatchExact,totalBatches:DATA.summary.totalBatches,acceptedCount:DATA.summary.acceptedCount,acceptedCorrect:DATA.summary.acceptedCorrect,manualReviewed,manualComparable,manualCorrect,manualAcceptedComparable,manualAcceptedCorrect,labelDisagreements}}
function metric(label,value,detail){return `<article class="metric"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`}
function renderMetrics(){const m=calculateMetrics();document.getElementById('dataset-metrics').innerHTML=[metric('Top-1 accuracy',`${m.datasetCorrect}/${m.totalQueries} (${pct(m.datasetCorrect,m.totalQueries)})`,'Model chọn đúng ảnh theo nhãn'),metric('Đúng toàn bộ batch',`${m.datasetBatchExact}/${m.totalBatches} (${pct(m.datasetBatchExact,m.totalBatches)})`,'Mọi query trong batch đều đúng'),metric('Tỷ lệ chấp nhận',`${m.acceptedCount}/${m.totalQueries} (${pct(m.acceptedCount,m.totalQueries)})`,'Đủ similarity và margin'),metric('Đúng trong accepted',`${m.acceptedCorrect}/${m.acceptedCount} (${pct(m.acceptedCorrect,m.acceptedCount)})`,'Accepted và khớp nhãn')].join('');document.getElementById('manual-metrics').innerHTML=[metric('Tiến độ review',`${m.manualReviewed}/${m.totalQueries} (${pct(m.manualReviewed,m.totalQueries)})`,'Gồm cả không xác định'),metric('Accuracy theo bạn',m.manualComparable?`${m.manualCorrect}/${m.manualComparable} (${pct(m.manualCorrect,m.manualComparable)})`:'—','Chỉ tính lựa chọn 0–5'),metric('Accepted accuracy theo bạn',m.manualAcceptedComparable?`${m.manualAcceptedCorrect}/${m.manualAcceptedComparable} (${pct(m.manualAcceptedCorrect,m.manualAcceptedComparable)})`:'—','Accepted đã có lựa chọn thủ công'),metric('Khác nhãn dataset',`${m.labelDisagreements}/${m.manualComparable}`,'Có thể là nhãn cần kiểm tra lại')].join('')}
function referenceMarkup(batch,query,reference,manual){const classes=['reference'];if(reference.index===query.predictedImgIndex)classes.push('model');if(reference.index===query.expectedImgIndex)classes.push('expected');if(manual&&manual.reviewedImgIndex===reference.index)classes.push('manual');const labels=[];if(reference.index===query.predictedImgIndex)labels.push('Model chọn');if(reference.index===query.expectedImgIndex)labels.push('Nhãn dataset');if(manual&&manual.reviewedImgIndex===reference.index)labels.push('Bạn chọn');return `<button class="${classes.join(' ')}" data-action="review" data-batch="${esc(batch.batchId)}" data-new="${query.newIndex}" data-choice="${reference.index}" aria-label="Chọn ảnh tham chiếu ${reference.index}; ${esc(labels.join(', ')||'không có nhãn')}"><span class="reference-index">${reference.index}</span><img src="${reference.src}" alt="Ảnh tham chiếu ${reference.index} của batch ${esc(batch.batchId)}"><span class="caption">${esc(labels.join(' · ')||'Chọn ảnh này')}</span></button>`}
function queryMarkup(batch,query){const key=queryKey(batch.batchId,query.newIndex),manual=reviews[key],correct=query.predictedImgIndex===query.expectedImgIndex;const manualText=!manual?'Chưa review':manual.reviewedImgIndex===null?'Bạn chọn: không xác định':`Bạn chọn: ảnh ${manual.reviewedImgIndex}`;return `<article class="query-card ${correct?'':'is-wrong'}" id="q-${esc(batch.batchId)}-${query.newIndex}" data-key="${esc(key)}"><div class="query-head"><span class="query-id">Query ${query.newIndex}</span><span class="badges"><span class="badge ${correct?'good':'bad'}">${correct?'✓ Model đúng nhãn':'✕ Model sai nhãn'}</span><span class="badge ${query.accepted?'info':'warn'}">${query.accepted?'Accepted':'Rejected'}</span></span></div><div class="visual-row"><div class="query-image-wrap"><img src="${query.src}" alt="Query ${query.newIndex} của batch ${esc(batch.batchId)}"><div class="caption">Ảnh cần nhận diện</div></div><div class="references">${batch.references.map(ref=>referenceMarkup(batch,query,ref,manual)).join('')}</div></div><div class="details"><span>Model: <b>ảnh ${query.predictedImgIndex}</b></span><span>Nhãn: <b>ảnh ${query.expectedImgIndex}</b></span><span>Similarity: <b>${query.similarity.toFixed(4)}</b></span><span>Margin: <b>${query.margin.toFixed(4)}</b></span></div><div class="review-actions"><button class="btn" data-action="unknown" data-batch="${esc(batch.batchId)}" data-new="${query.newIndex}">Không xác định</button><button class="btn" data-action="clear" data-batch="${esc(batch.batchId)}" data-new="${query.newIndex}" ${manual?'':'disabled'}>Xóa review</button><span class="manual-status">${esc(manualText)}</span></div></article>`}
function matchesFilter(batch,query){const status=document.getElementById('status-filter').value,batchFilter=document.getElementById('batch-filter').value,key=queryKey(batch.batchId,query.newIndex),manual=reviews[key];if(batchFilter!=='all'&&batch.batchId!==batchFilter)return false;if(status==='unreviewed')return !manual;if(status==='reviewed')return !!manual;if(status==='model-wrong')return query.predictedImgIndex!==query.expectedImgIndex;if(status==='accepted')return query.accepted;if(status==='rejected')return !query.accepted;if(status==='label-disagreement')return !!manual&&manual.reviewedImgIndex!==null&&manual.reviewedImgIndex!==query.expectedImgIndex;return true}
function renderBatches(){const root=document.getElementById('batch-list');let visible=0;const html=[];for(const batch of DATA.batches){const queries=batch.queries.filter(query=>matchesFilter(batch,query));if(!queries.length)continue;visible+=queries.length;html.push(`<section class="batch"><div class="batch-head"><h2>${esc(batch.batchId)}</h2><span>${queries.length}/${batch.queries.length} query</span></div><div class="query-grid">${queries.map(query=>queryMarkup(batch,query)).join('')}</div></section>`)}root.innerHTML=html.join('')||'<div class="empty">Không có query phù hợp với bộ lọc hiện tại.</div>';document.getElementById('visible-count').textContent=`Đang hiện ${visible}/${DATA.summary.totalQueries} query`}
function render(){renderMetrics();renderBatches()}
function setReview(batchId,newIndex,choice){const key=queryKey(batchId,newIndex);reviews[key]={batchId,newIndex,reviewedImgIndex:choice,reviewedAt:new Date().toISOString()};saveReviews();render()}
function clearReview(batchId,newIndex){delete reviews[queryKey(batchId,newIndex)];saveReviews();render()}
function applyFilters(){renderBatches()}
function exportReviews(){const m=calculateMetrics(),sorted=Object.values(reviews).sort((a,b)=>a.batchId.localeCompare(b.batchId)||a.newIndex-b.newIndex);const payload={schemaVersion:1,modelId:DATA.modelId,sourceReportSha256:DATA.sourceReportSha256,exportedAt:new Date().toISOString(),summary:m,reviews:sorted};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`fishing-model-review-${DATA.modelId}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
function resetAllReviews(){if(!window.confirm('Xóa toàn bộ kết quả review đã lưu trên trình duyệt này?'))return;reviews={};try{localStorage.removeItem(storageKey)}catch(error){document.getElementById('storage-warning').hidden=false}render()}
document.getElementById('batch-list').addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button)return;const batchId=button.dataset.batch,newIndex=Number(button.dataset.new);if(button.dataset.action==='review')setReview(batchId,newIndex,Number(button.dataset.choice));if(button.dataset.action==='unknown')setReview(batchId,newIndex,null);if(button.dataset.action==='clear')clearReview(batchId,newIndex)});
document.getElementById('status-filter').addEventListener('change',applyFilters);document.getElementById('batch-filter').addEventListener('change',applyFilters);document.getElementById('export-btn').addEventListener('click',exportReviews);document.getElementById('reset-btn').addEventListener('click',resetAllReviews);document.getElementById('next-btn').addEventListener('click',()=>{const next=allQueries().find(item=>!(item.key in reviews));if(!next)return;document.getElementById('status-filter').value='all';document.getElementById('batch-filter').value='all';renderBatches();requestAnimationFrame(()=>document.getElementById(`q-${next.batch.batchId}-${next.query.newIndex}`)?.scrollIntoView({behavior:'smooth',block:'start'}))});
document.getElementById('report-subtitle').textContent=`Model ${DATA.modelId} · ${DATA.summary.totalBatches} batch · ${DATA.summary.totalQueries} query`;
document.getElementById('source-note').textContent=`Nguồn: final-evaluation.json SHA-256 ${DATA.sourceReportSha256} · Tạo lúc ${DATA.generatedAt}`;
const batchFilter=document.getElementById('batch-filter');for(const batch of DATA.batches){const option=document.createElement('option');option.value=batch.batchId;option.textContent=batch.batchId;batchFilter.append(option)}
loadReviews();render();
</script>
</body>
</html>
'''


def render_html(payload: dict[str, object]) -> str:
    embedded_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    embedded_json = embedded_json.replace("<", "\\u003c")
    return HTML_TEMPLATE.replace("__DATA__", embedded_json)


def main(argv: Sequence[str] | None = None) -> int:
    default_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=default_root)
    parser.add_argument("--run-id", default=DEFAULT_RUN_ID)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    project_root = args.project_root.resolve()
    output = args.output.resolve() if args.output else project_root / "review" / "final-model-review.html"
    try:
        payload = build_payload(project_root, args.run_id)
        rendered = render_html(payload)
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(output.suffix + ".tmp")
        temporary.write_text(rendered, encoding="utf-8")
        temporary.replace(output)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"build failed: {error}", file=sys.stderr)
        return 1
    summary = payload["summary"]
    print(
        f"built {output}: {summary['totalBatches']} batches, "
        f"{summary['totalQueries']} queries, {summary['datasetCorrect']} correct, "
        f"{summary['acceptedCount']} accepted, {output.stat().st_size} bytes"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
