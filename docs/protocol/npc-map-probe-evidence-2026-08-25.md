# NPC map probe evidence — 2026-08-25

## Status

`area-catalog-verified; production-catalog-enabled; npc-target-pending` for
account 2, map 5 / area 7. This note is redacted diagnostic evidence; the
production catalog contains only the individually verified pair and does not
claim that a live NPC target was found.

## Candidate and static source

- Account: `2`
- Requested pair: `map=5`, `area=7`
- Native request position: `x=254`, `y=82`
- Position source: bundled AvatarHD 3.4.4 `CityMap` `PositionMap` entry for
  map 5 (`Công viên`), corroborated by `LoadMap.doJoin` disassembly copying
  `PositionMap.x/y` into `LoadMap.xJoinCasino/yJoinCasino`.
- Request body shape: `i8 roomID`, `i8 boardID`, `i16 x`, `i16 y` (six bytes).

The static asset is a candidate source, not live account state. The live claim
below comes only from the bounded probe response.

### Static CityMap catalog (package evidence only)

The bundled `CityMap` TextAsset (AvatarHD 3.4.4, version `11850`) contains a
188-byte `PositionMap` payload. The native field order is `id`, `idImg`, `x`,
`y`, UTF-8 text, `handler`, `idToMap`:

| id | name | x | y | handler | idToMap |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Khu sinh thái | 473 | 100 | 9 | 13 |
| 3 | Khu giải trí | 236 | 280 | 9 | 9 |
| 4 | Khu mua sắm | 452 | 250 | 9 | 23 |
| 5 | Công viên | 254 | 82 | 9 | 11 |
| 7 | Nông trại | 524 | 423 | 10 | 25 |
| 8 | Ngoại ô | 100 | 100 | 9 | 17 |
| 9 | Mê cung | 57 | 209 | 9 | 28 |

Reproducibility hashes: APK SHA-256
`401b17880bacd1270188bdfdbb8a3fa0f1ed6a78b6fd58d28c8780d639979f4e`; CityMap
TextAsset SHA-256 `e3fc3c1272d6d6f7e2ba100f9e7c408ced3dd496f2b326721b17c719e9d5d4da`.
This table is static package evidence; it is not a live area/NPC catalog.

### Legacy Auto Tìm NPC candidate catalog (package evidence only)

The older `avatar-auto.jar` contains a separate map-ID namespace used by its
Auto Tìm NPC routine. Its `P` class initializes the default candidate string
`1,2,3,5,6,7,8,9,11,23`, with the area cursor initialized to `0` and the end
cursor to `9`. The routine increments the area cursor through that inclusive
range for each configured map and wraps to the next map. Therefore `5/7` is a
legacy configured candidate, not a server-advertised area-list entry.

The same jar's fast-travel labels identify legacy map ID `5` as `Khu tài xỉu`
and legacy map ID `11` as `Khu công viên`. This is a different namespace from
the Unity `CityMap` node `id=5` above, whose `idToMap=11` and label is `Công
viên`. The two numbers must not be joined by numeric equality when building a
production catalog.

The complete static candidate projection is therefore:

| legacy map ID | label | area cursor |
| ---: | --- | --- |
| 1 | Khu quay số cũ | 0..9 |
| 2 | Khu đấu giá cũ | 0..9 |
| 3 | Khu ăn xin trái | 0..9 |
| 5 | Khu tài xỉu | 0..9 |
| 6 | Khu cô giáo | 0..9 |
| 7 | Dưới khu cô giáo | 0..9 |
| 8 | Khu 4 con vịt | 0..9 |
| 9 | Khu giải trí | 0..9 |
| 11 | Khu công viên | 0..9 |
| 23 | Khu mua sắm | 0..9 |

The area column is the legacy routine's configured scan range, not a live
server response; every row is package/history evidence only.

The legacy command writer also confirms the direct join wire shape: it writes
`i8 map`, `i8 area`, `i16 x`, and `i16 y` for the same join command. Reproduction
source is `avatar-jar/avatar-auto.jar` (SHA-256
`ae99ef9b69f065ae0a89ee80ad5217142eee5568b2f351fc35ee602ed53fe0b9`, 1,018,756
bytes). This is static historical evidence only; it does not prove that the
current server still exposes every map or area in that range.

## Live run

- Timestamp: `2026-08-25T06:46:53.895Z`
- Login reached `online` after the Park handler barrier. A preceding attempt
  at `06:38:57Z` failed before `LOGIN_SUCCESS`; a bounded diagnostic retry
  reached `online`, and this probe then completed normally.
- Redacted traffic contract:
  - one Park-context `TX -1 len=1`;
  - one direct-join `TX 80 len=6`;
  - one direct-join `RX 80 len=134`.
- Response metadata:

| Field | Value |
| --- | ---: |
| response room / board | 5 / 7 |
| response x / y | 254 / 82 |
| player layout | state18-native-list |
| list-player count | 2 |
| map marker | 0 |
| animation count | 0 |
| native special count | 0 |
| special names | `[]` |
| special section end | 114 |
| unread trailing bytes | 20 |

