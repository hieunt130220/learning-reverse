"""Dataset integrity validation and collection gates for fishing image batches."""
from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping
from PIL import Image
from .schema import EXPECTED_SIZE, PNG_SIGNATURE, BatchManifest, ManifestError, ValidationError, atomic_write_json, load_label, load_manifest, sha256_file

CODES=frozenset({"MANIFEST_SCHEMA","MISSING_FILE","PNG_DECODE","PNG_SIZE","CHECKSUM_MISMATCH","INDEX_GAP","LABEL_MISSING","LABEL_INCOMPLETE","LABEL_DUPLICATE_NEW","LABEL_RANGE","BATCH_ID_MISMATCH","DUPLICATE_BLOB"})

@dataclass(frozen=True, slots=True)
class ValidationIssue:
    code: str
    batch_id: str
    detail: str

@dataclass(frozen=True, slots=True)
class ValidationReport:
    completed_batches: int
    ambiguous_batches: int
    labeled_pairs: int
    issues: tuple[ValidationIssue, ...]
    duplicate_blobs: Mapping[str, tuple[tuple[str, str, int], ...]]

def _issue(code: str, batch: str, detail: str) -> ValidationIssue:
    if code not in CODES: raise ValueError(code)
    return ValidationIssue(code,batch,detail)

def _image_code(path: Path, expected: str) -> tuple[str|None,str|None]:
    if not path.is_file(): return "MISSING_FILE",None
    try: digest=sha256_file(path)
    except OSError: return "MISSING_FILE",None
    try:
        with path.open("rb") as f:
            if f.read(len(PNG_SIGNATURE)) != PNG_SIGNATURE: return "PNG_DECODE",digest
        with Image.open(path) as im: im.verify()
        with Image.open(path) as im:
            if im.format!="PNG" or im.mode not in ("RGB","RGBA"): return "PNG_DECODE",digest
            if im.size != EXPECTED_SIZE: return "PNG_SIZE",digest
    except (OSError,ValueError,SyntaxError): return "PNG_DECODE",digest
    return ("CHECKSUM_MISMATCH" if digest != expected.lower() else None),digest

def _label(root: Path, batch: str, manifest: BatchManifest) -> tuple[str|None,int,list[ValidationIssue]]:
    path=root/f"{batch}.json"
    if not path.is_file(): return None,0,[_issue("LABEL_MISSING",batch,f"missing label: {path}")]
    try: label=load_label(path)
    except (ManifestError,ValidationError,ValueError) as exc: return None,0,[_issue("LABEL_INCOMPLETE",batch,str(exc))]
    out=[]
    if label.batch_id != batch or label.batch_id != manifest.batch_id:
        out.append(_issue("BATCH_ID_MISMATCH",batch,f"label batchId {label.batch_id!r} does not match directory/manifest"))
    if label.status=="ambiguous":
        if label.matches: out.append(_issue("LABEL_INCOMPLETE",batch,"ambiguous label must have empty matches"))
        return "ambiguous",0,out
    news=[m.new_index for m in label.matches]
    dup=sorted({x for x in news if news.count(x)>1})
    if dup: out.append(_issue("LABEL_DUPLICATE_NEW",batch,f"duplicate newIndex values: {dup}"))
    expected=set(range(len(manifest.images_new))); actual=set(news)
    if actual != expected:
        out.append(_issue("LABEL_INCOMPLETE",batch,f"query coverage mismatch; missing={sorted(expected-actual)}, extra={sorted(actual-expected)}"))
    bad=sorted((m.new_index,m.img_index) for m in label.matches if not 0<=m.new_index<len(manifest.images_new) or not 0<=m.img_index<len(manifest.images))
    if bad: out.append(_issue("LABEL_RANGE",batch,f"out-of-range pairs: {bad}"))
    return "complete",len(label.matches),out

