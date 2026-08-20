# Avatar Farm Shop Purchase Enable Design

## Muc tieu va boi canh

Trang chi tiet tai khoan da co luong doc cho cmd 103, danh sach market, API giao dich va nut `Mua toan bo`. Backend cung da co cac lop bao ve cho live write: capability flags, account allowlist, idempotency key, snapshot revision, doi soat sau giao dich va trang thai `unknown` khi khong du bang chung.

Hien tai nut mua bi khoa vi runtime chi bat `SHOP_READ_ENABLED=true`; `SHOP_WRITE_ENABLED`, `SHOP_PURCHASE_ENABLED` va live account allowlist chua cho phep giao dich. Kieu allowlist hien tai chi nhan danh sach ID so, nen khong the bieu dat yeu cau moi: bat dang ban, rut hang va mua cho moi tai khoan hien co cung nhu tai khoan duoc them trong tuong lai.

Muc tieu cua thay doi la them mot cau hinh wildcard ro rang cho live account scope, bat cac capability da duoc user phe duyet, va giu nguyen tat ca guard an toan cua giao dich shop.

## Pham vi

### In scope

- Cho phep `SHOP_LIVE_ACCOUNT_ALLOWLIST=*` de ap dung live-write entitlement cho moi account.
- Giu tuong thich voi cau hinh allowlist dang danh sach ID duong, phan tach bang dau phay.
- Bat cac luong sau trong runtime configuration:
  - doc va browse shop;
  - dang ban nông san;
  - rut listing khoi sap;
  - mua toan bo listing market.
- Giu nut `Mua toan bo` theo ngu nghia hien tai: mua toan bo so luong cua listing, khong chon so luong mot phan.
- Giu confirmation truoc moi thao tac write.
- Giu backend tu choi voi `OPERATION_CONFLICT` khi AutoFarm hoac Macro dang chay; khong tu dong dung automation.
- Giu mo slot va market refresh tra phi o trang thai tat.
- Cap nhat tai lieu cau hinh lien quan neu can de wildcard khong bi hieu sai.

### Out of scope

- Mua mot phan listing.
- Thay doi opcode, wire payload hoac decoder cmd 103.
- Tu dong tat, tam dung hoac thay doi lich AutoFarm/Macro.
- Tu dong ket noi lai session de thuc hien giao dich.
- Tu dong retry transaction co ket qua `unknown`.
- Bat mo slot hoac market refresh tra phi.
- Thuc hien giao dich mua that trong automated verification.
- Tao test file moi; user khong yeu cau bo sung test.

## Input, output va edge cases

### Input configuration

`SHOP_LIVE_ACCOUNT_ALLOWLIST` chap nhan mot trong ba dang:

1. Bo trong hoac khong khai bao: khong account nao duoc phep live write.
2. Danh sach ID: vi du `2,5,9`, chi cac account nay duoc phep.
3. Wildcard chinh xac `*`: moi account hien tai va tuong lai duoc phep.

Whitespace bao quanh toan bo gia tri va quanh tung ID tiep tuc duoc trim. Wildcard khong duoc tron voi ID. Cac gia tri nhu `*,2`, `2,*`, `0`, ID am, decimal, token rong o giua hoac so vuot `Number.MAX_SAFE_INTEGER` phai lam server dung khoi dong voi loi cau hinh ro rang.

### Runtime output

- Moi account nhan `liveAccountAllowed=true` khi scope la wildcard.
- UI chi enable write khi session online, capability tuong ung bat, khong co transaction active va UI khong dang co request in-flight.
- Dang ban/rut listing can `SHOP_WRITE_ENABLED=true`.
- Mua listing can dong thoi `SHOP_WRITE_ENABLED=true` va `SHOP_PURCHASE_ENABLED=true`.
- `SHOP_SLOT_UNLOCK_ENABLED=false` va `SHOP_MARKET_REFRESH_ENABLED=false` tiep tuc khoa hai action tuong ung.

### Edge cases giao dich

