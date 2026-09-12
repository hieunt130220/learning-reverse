# Auto Web UI Consistency — Design Spec

## Mục tiêu & Bối cảnh

UI web auto (`avatar-web/web`) đã hoạt động nhưng visual language bị phân mảnh (token gốc vs hex one-off trong Quests/Shop/TreePlan), trạng thái auto khó glance từ dashboard, feedback save/conflict chỉ là text rời, và log không filter. Spec này chuẩn hóa UI **không đổi thẩm mỹ tổng thể** — vẫn dark ops tool, chỉ gắn hệ thống cho nhất quán và glanceable.

## Phạm vi

**In-scope**
- Token CSS thống nhất + StatusBadge đủ trạng thái + button focus/hover
- Dashboard account card: mode chip + cycle + notice rõ hơn
- AutoFarm: sticky save bar + section dirty marker + StatusBanner
- StatusPanel: dùng StatusBanner thay `.err`/`.hint` rời
- LogPanel: ô lọc substring + đếm kết quả
- Shared `StatusBanner` component

**Out-of-scope**
- Đổi brand/light theme/component library
- API mới (dirty-plan on dashboard cần server — bỏ qua)
- QuestsPanel redesign (chỉ map màu về token nếu chạm CSS)
- Backend/auto logic

## Kiến trúc & Files

| File | Vai trò |
|---|---|
| `avatar-web/web/src/styles.css` | Token mở rộng, badge đủ state, sticky save, status-banner, log filter, focus/hover |
| `avatar-web/web/src/accounts/StatusBanner.tsx` | **Create** — banner `info\|success\|warn\|error` + optional action |
| `avatar-web/web/src/accounts/AccountStatus.tsx` | Export `automationModeLabel` helper |
| `avatar-web/web/src/accounts/AccountCard.tsx` | Mode chip + cycle/last-run line |
| `avatar-web/web/src/accounts/panels/StatusPanel.tsx` | StatusBanner cho error/sync |
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | Section dirty + sticky save + StatusBanner |
| `avatar-web/web/src/accounts/panels/LogPanel.tsx` | Filter input + match count |

## Data contracts

- `AutomationSnapshot`: `desiredMode`, `activeMode`, `transitionState`
- `AutoState`: `running`, `cycle`, `lastRun`, `lastError`
- Dirty per-section: so sánh draft vs `storedState.config` (đã có logic `dirty` tổng)

## Verification Plan

1. `cd avatar-web/web && npm test` (existing suites)
2. `npm run build` typecheck
3. Manual checklist: token coverage, StatusBadge all states, sticky save visible while scroll, log filter works, focus-visible on buttons
