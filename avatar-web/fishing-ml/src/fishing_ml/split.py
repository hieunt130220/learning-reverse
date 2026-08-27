"""Deterministic, leakage-safe fishing dataset splits.

Three renames cannot be globally atomic: creation refuses existing targets, stages
and fsyncs all sibling temps, then commits with best-effort rollback on failure.
"""
from __future__ import annotations
import argparse, json, os, random, re, sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal, Mapping
from .schema import load_label, load_manifest
from .validate import ValidationIssue, validate_dataset

NAMES=("train","dev","final"); KEYS={"checksum","affectedBatches","reviewer","date","rationale","resolution"}; HEX=re.compile(r"^[0-9a-f]{64}$")
@dataclass(frozen=True,slots=True)
class DuplicateReview:
 checksum:str; affected_batches:tuple[str,...]; reviewer:str; review_date:str; rationale:str; resolution:Literal["remove","regroup","accepted"]
@dataclass(frozen=True,slots=True)
class SplitValidation:
 valid:bool; counts:Mapping[str,int]; issues:tuple[ValidationIssue,...]; accepted_duplicates:tuple[str,...]

def issue(code:str,batch:str,detail:str)->ValidationIssue:return ValidationIssue(code,batch,detail)
def load_reviews(path:Path,dups:Mapping[str,tuple[tuple[str,str,int],...]])->tuple[dict[str,DuplicateReview],list[ValidationIssue]]:
 out={}; problems=[]
 try:
  with path.open(encoding="utf-8") as f: raw=json.load(f)
 except (OSError,UnicodeError,ValueError) as e:return {},[issue("DUPLICATE_REVIEW_SCHEMA","<dataset>",str(e))]
 if not isinstance(raw,dict) or set(raw)!={"schemaVersion","reviewedSha256"} or raw.get("schemaVersion")!=1 or not isinstance(raw.get("reviewedSha256"),list):return {},[issue("DUPLICATE_REVIEW_SCHEMA","<dataset>","expected exact schemaVersion=1 and reviewedSha256 list")]
 for i,x in enumerate(raw["reviewedSha256"]):
  p=f"reviewedSha256[{i}]"
  if not isinstance(x,dict) or set(x)!=KEYS:problems.append(issue("DUPLICATE_REVIEW_SCHEMA","<dataset>",f"{p} must have exact keys {sorted(KEYS)}"));continue
  checksum=x["checksum"]; affected=x["affectedBatches"]
  valid_strings=all(isinstance(x[k],str) and x[k].strip() for k in ("reviewer","date","rationale"))
  if not isinstance(checksum,str) or not HEX.fullmatch(checksum) or not isinstance(affected,list) or not affected or any(not isinstance(v,str) or not v for v in affected) or len(set(affected))!=len(affected) or not valid_strings or x["resolution"] not in ("remove","regroup","accepted"):
   problems.append(issue("DUPLICATE_REVIEW_SCHEMA","<dataset>",f"{p} contains invalid values"));continue
  try:date.fromisoformat(x["date"])
  except ValueError:problems.append(issue("DUPLICATE_REVIEW_SCHEMA","<dataset>",f"{p}.date must be ISO date"));continue
  expected=tuple(sorted({v[0] for v in dups.get(checksum,())})); actual=tuple(sorted(affected))
  if checksum in out:problems.append(issue("DUPLICATE_REVIEW_SCHEMA","<dataset>",f"duplicate review {checksum}"));continue
  if not expected or actual!=expected:problems.append(issue("DUPLICATE_REVIEW_STALE","<dataset>",f"{checksum}: affectedBatches={actual}, current={expected}"));continue
  out[checksum]=DuplicateReview(checksum,actual,x["reviewer"],x["date"],x["rationale"],x["resolution"])
 return out,problems