- Session offline: tra `SESSION_OFFLINE`, khong gui packet.
- AutoFarm hoac Macro dang chay: tra `OPERATION_CONFLICT`, khong gui packet va khong thay doi automation.
- Co transaction shop khac dang active: tra conflict hien hanh, khong gui packet.
- Market/own-shop/produce revision da cu hoac listing khong con khop item, quantity, price, shop ID va version: tra stale error, khong gui packet.
- Idempotency key trung voi transaction da ton tai: tra lai transaction cu, khong gui packet lan hai.
- Mat ket noi hoac timeout sau khi packet da gui: giu xu ly `unknown`; khong retry tu dong.
- Doi soat sau mua khong thay listing/inventory nhu ky vong: tra `SHOP_PROTOCOL_ERROR` theo luong hien tai.

## Thiet ke kien truc va giai phap ky thuat

### 1. Bieu dien live account scope

`avatar-web/server/src/config.ts` mo rong kieu du lieu policy de phan biet hai trang thai:

- allowlist huu han gom cac account ID cu the;
- wildcard cho moi account.

Representation phai co type ro rang, khong dung sentinel ID va khong dung empty set de mang hai nghia. Huong de xuat la union `ReadonlySet<number> | 'all'` cho `liveAccountAllowlist`, vi no giu nguyen ten bien cau hinh va lam nhanh kiem tra entitlement de doc. Parser tra `'all'` chi khi toan bo gia tri sau trim bang `*`; neu co `*` trong danh sach token thi nem loi.

### 2. Kiem tra entitlement tai runtime boundary

`avatar-web/server/src/session/shopCoordinator.ts` tap trung phep kiem tra account vao mot helper policy nho, vi du `isLiveAccountAllowed()`. `assertWriteAllowed()` tiep tuc la runtime boundary bat buoc cho moi live write:

1. `SHOP_WRITE_ENABLED` phai bat.
2. Capability rieng cua action phai bat neu action co dedicated flag.
3. Account phai nam trong numeric allowlist hoac policy phai la wildcard.

Khong bo qua `assertOnlineAndIdle()`, `assertNoAutomation()`, revision validation, idempotency hoac transaction queue. Thay doi nay chi mo rong cach xac dinh account entitlement; khong lam yeu cac guard giao dich.

### 3. Capability truyen den UI

Runtime shop view tiep tuc tra `liveAccountAllowed` dang boolean. Khi policy la wildcard, moi account nhan `true`; khi policy la numeric allowlist, hanh vi cu duoc giu nguyen.

`avatar-web/web/src/accounts/panels/ShopPanel.tsx` khong can tao luong mua moi. Nut `Mua toan bo`, form dang ban va nut rut listing se duoc enable boi capability view hien co sau khi server khoi dong voi cac flag da phe duyet. Confirmation modal va body snapshot hien tai duoc giu nguyen.

Neu UI chua co du lieu de biet AutoFarm/Macro dang chay, nut co the van click duoc; backend phai tu choi truoc khi gui packet va UI phai hien message `OPERATION_CONFLICT: AutoFarm hoac Macro dang chay` qua error rendering hien co. Khong tu dong dung automation.

### 4. Runtime configuration

Cau hinh local cho muc tieu nay:

```dotenv
SHOP_READ_ENABLED=true
SHOP_WRITE_ENABLED=true
SHOP_PURCHASE_ENABLED=true
SHOP_LIVE_ACCOUNT_ALLOWLIST=*
SHOP_SLOT_UNLOCK_ENABLED=false
SHOP_MARKET_REFRESH_ENABLED=false
```

`SHOP_PROTOCOL_DEBUG_ENABLED` khong can bat. Cac secret va gia tri cau hinh khong lien quan khong duoc thay doi hoac ghi vao tai lieu/commit.

### 5. Files va vai tro

- `avatar-web/server/src/config.ts`
  - Mo rong data contract cho wildcard.
  - Parse va validate `SHOP_LIVE_ACCOUNT_ALLOWLIST`.
- `avatar-web/server/src/session/shopCoordinator.ts`
  - Dien giai wildcard tai runtime entitlement boundary.
  - Giu nguyen cac gate va transaction semantics hien co.
- `avatar-web/server/.env`
  - Bat read/write/purchase va wildcard cho runtime local.
  - File nay co the bi git ignore; khong dua secret vao commit.
- Tai lieu cau hinh hien co neu co vi du allowlist
  - Ghi ro `*` la explicit all-account live-write scope va khong duoc tron voi ID.
