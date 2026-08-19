# Tự động trồng lại ô vừa thu hoạch

## Mục tiêu & Bối cảnh

Sau khi thu hoạch, server giữ `idTree` và đánh dấu ô bằng `time = -1`. AutoFarm chỉ kiểm tra `idTree === -1` nên bỏ qua ô vừa thu hoạch và không trồng lại theo kế hoạch.

## Phạm vi

- In-scope: giai đoạn cây trong `AutoFarm.runCycle`.
- Out-of-scope: giao thức thu hoạch, UI kế hoạch, và các ô đang trồng bình thường.
- Edge case: ô rỗng thật (`idTree === -1`) và ô vừa thu hoạch (`isCellSpent(cell)`) đều được xem là có thể trồng; ô `skip` vẫn không trồng.

## Thiết kế kỹ thuật

Tái sử dụng `isCellSpent` từ decoder farm trong điều kiện planting: `idTree === -1 || isCellSpent(c)`. Không thay đổi payload `plantSeed` hay kế hoạch hạt.

## Verification Plan

- Chạy focused AutoFarm tests về harvest/replant và typecheck.
- Kiểm tra `git diff --check` và GitNexus detect changes.