def validate_dataset(raw_root: Path, labels_root: Path) -> ValidationReport:
    raw_root,labels_root=Path(raw_root),Path(labels_root); issues=[]; inventory=defaultdict(list); completed=ambiguous=pairs=0
    dirs=sorted((p for p in raw_root.iterdir() if p.is_dir()),key=lambda p:p.name) if raw_root.is_dir() else []
    for directory in dirs:
        batch=directory.name; manifest_path=directory/"manifest.json"
        if not manifest_path.is_file(): issues.append(_issue("MISSING_FILE",batch,f"missing manifest: {manifest_path}")); continue
        try: manifest=load_manifest(manifest_path)
        except (ManifestError,ValidationError,ValueError) as exc:
            code="INDEX_GAP" if "indices are not contiguous" in str(exc) or "duplicate index" in str(exc) else "MANIFEST_SCHEMA"
            issues.append(_issue(code,batch,str(exc))); continue
        start=len(issues)
        if manifest.batch_id != batch: issues.append(_issue("BATCH_ID_MISMATCH",batch,f"manifest batchId {manifest.batch_id!r} does not match directory"))
        for role,entries in (("img",manifest.images),("new",manifest.images_new)):
            for entry in sorted(entries,key=lambda e:e.index):
                path=directory/entry.path; code,digest=_image_code(path,entry.sha256)
                if digest: inventory[digest].append((batch,role,entry.index))
                if code: issues.append(_issue(code,batch,f"{role}[{entry.index}]: {path}"))
        status,count,label_issues=_label(labels_root,batch,manifest); issues.extend(label_issues)
        if len(issues)==start:
            if status=="complete": completed+=1; pairs+=count
            elif status=="ambiguous": ambiguous+=1
    duplicates={}
    for digest,occurrences in sorted(inventory.items()):
        ordered=tuple(sorted(occurrences))
        batches=sorted({x[0] for x in ordered})
        if len(batches)>1:
            duplicates[digest]=ordered
            for batch in batches: issues.append(_issue("DUPLICATE_BLOB",batch,f"sha256 {digest} occurs across batches: {ordered}"))
    return ValidationReport(completed,ambiguous,pairs,tuple(sorted(issues,key=lambda x:(x.code,x.batch_id,x.detail))),duplicates)

def _json(report: ValidationReport, rb: int|None, rp: int|None) -> dict[str,object]:
    gates={}
    if rb is not None: gates["batches"]={"met":report.completed_batches>=rb,"observed":report.completed_batches,"required":rb}
    if rp is not None: gates["pairs"]={"met":report.labeled_pairs>=rp,"observed":report.labeled_pairs,"required":rp}
    return {"ambiguousBatches":report.ambiguous_batches,"completedBatches":report.completed_batches,"duplicateBlobs":{d:[{"batchId":b,"role":r,"index":i} for b,r,i in xs] for d,xs in report.duplicate_blobs.items()},"gates":gates,"issues":[{"code":x.code,"batchId":x.batch_id,"detail":x.detail} for x in report.issues],"labeledPairs":report.labeled_pairs}

def main(argv: list[str]|None=None) -> int:
    p=argparse.ArgumentParser(description="Validate fishing image dataset integrity")
    p.add_argument("--raw-root",type=Path,required=True); p.add_argument("--labels-root",type=Path,required=True); p.add_argument("--require-batches",type=int); p.add_argument("--require-pairs",type=int); p.add_argument("--report",type=Path)
    a=p.parse_args(argv)
    if a.require_batches is not None and a.require_batches<0: p.error("--require-batches must be non-negative")
    if a.require_pairs is not None and a.require_pairs<0: p.error("--require-pairs must be non-negative")
    report=validate_dataset(a.raw_root,a.labels_root); document=_json(report,a.require_batches,a.require_pairs)
    if a.report: atomic_write_json(a.report,document)
    print(f"completed_batches={report.completed_batches} ambiguous_batches={report.ambiguous_batches} labeled_pairs={report.labeled_pairs} issues={len(report.issues)}")
    for name,gate in document["gates"].items(): print(f"gate_{name}: observed={gate['observed']} required={gate['required']} met={str(gate['met']).lower()}")
    return 0 if not report.issues and all(g["met"] for g in document["gates"].values()) else 2

if __name__=="__main__": raise SystemExit(main())