- `avatar-web/web/src/accounts/panels/ShopPanel.tsx`
  - Du kien khong can sua neu capability view hien co da enable dung cac action. Chi sua neu live verification cho thay UI gating khong phan anh policy server.

## Data flow

```text
SHOP_* env
  -> loadConfig()/parseAccountAllowlist()
  -> SessionManager ShopPolicy
  -> ShopCoordinator runtime capabilities
  -> GET /api/accounts/:id/shop
  -> ShopPanel enable/disable action
  -> user confirmation
  -> POST listing/withdraw/purchase with idempotency + expected snapshot
  -> assertWriteAllowed()
  -> assertOnlineAndIdle()/assertNoAutomation()
  -> validate exact snapshot
  -> send one cmd 103 write
  -> reconcile market/shop/inventory
  -> persisted transaction + UI update
```

## Error handling va safety

- Invalid wildcard/list syntax la startup configuration error, khong fallback sang allow-all hoac allow-none mot cach im lang.
- Capability tat tra `SHOP_CAPABILITY_DISABLED`.
- Automation dang chay tra `OPERATION_CONFLICT` truoc packet send.
- Stale snapshot tra stale error truoc packet send.
- Sau packet send, timeout/disconnect khong duoc xem la failed an toan de retry; transaction giu `unknown` theo contract hien co.
- UI bat buoc confirmation cho dang ban, rut va mua; `Mua toan bo` phai hien item, quantity va price trong prompt hien co.
- Khong log credential, master key, raw packet production hoac request body nhay cam.
- Automated verification khong click confirm de chi tieu xu hoac thay doi inventory.

## Verification plan

### Static/config verification

- Chay inline `loadConfig` harness cho:
  - env khong co allowlist;
  - numeric allowlist hop le;
  - wildcard `*`;
  - whitespace quanh wildcard;
  - wildcard tron voi ID;
  - malformed, zero, negative, decimal, empty token va overflow ID.
- Xac minh mot account ID bat ky khong co trong DB van duoc entitlement khi policy la wildcard, de bao dam tai khoan them trong tuong lai khong bi khoa.
- Chay server typecheck/build va web typecheck/build bang cac script hien co.

### Runtime/API verification

- Restart server bang cau hinh duoc phe duyet.
- Voi nhieu account, kiem tra shop capability view:
  - `readEnabled=true`;
  - `writeEnabled=true`;
  - `purchaseEnabled=true`;
  - `liveAccountAllowed=true`;
  - `slotUnlockEnabled=false`;
  - `marketRefreshEnabled=false`.
- Xac minh account moi hoac mot account ID ngoai numeric allowlist cu cung nhan entitlement qua wildcard.
- Xac minh khi AutoFarm/Macro dang chay, write request tra `OPERATION_CONFLICT` va khong tao packet write.

### Browser verification

- Khi session online, khong co transaction active va automation da dung:
  - form dang ban kha dung;
  - nut rut listing kha dung khi co listing;
  - nut `Mua toan bo` kha dung khi listing khop selected market item;
  - mo slot va refresh tra phi van bi khoa.
- Mo confirmation cua `Mua toan bo`, xac minh noi dung item/quantity/price, sau do cancel. Khong thuc hien giao dich that trong acceptance mac dinh.
- Neu user chu dong yeu cau live purchase sau implementation, thuc hien nhu mot buoc rieng voi listing user chon va confirmation tai thoi diem giao dich.

## Acceptance criteria

- `SHOP_LIVE_ACCOUNT_ALLOWLIST=*` khoi dong thanh cong va cho phep moi account qua live account gate.
- Numeric allowlist cu van hoat dong nhu truoc.
- Wildcard tron voi token khac bi tu choi ro rang.
- Dang ban, rut va mua duoc enable khi dung capability, online va idle.
- Mua van la mua toan bo listing, co confirmation va exact-snapshot guard.
- AutoFarm/Macro khong bi tu dong dung; request bi chan voi `OPERATION_CONFLICT` truoc packet send.
- Mo slot va paid refresh van tat.
- Khong co automated live purchase, khong chi tieu xu va khong thay doi inventory trong verification mac dinh.
- `AGENTS.md` va `CLAUDE.md` khong duoc stage hoac commit trong task nay.
