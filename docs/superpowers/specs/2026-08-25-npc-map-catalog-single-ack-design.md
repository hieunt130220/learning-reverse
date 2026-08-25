# NPC Map Catalog Single-ACK Probe Design

## Mục tiêu & Bối cảnh

Candidate gửi `TX -24 [0]` ngay sau khi chuyển sang handler Park nhưng không
nhận `RX -24`. Để tách lỗi ordering khỏi body/opcode, candidate này giữ nguyên
request city-map và thêm đúng một barrier: chỉ gửi `-24[0]` sau `RX -1[9]`
của request Park. Đây là probe bounded cho account 2 / map 5 / area 7, không
phải mapping production.

## Phạm vi

### In-scope

- Chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts`.
- Arm waiter trước `enterParkContext()`, nhận đúng `RX -1` có body handler Park,
  rồi gửi `TX -24 [0]`.
- Giữ decoder bounded cho `RX -24`, output metadata redacted và timeout 5 giây.
- Một invocation account 2 / map 5 / area 7.

### Out-of-scope

- Không gửi lại sequence immediate vừa thất bại.
- Không thêm handler request thứ hai, `80`, `-23`, `-21`, body khác, retry,
  reconnect hoặc sweep.
- Không sửa `GameClient`, server, database, production catalog hoặc mapping.
- `RX -57`, `RX -61`, timeout và các state packet khác không phải catalog
  evidence.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
login online
  -> arm handler waiter
  -> TX -1 [9] via enterParkContext()
  -> RX -1 [9] (barrier)
  -> arm catalog waiter
  -> TX -24 [0]
  -> RX -24 / catalog pending
```

The handler waiter checks only command `-1`, one-byte body length, and signed
handler value `9`; it never prints the body. It cleans up on resolve, timeout,
or abort. The catalog waiter is armed before `-24` and accepts evidence only
when the existing bounded decoder consumes the complete body with zero trailing
bytes.

## Data contract

- Required TX: one `park-context TX -1 len=1`, one `catalog-native TX -24
  len=1`.
- Required prerequisite: one `park-context RX -1 len=1` for handler 9.
- Required evidence: one `RX -24`, successful decode, and `trailingBytes = 0`.
- `requested.map` and `requested.area` remain input metadata only; this
  candidate does not claim their semantics.

## Verification Plan

1. Run GitNexus upstream impact for modified symbols; stop on HIGH/CRITICAL.
2. Run server typecheck, `git diff --check`, and a static scan that permits only
   `-1` and `-24` probe requests.
3. Confirm local Avatar Web health is refused and no probe process is running.
4. Run exactly one invocation for account 2 / map 5 / area 7.
5. Classify `catalog observed` only with the complete data contract; otherwise
   record `catalog pending` and send no follow-up command.
