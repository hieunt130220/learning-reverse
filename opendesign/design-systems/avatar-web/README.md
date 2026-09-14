# Avatar Web Design System

Dark-only ops console for the Avatar farm automation web UI (`avatar-web/web`).
Cool neutral surfaces, one blue accent, green/amber/red status trio.

## Sources consulted

- `avatar-web/web/src/styles.css` (2187 lines, single source of truth — 24 `:root` vars + all component classes)
- `avatar-web/web/src/**/*.tsx` — 13 files with ~128 inline `style={{...}}` blocks (drift survey only, never edited)
- `avatar-web/web/package.json` — React 18.3.1, Vite 6, no CSS framework

## Index

- `tokens/colors_and_type.css` — canonical tokens (raw + semantic + type + motion)
- `SKILL.md` — portable usage guide: tokens, type, components, responsive, known drifts
- `preview.html` — interactive gallery (Task 3)

## Confidence

- Confident: 24 root tokens verbatim, button/badge/banner/chip/card/dialog/table/tree-plan/quests/shop/log patterns — all straight from `styles.css`.
- Unsure: inline tsx drifts (`#58a6ff`, `#3fb950`, `#1d2430`, `#12161d`) — mapped to nearest token, flagged in SKILL.md Known drifts.
- Confirm: tidy adds (`--gold`, `--gold-deep`, `--tab-active`, `--log-op`, `--skip`) — approve before canonical.
