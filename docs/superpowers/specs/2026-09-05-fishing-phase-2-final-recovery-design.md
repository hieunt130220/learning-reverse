# Fishing Phase 2 Final Recovery Design

## Mục tiêu & Bối cảnh

Recovery cycle này xử lý lần chạy final one-shot đã được phê duyệt nhưng dừng trước khi mở final split vì frozen Git revision trong transfer bundle khác revision hiện tại. Lần chạy đã kết thúc với exit code `2`, stderr `error: frozen Git revision does not match current revision`, không tạo `final-evaluation.lock`, `final-evaluation.json`, hoặc `gate-final.json`.

Mục tiêu là sửa quy tắc provenance cho đúng transfer bundle đã được xác thực, đồng thời làm chặt one-shot boundary: lock phải được tạo bền vững ngay trước thao tác đầu tiên có thể đọc final split và không bao giờ bị xóa sau thời điểm đó. Sau khi production code và verification hoàn tất, một recovery invocation riêng chỉ được chạy khi user phê duyệt tức thời đúng một lần.

Trạng thái bất biến của recovery:

- Approved gate SHA-256: `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.
- Gate approval: `approvedAt: 2026-09-05T04:33:21Z`, `approvedBy: hieunt`.
- Recorded transfer revision: `8ca1f93990dcd06a0b7d6ee6251100e67a155365`.
- Current recovery revision: `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288`.
- Hai revision trên là cặp tương thích duy nhất được chấp nhận trong recovery này.
- Selected run, checkpoint digest, dataset manifest digest và các artifact digest đã ghi trong selection/result ledger không được thay đổi.

## Phạm vi

### In scope

- Tập trung hóa việc so khớp provenance revision vào một module không tạo circular dependency.
- Chấp nhận revision giống hệt hoặc đúng cặp transfer revision đã duyệt; mọi revision khác tiếp tục bị từ chối.
- Áp dụng cùng quy tắc cho selection/freeze validation, dev/final evaluation và frozen inference service dùng cho replay.
- Sắp xếp lại final evaluation để tạo durable lock ngay trước thao tác đầu tiên có thể đọc final split.
- Giữ lock sau mọi kết quả xảy ra kể từ lúc final split có thể đã được mở, kể cả validation/evaluation/publication failure.
- Ghi rõ trạng thái lần chạy trước và mọi kết quả recovery vào results ledger và handover.
- Chỉ cho phép replay, service evidence và các bước tiếp theo nếu recovery final evaluation thành công và toàn bộ identity bất biến vẫn khớp.

### Out of scope

- Không huấn luyện lại, chọn lại run, thay checkpoint, thay dataset, thay threshold hoặc sửa approved gate.
- Không nới compatibility thành prefix, ancestor, branch hoặc danh sách revision mở rộng.
- Không thay đổi revision checks dùng khi tạo artifact mới trong `train.py` hoặc `artifacts.freeze_run`.
- Không chạy final evaluation, replay, live shadow, TX43 hoặc gameplay mutation trong giai đoạn Spec/Plan/implementation.
- Không commit, push hoặc merge nếu user không yêu cầu riêng.

### Inputs

- Transfer bundle và restored artifacts đã được kiểm hash.
- `artifacts/phase2-selection.json` và frozen run mà nó tham chiếu.
- Approved gate có SHA-256 nêu trên.
- Evidence của lần final invocation trước trong results ledger.

### Outputs

- Production code có một provenance compatibility contract dùng chung.
- Final evaluation có durable one-shot boundary trước lần đọc final đầu tiên.
- Automated verification được chạy sau production code nếu user cho phép cập nhật test.
- Preflight mới chứng minh identities, gate, working tree và absence/presence của final outputs trước khi xin quyền recovery invocation.
- Nếu recovery invocation được user phê duyệt sau này: đúng một process invocation, kết quả và hashes được ghi vào ledger.

### Edge cases

- Exact current revision tiếp tục hợp lệ mà không cần allowlist.
- Chỉ một đầu của approved pair khớp, revision rỗng hoặc revision thứ ba đều bị từ chối.
- Lỗi xảy ra trước khi tạo lock không được coi là đã mở final split.
- Từ lúc lock được tạo, mọi exception phải để lock tồn tại; recovery plan vẫn coi invocation đã tiêu thụ dù lỗi xảy ra trước hay sau lock.
- Final report đã tồn tại hoặc lock đã tồn tại phải chặn invocation mới.
- Publication một phần không được cho phép overwrite/no-replace semantics hiện có.
- Replay phải dùng cùng selected run, checkpoint digest và compatibility contract với final evaluation.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Lựa chọn thiết kế

Tạo `src/fishing_ml/provenance.py` làm dependency leaf chứa contract so khớp revision. Việc lặp allowlist trong nhiều module dễ lệch hành vi; import helper từ `experiments.py` sẽ tạo coupling sai chiều và nguy cơ circular dependency. Module riêng cho phép `experiments.py`, `evaluate.py` và `inference_service.py` dùng chung một implementation nhỏ, auditable.

Compatibility contract:

1. Trả về hợp lệ khi recorded revision bằng current revision.
2. Nếu khác nhau, chỉ trả về hợp lệ khi cặp có thứ tự `(recorded, current)` bằng đúng transfer pair đã duyệt.
3. Không suy diễn quan hệ Git và không chấp nhận revision gần giống.

### Files/modules

- Create `avatar-web/fishing-ml/src/fishing_ml/provenance.py`
  - Chứa immutable approved transfer pair và hàm so khớp revision dùng chung.
- Modify `avatar-web/fishing-ml/src/fishing_ml/experiments.py`
  - Bỏ helper riêng hiện tại; dùng contract chung cho candidate, selection và frozen provenance validation.
- Modify `avatar-web/fishing-ml/src/fishing_ml/evaluate.py`
  - Dùng contract chung cho dev/final frozen revision checks.
  - Di chuyển durable lock tới ngay trước thao tác đầu tiên có thể đọc final split.
  - Không unlink lock trong exception path sau khi final boundary đã bắt đầu.
- Modify `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`
  - Dùng contract chung khi load frozen matcher để replay không bị chặn bởi cùng transfer pair.
- Modify existing tests and, only with explicit user authorization, create a focused recovery test file if no existing file has an appropriate scope.
- Modify `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md`
  - Append-only recovery evidence, command status and hashes.
- Modify `docs/handoffs/2026-09-05-fishing-phase-2-final-and-replay-handover.md`
  - Ghi trạng thái recovery và remaining gates.

### Interfaces và data contracts

Provenance module cung cấp một predicate thuần nhận `recorded_revision: str` và `current_revision: str`, trả về `bool`. Các caller vẫn chịu trách nhiệm phát sinh error phù hợp với CLI/service context.

Final evaluation flow sau sửa:

```text
check output/lock absence
  -> validate freeze metadata and revision without final access
  -> load model/config without final access
  -> create durable final-evaluation.lock atomically
  -> verify dataset / open final split
  -> evaluate
  -> publish final report no-replace
  -> retain lock permanently