The response room/board and coordinates match the requested native join. The
native `GlobalMessageHandler` branch consumes the optional special count/list
then exits without reading the 21-byte suffix; the suffix is therefore not
promoted to catalog or NPC data.

## Guarded repeat

- Timestamp: `2026-08-25T07:02:31.115Z`
- The probe now rejects any map without a reviewed native position before
  opening the account database or socket. The authorized `2/5/7` invocation
  passed that guard and reproduced the live traffic contract: one Park-context
  `TX -1 len=1`, one `TX 80 len=6`, and one `RX 80 len=134`.
- The decoded response again reported `room/board=5/7`, `x/y=254/82`, two
  players, `animCount=0`, `specialCount=0`, `specialNames=[]`,
  `specialSectionEnd=114`, and `trailingBytes=20`.

This repeat strengthens the direct-join evidence and validates the coordinate
guard; it still does not produce an area enumeration or a live NPC name.

## Latest retry

- Timestamp: `2026-08-25T07:06:41.630Z`
- An initial retry at `07:06:20.840Z` stopped during login with
  `status=error` and sent no `cmd 80`. The immediate bounded retry reached
  `online` and reproduced the same single-join contract.
- The successful retry sent one Park-context `TX -1 len=1`, one direct-join
  `TX 80 len=6`, and received one `RX 80 len=134`.
- Response metadata again matched `room/board=5/7`, `x/y=254/82`,
  `listPlayerCount=2`, `animCount=0`, `specialCount=0`,
  `specialNames=[]`, `specialSectionEnd=114`, and `trailingBytes=20`.

This confirms the pair remains repeatable after a transient login failure; it
still does not add a live area or NPC catalog entry.

## Post-join event window

- Timestamp: `2026-08-25T07:16:30.494Z`
- The probe kept the authenticated socket open for `3,000 ms` after the
  `RX 80` response and retained all redacted traffic from that window.
- The direct join again returned `RX 80 len=134` with `room/board=5/7`,
  `x/y=254/82`, `specialCount=0`, `specialNames=[]`, and `trailingBytes=20`.
- No `RX 48` (`ITEM_MAP_SPECIAL`) arrived during the grace window. The only
  post-join packets were `RX -3 len=25` and `RX 85` (ordinary wallet/chat
  traffic), so neither is promoted to NPC evidence.

This closes the immediate asynchronous-event gap for this candidate; it still
does not prove an area enumeration or produce a live NPC name.

## Native RX48 decoder adjustment

The probe now captures and decodes `RX 48` instead of recording only its
command/length. Native `GlobalMessageHandler.onMessage` dispatches command
`0x30` at `0x5EDDDC`: it reads a leading `i8 mode`; modes `0`/`1` call
`AvatarData.readItemDataMapSpecial` (`0xA0C280`), while mode `2` reads an `i32`
ID and calls `removeItemDataMapSpecial` (`0xA0C704`). The upsert body is
verified as `i32 id`, UTF-8 name, `i32 x`, `i32 y`, `i8 type`, image-count plus
short image IDs, eight state-coordinate `i32` values, then menu-count plus
short menu IDs. The probe exposes only redacted metadata (`mode`, operation,
ID, name, x/y, type, array counts, and trailing length); it does not retain
packet bytes.

### Decoder-ready live retry

- Timestamp: `2026-08-25T07:31:09.332Z`
- The exact `2/5/7` invocation reached `online`, passed the Park handler
  barrier, sent one `TX 80 len=6`, and received one `RX 80 len=134`.
- The response again reported `room/board=5/7`, `x/y=254/82`, two players,
  `specialCount=0`, `specialNames=[]`, `specialSectionEnd=114`, and
  `trailingBytes=20`.
- The passive three-second window produced `mapSpecialUpdates=[]`; no `RX 48`
  arrived. The only post-join packets were `RX -3 len=25` and `RX 85 len=53`.

The decoder is therefore native-ready, but this run still contains no live
`ItemMapSpecial` name/location and cannot establish a dynamic NPC catalog.

## Native board-list catalog

The native `ParkService.doRequestBoardList(sbyte roomId)` path was verified from
the bundled client and its handler before this run. It sends `cmd 90` with one
signed byte. The native receive branch reads a signed count followed by that
many signed occupancy bytes and forwards the resulting array to
`Avatar.onParkList`; the UI selection index is then sent as the `boardID` for
`doJoinPark`. Therefore the live area labels below are **0-based UI indexes**,
not one-based names inferred from the legacy jar.

### Bounded live run

- Timestamp: `2026-08-25T07:47:19.723Z`
- Invocation: account `2`, requested `map=5`, `area=7`; one login/session,
  one board-list request, one direct join.
- Traffic evidence: `TX 90 len=1`, `RX 90 len=36`, `TX 80 len=6`,
  `RX 80 len=134`.