def eligibility(raw:Path,labels:Path,reviews_path:Path):
 report=validate_dataset(raw,labels); reviews,problems=load_reviews(reviews_path,report.duplicate_blobs)
 bad={x.batch_id for x in report.issues if x.code!="DUPLICATE_BLOB"}; candidates=set()
 try: dirs=sorted((p for p in raw.iterdir() if p.is_dir()),key=lambda p:p.name)
 except OSError:return set(),reviews,report,problems
 for d in dirs:
  if d.name in bad:continue
  try:
   label=load_label(labels/f"{d.name}.json"); manifest=load_manifest(d/"manifest.json")
  except Exception:continue
  if label.status=="complete" and manifest.images_new:candidates.add(d.name)
 members={b for xs in report.duplicate_blobs.values() for b,_,_ in xs}; eligible=candidates-members
 for checksum,xs in report.duplicate_blobs.items():
  group={v[0] for v in xs}; review=reviews.get(checksum)
  if review and review.resolution in ("regroup","accepted") and group<=candidates:eligible.update(group)
 return eligible,reviews,report,problems

def write_set(root:Path,values:Mapping[str,list[str]])->None:
 root.mkdir(parents=True,exist_ok=True); dest={n:root/f"{n}.txt" for n in NAMES}
 existing=[str(p) for p in dest.values() if p.exists()]
 if existing:raise FileExistsError(f"refusing to overwrite existing split files: {existing}")
 temps={}; committed=[]
 try:
  for n in NAMES:
   p=root/f".{n}.txt.tmp.{os.getpid()}.{os.urandom(6).hex()}"
   with p.open("x",encoding="utf-8",newline="\n") as f:f.write("".join(f"{b}\n" for b in values[n]));f.flush();os.fsync(f.fileno())
   temps[n]=p
  if any(p.exists() for p in dest.values()):raise FileExistsError("split destination appeared during staging")
  for n in NAMES:os.rename(temps[n],dest[n]);committed.append(dest[n])
  fd=os.open(root,os.O_RDONLY)
  try:os.fsync(fd)
  finally:os.close(fd)
 except Exception:
  for p in committed:
   try:p.unlink()
   except OSError:pass
  raise
 finally:
  for p in temps.values():
   try:p.unlink()
   except OSError:pass

def create_splits(raw_root:Path,labels_root:Path,splits_root:Path,duplicate_reviews:Path,*,seed:int,train_count:int,dev_count:int,final_count:int)->SplitValidation:
 counts={"train":train_count,"dev":dev_count,"final":final_count}
 if any(v<0 for v in counts.values()):raise ValueError("split counts must be non-negative")
 eligible,reviews,report,review_issues=eligibility(Path(raw_root),Path(labels_root),Path(duplicate_reviews))
 roots=[x for x in report.issues if x.batch_id=="<dataset>" and x.code!="DUPLICATE_BLOB"]
 if roots or review_issues:raise ValueError("unresolved dataset/review issues: "+"; ".join(x.detail for x in roots+review_issues))
 if sum(counts.values())!=len(eligible):raise ValueError(f"requested {sum(counts.values())} batches but exactly {len(eligible)} are eligible")
 ordered=sorted(eligible);random.Random(seed).shuffle(ordered);a=train_count;b=a+dev_count
 values={"train":ordered[:a],"dev":ordered[a:b],"final":ordered[b:]}; placement={x:n for n,xs in values.items() for x in xs}
 for r in reviews.values():
  if r.resolution=="regroup" and len({placement[x] for x in r.affected_batches})!=1:raise ValueError(f"regroup review {r.checksum} would cross partitions")
 write_set(Path(splits_root),values)
 return validate_splits(raw_root,labels_root,splits_root,duplicate_reviews,train_count=train_count,dev_count=dev_count,final_count=final_count)

def read_split(path:Path):
 try:lines=path.read_text(encoding="utf-8").splitlines()
 except (OSError,UnicodeError) as e:return [],[issue("SPLIT_FILE","<dataset>",f"cannot read {path}: {e}")]
 problems=[];seen=set()
 for x in lines:
  if not x:problems.append(issue("SPLIT_FILE","<dataset>",f"blank ID in {path.name}"))
  if x in seen:problems.append(issue("SPLIT_DUPLICATE_ID",x,f"duplicate ID in {path.name}"))
  seen.add(x)
 return lines,problems