```

Mọi exception trước lock có thể trả lỗi mà chưa chạm final. Mọi exception sau lock trả lỗi và giữ lock. Lock payload phải đủ để audit invocation identity và thời điểm bắt đầu final boundary.

### Recovery invocation policy

Lần invocation trước là process invocation thứ nhất nhưng đã dừng trước final boundary. Recovery cycle không tự động cấp quyền chạy lại. Sau khi Spec, Plan, production code, tests và preflight hoàn tất, agent phải xin một phê duyệt tức thời mới cho đúng một recovery invocation.

Recovery invocation được coi là đã tiêu thụ ngay khi process được khởi chạy, bất kể lỗi xảy ra trước hay sau lock. Không có invocation thứ ba trong recovery plan. Nếu lock được tạo, trạng thái kỹ thuật cũng phải chặn tuyệt đối mọi lần chạy tiếp theo.

## GitNexus Impact Assessment

Graph context cho thấy:

- `evaluate_final_once` được gọi từ CLI `evaluate.main` và `experiments.confirm_final_once`; nó gọi dataset verification, freeze verification, final loading, lock creation, evaluation và publication.
- `load_frozen_matcher` được gọi từ inference service `serve`.
- `evaluate_run` được gọi từ `evaluate.main` cho dev evaluation.

Vì helper mới là dependency leaf và các revision checks chỉ đổi policy cho một cặp cố định, blast radius được giới hạn tại experiment orchestration, evaluation và inference loading. Trước mỗi production edit, Plan phải chạy GitNexus impact cho symbol cụ thể. Trước bất kỳ commit nào, nếu được yêu cầu, phải chạy `detect-changes --scope all` và xử lý mọi kết quả partial/truncated.

## Verification Plan

Verification được thực hiện sau production code, không theo TDD:

1. Static checks: compile/import và `git diff --check`.
2. Focused tests cho:
   - exact revision match;
   - approved transfer pair;
   - reversed/unapproved/empty revisions bị từ chối;
   - experiments, evaluate và inference service dùng cùng contract;
   - pre-lock failure không tạo lock và không mở final;
   - lock được tạo trước thao tác có thể đọc final;
   - post-lock validation/evaluation/publication failure vẫn giữ lock;
   - existing final report hoặc lock chặn invocation.
3. Chạy focused existing Phase 2 suite đã được user cho phép.
4. Chạy GitNexus change analysis trước commit nếu user yêu cầu commit.
5. Fresh preflight đọc-only:
   - xác minh gate hash/approval;
   - xác minh selection, checkpoint, manifest và frozen identities;
   - xác minh working tree chỉ có controlled changes đã review;
   - xác minh final report/lock state;
   - xác minh command exact và output destinations.
6. Dừng để xin user phê duyệt tức thời cho đúng một recovery invocation. Không chạy final trong cùng lượt preflight.

Tests không được tạo hoặc sửa cho tới khi user phê duyệt rõ ràng quyền cập nhật tests trong recovery cycle này.

## User Review Gate

User cần duyệt Spec này trước khi tạo Implementation Plan. Việc duyệt Spec không tự động cấp quyền chạy final recovery invocation; quyền đó chỉ được xin lại sau khi implementation và preflight hoàn tất.