- Board-list decode: `status=observed`, `roomId=5`, `boardCount=35`, zero
  trailing bytes. All signed occupancy values were `2`:
  `0:2, 1:2, 2:2, 3:2, 4:2, 5:2, 6:2, 7:2, 8:2, 9:2, 10:2, 11:2,
  12:2, 13:2, 14:2, 15:2, 16:2, 17:2, 18:2, 19:2, 20:2, 21:2,
  22:2, 23:2, 24:2, 25:2, 26:2, 27:2, 28:2, 29:2, 30:2, 31:2,
  32:2, 33:2, 34:2`.
- Area 7 is therefore live-observed as the eighth 0-based board and had
  occupancy `2` at capture time.
- Direct-join response independently matched `room/board=5/7` and
  `x/y=254/82`; the RX80 prefix reported two players, `specialCount=0`,
  `specialNames=[]`, `specialSectionEnd=114`, and `trailingBytes=20`.
- The three-second passive window still produced no `RX 48`; the redacted
  projection is `mapSpecialUpdates=[]`. This run establishes the live area
  catalog for room 5, but not an NPC name/location catalog.

The occupancy list is a time-specific board-state observation. It does not
prove that occupancy `2` means two NPCs, nor does it authorize NPC interaction
or production automation.

## Production runtime acceptance

- Timestamp: `2026-08-25T15:06:33+07:00` (bounded account 2 session; output
  redacted immediately after the run).
- The production `GameClient` path—not the standalone raw probe—sent one Park
  context request and the native join `TX 80 len=6`; it received `RX 80
  len=134` and resolved the same `world-snapshot` waiter used by AutoFindNpc.
- Snapshot metadata: `playerId>0`, `roomId=5`, `boardId=7`, `x/y=254/82`,
  `specialCount=0`, `specialNames=[]`, `specialSectionEnd=114`,
  `totalBytes=134`, `trailingBytes=20`.
- Production catalog wiring now exports only `{ map: 5, area: 7 }` and passes
  it from `index.ts` into `SessionManager`. No unprobed area was added.

This verifies the production protocol/catalog path. Because the snapshot had
no `ItemMapSpecial`, the live target-found/tracking acceptance remains
pending and no NPC name is inferred from the suffix.

## Classification and gate

- Verified: login/context barrier, six-byte native join shape, map/area
  `5/7`, and CityMap position `(254,82)` on the live `RX 80` response. The
  server accepted the pair and returned `room/board=5/7`.
- Static map catalog: seven package entries above; map 5 is `Công viên` and
  its native `idToMap` is 11. The legacy bot's separate map-ID catalog labels
  server-map candidate 5 as `Khu tài xỉu`; this namespace distinction is now
  recorded above.
- Legacy candidate catalog: map IDs `1,2,3,5,6,7,8,9,11,23`, area range
  `0..9`; package evidence only, not a current server enumeration.
- Verified: a live board/area catalog for room 5 from `RX 90`: 35 areas,
  indexes `0..34`, with the captured occupancy vector recorded above; the
  requested area 7 is present and had occupancy 2.
- Production catalog: enabled with the single individually verified entry
  `{map:5, area:7}`; other RX90 indexes remain excluded until individually
  joined and decoded.
- Pending: live `ItemMapSpecial` names/locations and an independently decoded
  meaning for the 20-byte RX80 suffix. The native RX48 decoder is ready, but
  this run had no RX48 and no NPC (`specialCount=0`), so target-found/tracking
  acceptance remains pending.
- No `-24`, `-23`, `-21`, combat, menu, reward, or NPC-interaction command was
  sent by this candidate.
- The probe refuses unsupported map IDs rather than reusing the map-5
  coordinate. A negative preflight invocation for map `4` exited in the `cli`
  section with no traffic or events.
- Do not copy `{ map: 5, area: 7 }` into production catalog until the reviewed
  protocol-correction gate accepts the native `RX 80` evidence and the catalog
  requirements are met.

## Verification record

- `npm --prefix avatar-web/server run typecheck` — passed.
- `git diff --check` — passed.
- `gitnexus_detect_changes(scope="all")` — LOW risk, zero affected
  execution processes in the current index.
- Native RX48 decoder typecheck after the adjustment — passed.
- Latest exact retry `2/5/7` at `07:06:41.630Z` — successful direct-join
  response; the preceding `07:06:20.840Z` login failure produced no join.
- Post-join event-window retry `2/5/7` at `07:16:30.494Z` — 3-second passive
  window, no `RX 48`, only `RX -3` and `RX 85` after `RX 80`.
- Decoder-ready retry `2/5/7` at `07:31:09.332Z` — successful direct join,
  `mapSpecialUpdates=[]`, no `RX 48` in the three-second window.
- Board-list catalog run `2/5/7` at `07:47:19.723Z` — `TX 90 len=1`,
  `RX 90 len=36`, strict count/occupancy decode (`35` areas, `0..34`),
  followed by the verified direct join; no `RX 48`.
- Production runtime acceptance `2/5/7` at `15:06:33+07:00` — native
  `TX 80 len=6`/`RX 80 len=134` resolved the AutoFind world-snapshot path;
  `specialCount=0`, no live target.

No raw packet body, hex, player/NPC name, credential, host, port, or token is
retained here.