def validate_splits(raw_root:Path,labels_root:Path,splits_root:Path,duplicate_reviews:Path,*,train_count:int=140,dev_count:int=30,final_count:int=30)->SplitValidation:
 expected={"train":train_count,"dev":dev_count,"final":final_count};eligible,reviews,report,problems=eligibility(Path(raw_root),Path(labels_root),Path(duplicate_reviews));issues=list(problems);values={}
 for n in NAMES:
  values[n],p=read_split(Path(splits_root)/f"{n}.txt");issues+=p
  if len(values[n])!=expected[n]:issues.append(issue("SPLIT_COUNT","<dataset>",f"{n}: expected {expected[n]}, got {len(values[n])}"))
 sets={n:set(values[n]) for n in NAMES}
 for i,left in enumerate(NAMES):
  for right in NAMES[i+1:]:
   for x in sorted(sets[left]&sets[right]):issues.append(issue("SPLIT_OVERLAP",x,f"present in {left} and {right}"))
 assigned=set().union(*sets.values())
 for x in sorted(assigned-eligible):issues.append(issue("SPLIT_INELIGIBLE",x,"not a valid, complete, reviewed eligible batch"))
 for x in sorted(eligible-assigned):issues.append(issue("SPLIT_OMISSION",x,"eligible batch absent from splits"))
 placement={x:n for n,xs in sets.items() for x in xs};accepted=[]
 for checksum,xs in report.duplicate_blobs.items():
  members={x[0] for x in xs};parts={placement[x] for x in members if x in placement};r=reviews.get(checksum)
  if len(parts)>1:
   if r is None:issues.append(issue("DUPLICATE_UNREVIEWED","<dataset>",f"{checksum} crosses {sorted(parts)}"))
   elif r.resolution=="regroup":issues.append(issue("DUPLICATE_REGROUP","<dataset>",f"{checksum} must remain together"))
   elif r.resolution=="remove":issues.append(issue("DUPLICATE_REMOVE","<dataset>",f"{checksum} batches must be excluded"))
   else:accepted.append(checksum)
  elif r and r.resolution=="accepted" and members<=assigned:accepted.append(checksum)
 return SplitValidation(not issues,{n:len(values[n]) for n in NAMES},tuple(sorted(issues,key=lambda x:(x.code,x.batch_id,x.detail))),tuple(sorted(set(accepted))))

def main(argv:list[str]|None=None)->int:
 p=argparse.ArgumentParser(description="Create and validate frozen fishing dataset splits");subs=p.add_subparsers(dest="command",required=True)
 for command in ("create","validate"):
  q=subs.add_parser(command)
  for flag in ("raw-root","labels-root","splits-root","duplicate-reviews"):q.add_argument(f"--{flag}",type=Path,required=True)
  q.add_argument("--train-count",type=int,default=140);q.add_argument("--dev-count",type=int,default=30);q.add_argument("--final-count",type=int,default=30)
  if command=="create":q.add_argument("--seed",type=int,required=True)
 a=p.parse_args(argv)
 try:
  kw=dict(train_count=a.train_count,dev_count=a.dev_count,final_count=a.final_count)
  result=create_splits(a.raw_root,a.labels_root,a.splits_root,a.duplicate_reviews,seed=a.seed,**kw) if a.command=="create" else validate_splits(a.raw_root,a.labels_root,a.splits_root,a.duplicate_reviews,**kw)
 except (OSError,ValueError) as e:print(f"error: {e}",file=sys.stderr);return 2
 print(f"valid={str(result.valid).lower()} train={result.counts['train']} dev={result.counts['dev']} final={result.counts['final']} issues={len(result.issues)} accepted_duplicates={len(result.accepted_duplicates)}")
 for x in result.issues:print(f"{x.code} {x.batch_id}: {x.detail}")
 for x in result.accepted_duplicates:print(f"ACCEPTED_DUPLICATE {x}")
 return 0 if result.valid else 2
if __name__=="__main__":raise SystemExit(main())
