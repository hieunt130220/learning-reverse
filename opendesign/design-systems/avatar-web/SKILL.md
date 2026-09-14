# Avatar Web Design System — Skill

Dark-only ops console. Source of truth: `avatar-web/web/src/styles.css`.
Tokens: `tokens/colors_and_type.css`. Always use `var(--*)`, never hardcode hex.

## Tokens

Surfaces: `--bg #10131a`, `--bg-raised #0d1017`, `--bg-deep #0a0d12`,
`--card #171b24`, `--card-muted #161b22`, `--card-inset #111722`.
Lines: `--line #262c38`, `--line-soft #1e2430`.
Text: `--fg #e5e9f0`, `--muted #8b93a7`.
Accent: `--accent #6ea8fe` + `--accent-dim`.
Status: `--ok #4ec9a0` / `--warn #e3b341` (`--warn-ink #e4bb61`) / `--err #ff7b72`,
each with `-dim` wash and `-line` border.
Tidy adds: `--gold #ffd700`, `--gold-deep #ff9f1c`, `--tab-active #21262d`,
`--log-op #d2a8ff`, `--skip #ffbc76`.
Radii: 6 / 8 / 10 / 12 px, pill 999px. `color-scheme: dark`.

## Type

Base `14px/1.5 system-ui`. H1 20px/700. H2 14px uppercase, ls .06em, muted.
Labels 13px muted. Small 12px, caption 11px. Mono (`ui-monospace`) for
logs, hex dumps, chips. Touch targets ≥ 40px on coarse pointers.

## Components

Buttons (`.card` scope `styles.css:136-167`): primary filled `--accent` bg,
`#0d1017` text, 600 weight, 6px radius, `brightness(1.08)` hover.
Ghost: transparent, `--line` border, 400 weight, inherits text color.
Active segmented (`.tab.active`, `.automation-mode-button.active`):
`--accent` fill. Tabs row (`.drawer-tabbar button`): underline style —
transparent bg, 2px transparent bottom border, `--accent` when active.
Disabled: `opacity .4`, `cursor not-allowed`. Focus-visible: 2px `--accent` outline.

Badges (`.badge`, `styles.css:266-296`): pill, 12px, `--line` border, muted.
States: online (ok border + dim bg), connecting/handshaking/logging-in
(accent), error (err). `badge--star`: gold text on gold wash.
Do not invent new badge hues — reuse the three statuses + gold.

Status banners (`.status-banner--info/success/warn/error`,
`styles.css:428-477`): inset bg, 6px radius, 13px text; border + wash follow
the status color; text stays `--fg` except success (ok), warn (warn-ink),
error (err). Ghost button inside uses `currentColor` border.

Mode chips (`.mode-chip`, `styles.css:480-509`): 12px/600 pill.
farm/fishing → accent; switching → warn; off → muted.

Cards (`.card`, `styles.css:91-96`): `--card` bg, `--line` border, 10px radius,
16px padding. Account cards: 12px radius, clickable main area with
`rgba(110,168,254,.06)` hover. Setting sections (`.setting-section`): 8px
radius, `rgba(255,255,255,.02)` bg. Do not add left-border accent strips.

Dialogs (`styles.css:654-739`): modal centered 480px max, drawer right-docked
720px max full-height; `rgba(3,6,12,.72)` backdrop; 160ms fade / 200ms
slide-in; honor `prefers-reduced-motion`. Drawer tabbar scrolls horizontally,
scrollbar hidden.

Tables (`.shop-table`, `.auto-sell-rules-table`): inset header, 11px uppercase
muted th, row hover `rgba(255,255,255,.025)`. Below 680px: thead hides, rows
become cards, cells show `data-label` via `::before`. Always add `data-label`
to every td. Danger action text uses `--err`.

Tree-plan grid (`.tree-plan-grid/cell`): 4 cols mobile → 8 cols ≥680px,
66px min-height cells, inset bg. States: default (dashed muted),
skip (`--skip` border/text), seed (ok), invalid (err + inset ring).
Selected palette item: `--accent` inset ring.

Quests (`.quests-panel`, `styles.css:991+`): raised panel, segmented tab nav
on `--card-muted` with `--tab-active` active surface. Daily meter 8px bar,
gold→`--gold-deep` fill. Milestone cards: claimable = warn border + glow,
claimed = ok border at 60% opacity. Mission cards done → ok border + dim bg.
Reward pills: accent wash normally, gold wash for progress rewards.

Shop transactions (`.shop-transaction`): inset card with `::before` status
dot — `✓` ok, `×` err, `?` warn, `…` pending. Border follows status.

Log viewer (`.log`): mono 12px, 320px max scroll, soft dividers.
TX dir = accent, RX dir = ok, opcode names = `--log-op`, hex = muted.

## Voice and tone

Vietnamese-first UI copy (panels, hints, errors). Labels are terse
imperatives or nouns; hints (`12px muted`) explain consequences, not mechanics.
Error text states cause + fix, no apologies. Numbers use locale grouping for
xu/amounts.

## Responsive

Breakpoints 680px and 1100px. App shell max 1400px, 12px → 20px padding.
Accounts grid 1 → 2 → 3 cols. Tables collapse to cards (see above).
Inputs are 16px on mobile (no iOS zoom), inherit size on desktop.
Coarse pointers: 40px min-height on buttons, tabs, inputs.

## Motion

160ms dialog fade, 200ms drawer slide, 300ms meter fills, 1.5s alternate
pulse-glow on claim buttons only. Never animate layout properties.
`prefers-reduced-motion: reduce` disables dialog/drawer animation.

## Iconography

No icon font, no SVG sprite. Status is carried by color + 1-char glyphs
(`✓ × ? …`) and emoji in quest/shop labels — the brand does use emoji
there, so emoji-as-label is allowed, emoji-as-chrome is not.

## Known drifts (tsx inline, map to token)

- `#58a6ff` / `rgba(88,166,255,*)` → `--accent` / `--accent-dim`
- `#3fb950` / `rgba(63,185,80,*)` → `--ok` / `--ok-dim`
- `#1d2430`, `#12161d`, `#161b22` panel bgs → `--card` / `--card-muted`
- `#ffd700` gold washes → `--gold`; `#ffbc76` → `--skip`
- `#d2a8ff` opnames → `--log-op`; `#21262d` tab surface → `--tab-active`
- `rgba(255,0,0,0.08)` debug wash → `--err-dim`; `rgba(255,255,255,0.02)` → keep as-is (elevation, not status)
