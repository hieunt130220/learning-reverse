// Packet logger/parser cho com.TeaM.Avatar — dump traffic đã giải mã theo Cmd_Message.
// Hook ở tầng Message: TX = Session_ME.sendMessage (trước mã hóa),
//                      RX = Session_ME.onRecieveMsg (đã giải mã).
// Build: npm run build:parser   → _parser.js
// Run:   frida -U -f com.TeaM.Avatar -l _parser.js
import "frida-il2cpp-bridge";
import { cmdName } from "./opcodes";

// Đọc mảng byte trong il2cpp (sbyte[]/byte[]) ra JS number[]
function readBytes(arr: Il2Cpp.Array<any> | any): number[] {
    const out: number[] = [];
    try {
        const len = arr.length;
        for (let i = 0; i < len; i++) out.push(arr.get(i) & 0xff);
    } catch (e) {}
    return out;
}

function hex(b: number[], max = 256): string {
    const n = Math.min(b.length, max);
    let s = "";
    for (let i = 0; i < n; i++) s += ("0" + b[i].toString(16)).slice(-2) + " ";
    if (b.length > max) s += `… (+${b.length - max})`;
    return s.trim();
}

function ascii(b: number[], max = 256): string {
    const n = Math.min(b.length, max);
    let s = "";
    for (let i = 0; i < n; i++) s += b[i] >= 0x20 && b[i] < 0x7f ? String.fromCharCode(b[i]) : ".";
    return s;
}

// Giải mã UTF-8 lenient (đủ cho modified-UTF-8 của Java: null=0xC0 0x80, BMP).
// Trả về {str, ok}: ok=false nếu gặp byte không hợp lệ.
function utf8(bytes: number[]): { str: string; ok: boolean } {
    let s = "", i = 0, ok = true;
    while (i < bytes.length) {
        const c = bytes[i];
        if (c < 0x80) { s += String.fromCharCode(c); i++; }
        else if ((c & 0xe0) === 0xc0 && i + 1 < bytes.length && (bytes[i + 1] & 0xc0) === 0x80) {
            s += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2;
        } else if ((c & 0xf0) === 0xe0 && i + 2 < bytes.length &&
                   (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80) {
            s += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3;
        } else { ok = false; break; }
    }
    return { str: s, ok };
}

// Tỉ lệ ký tự "đọc được" (chữ/số/dấu/khoảng trắng/unicode) — lọc chuỗi rác.
function textRatio(s: string): number {
    if (!s.length) return 0;
    let good = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c !== 0x7f)) good++;
    }
    return good / s.length;
}

// ---- Reader tuần tự theo kiểu Java DataInputStream (big-endian) ----
type FieldType = "i8" | "u8" | "bool" | "i16" | "u16" | "i32" | "i64" | "utf" | "bytes";
interface Field { t: FieldType; name?: string; len?: number } // len chỉ dùng cho 'bytes'

class Reader {
    p = 0;
    constructor(public b: number[]) {}
    rem(): number { return this.b.length - this.p; }
    u8(): number { return this.b[this.p++]; }
    i8(): number { const v = this.u8(); return v > 127 ? v - 256 : v; }
    u16(): number { const v = (this.b[this.p] << 8) | this.b[this.p + 1]; this.p += 2; return v; }
    i16(): number { const v = this.u16(); return v > 32767 ? v - 65536 : v; }
    i32(): number { let v = 0; for (let k = 0; k < 4; k++) v = (v << 8) | this.b[this.p++]; return v | 0; }
    i64(): bigint {
        let v = 0n; for (let k = 0; k < 8; k++) v = (v << 8n) | BigInt(this.b[this.p++]);
        return v >= (1n << 63n) ? v - (1n << 64n) : v;
    }
    utf(): string { const L = this.u16(); const c = this.b.slice(this.p, this.p + L); this.p += L; return utf8(c).str; }
    bytes(n: number): number[] { const c = this.b.slice(this.p, this.p + n); this.p += n; return c; }
}

// ---- Schema chính xác theo opcode (KEY = tên opcode trong Cmd_Message) ----
// Bổ sung layout thực khi đã đọc handler tương ứng trong dump.cs. Ví dụ mẫu bên dưới.
const SCHEMAS: Record<string, Field[]> = {
    // ---- LOGIN — ✓ XÁC MINH tại RVA (GlobalService @0x699xxx, GlobalMessageHandler @0x5E5FD4) ----
    // TX qua GlobalService: login()=cmd-33, login(imei)=cmd-32, requestRegister=cmd-30, getServerLoginInfo=cmd-87.
    LOGIN_ACC:       [{ t: "utf", name: "user" }, { t: "utf", name: "pass" }, { t: "utf", name: "version" }], // TX cmd-33 (login)
    LOGIN_IMEI:      [{ t: "utf", name: "imei" }],                                                             // TX cmd-32 (login imei)
    REQUEST_REGISTER:[{ t: "utf", name: "user" }, { t: "utf", name: "pass" }, { t: "utf", name: "introCode" }],// TX cmd-30 (requestRegister; email có thể ở path khác)
    LOGIN_FAIL:      [{ t: "utf", name: "message" }],                                                          // RX cmd-35 -> onLoginFail
    // RX cmd-34 LOGIN_SUCESS: header verified; sau đó là dữ liệu enter-world (list player + map items) -> auto.
    LOGIN_SUCESS:    [{ t: "i8", name: "flag" }, { t: "i32", name: "id" }, { t: "utf", name: "str" }],         // + phần map (readListPlayer/readMapItem…)
    VERSION:         [{ t: "utf", name: "version" }],

    // ---- NÔNG TRẠI (TX) — ✓ ĐÃ XÁC MINH tại RVA bằng disassembly (tools/iladis.py) ----
    // Width lấy từ chuỗi writeInt/writeByte/writeShort thực trong libil2cpp.so (KHÔNG phải đoán).
    // Ghi chú: nhiều tham số khai báo 'int' trong C# nhưng gửi bằng writeByte -> i8.
    PLANT_SEED:         [{ t: "i32", name: "idUser" }, { t: "i8", name: "indexCell" }, { t: "i8", name: "idSeed" }],   // doPlantSeed  cmd66
    TREE_HARVEST:       [{ t: "i32", name: "idFarm" }, { t: "i8", name: "indexCell" }],                               // doHervest    cmd64
    OPEN_LAND:          [{ t: "i32", name: "idFarm" }, { t: "i8", name: "typeBuy" }],                                 // doOpenLand   cmd60
    HARVEST_ANIMAL:     [{ t: "i32", name: "idFarm" }, { t: "i8", name: "index" }],                                   // doHarvestAnimal cmd54
    SELL_ANIMAL:        [{ t: "i32", name: "idFarm" }, { t: "i8", name: "iddb" }],                                    // doSellAnimal cmd53
    PRICE_ANIMAL:       [{ t: "i32", name: "idFarm" }, { t: "i8", name: "iddb" }],                                    // doRequestPriceAnimal cmd52
    BUY_ITEM:           [{ t: "i16", name: "id" }, { t: "i8", name: "n" }, { t: "i8", name: "typeShop" }],            // doBuyItem    cmd68 (money KHÔNG gửi)
    SELL_ITEM:          [{ t: "i16", name: "idItem" }, { t: "i32", name: "num" }],                                    // doSellItem   cmd67
    USING_ITEM:         [{ t: "i32", name: "idUser" }, { t: "i8", name: "indexCell" }, { t: "i16", name: "idItem" }],// doUsingItem  cmd65
    JOIN:               [{ t: "i32", name: "id" }],                                                                   // doJoinFarm   cmd69
    INVENTORY:          [{ t: "i32", name: "idFarm" }],                                                               // getInventory cmd70 (gửi 1 int)
    TRANSFER_MONEY:     [{ t: "i8", name: "type" }, { t: "i32", name: "money" }],                                     // doTransMoney cmd55
    UPDATE_FARM_CATTLE: [{ t: "i8", name: "type" }, { t: "i8", name: "typeMoney" }],                                  // doUpdateFarm cmd102
    UPDATE_FARM_FISH:   [{ t: "i8", name: "type" }, { t: "i8", name: "typeMoney" }],                                  // doUpdateFish cmd81
    UPDATE_LAND:        [{ t: "i8", name: "step" }, { t: "i8", name: "typeMoney" }],                                  // doUpdateLand cmd90
    UPDATE_STORE:       [{ t: "i8", name: "a" }, { t: "i8", name: "b" }, { t: "i8", name: "c" }],                     // doUpdateStore cmd94 (3 byte)
    OPEN_SHOP_FARM:     [{ t: "i8", name: "type" }, { t: "i8", name: "step" }, { t: "i16", name: "idItem" }],         // doOpenShop   cmd103
    STEAL:              [{ t: "i8", name: "step" }],                                                                  // doSteal      cmd96
    STEAL_INFO:         [{ t: "i8", name: "a" }],                                                                     // doStealInfo  cmd95
    STEAL_STORE:        [{ t: "i8", name: "a" }],                                                                     // doStealStore cmd97
    LICH_SU_BI_TROM:    [{ t: "i8", name: "a" }],                                                                     // doLichSuAnTrom cmd98
    FINISH_STARFRUIT:   [{ t: "i8", name: "a" }],                                                                     // doFinishStarFruit cmd83
    NAU_NHANH:          [{ t: "i8", name: "step" }],                                                                  // nauNhanh     cmd93
    GET_BIG_FARM:       [{ t: "i16", name: "id" }],                                                                   // getBigImage  cmd74
    GET_IMAGE_FARM:     [{ t: "i8", name: "a" }, { t: "i8", name: "b" }],                                             // getImageData cmd75
    GET_IMG_FARM:       [{ t: "i16", name: "id" }],                                                                   // doGetImgIcon cmd82
    GET_TREE_INFO:      [{ t: "i8", name: "a" }, { t: "i8", name: "b" }],                                             // getTreeInfo  cmd76
    SET_BIG_FARM:       [{ t: "i16", name: "index" }],                                                                // setBigData   cmd71
    // COOKING=91 là CONTAINER dùng chung: doCooking=[i8 sub, i8 num, i16 iD]; doHarvestCook=[i8 sub, i8, i8].
    //   Byte đầu là sub-action -> không đặt 1 schema; xem tools/iladis.py 0x5D2994 / 0x5D2C10.
    // doBuyAnimal(AnimalInfo, typeBuy) cmd51: serialize object -> không schema tĩnh.
    // Thêm: REQUEST_REGISTER, CHAT_TO, ...

    // ---- CÂU CÁ (TX qua ParkService) — ✓ XÁC MINH tại RVA ----
    // QUANG_CAU=41    doQuanCau     @0x71BBF0  body RỖNG
    // CAU_CA_XONG=44  doCauCaXong   @0x71BEB8  body RỖNG
    // START_CAU_CA=45 doStartFishing@0x71BF14  body RỖNG
    // CAU_THANH_CONG=43 doFinishFishing @0x71BC4C  body ĐỘNG (bool + i8 n + n×i8) -> decodeFinishFishing()
    //   -> 3 opcode rỗng không cần schema (len=0); 43 dùng decoder riêng vì có mảng độ dài động.
};

// ---- Schema cho chiều RX khi opcode dùng LẠI tên nhưng layout khác chiều TX ----
// Tra trước SCHEMAS khi dir==="RX"; không khớp thì rơi về SCHEMAS rồi autoDecode.
const SCHEMAS_RX: Record<string, Field[]> = {
    // Câu cá — ✓ XÁC MINH tại ParkMsgHandler$$onMessage @0x718DC8 (jump-table 0x14E3C90, cmd 41..46)
    QUANG_CAU:      [{ t: "i32", name: "idUser" }],                                   // cmd41 @0x719194 -> FishingScr.onQuanCau
    CAU_THANH_CONG: [{ t: "i32", name: "idUser" }, { t: "i16", name: "idFish" }],      // cmd43 @0x719574 -> onFinish(int,int) — idFish gửi i16
    CAU_CA_XONG:    [{ t: "i32", name: "idUser" }],                                   // cmd44 @0x719544 -> onCauCaXong
    // cmd45 @0x71951C -> onStartFishing(bool iss, string error): iss=true thì KHÔNG có utf theo sau
    START_CAU_CA:   [{ t: "bool", name: "iss" }],                                     // (nếu iss=false: phần dư là utf error)
    STATUS_FISH:    [{ t: "i32", name: "idUser" }, { t: "i8", name: "status" }],       // cmd46 @0x7194D4 -> onStatus
    INFO_FISH:      [{ t: "i32", name: "idUser" }, { t: "i8", name: "lv" }, { t: "i8", name: "perLv" },
                     { t: "i32", name: "numFish" }, { t: "i16", name: "idPart" }],     // cmd-111 @0x718E9C -> onInfo
    // CAN_CAU=79 (cá cắn câu) có 2 mảng byte[][] lồng nhau -> decodeCanCau(), không schema tĩnh.
};

function fmt(name: string | undefined, t: string, v: any): string {
    return `${name ? name + ":" : ""}${t}=${typeof v === "string" ? `"${v}"` : v}`;
}

// Decode theo schema; nếu còn dư byte thì auto-decode phần đuôi.
function schemaDecode(fields: Field[], b: number[]): string {
    const r = new Reader(b);
    const toks: string[] = [];
    try {
        for (const f of fields) {
            let v: any;
            switch (f.t) {
                case "i8": v = r.i8(); break;
                case "u8": v = r.u8(); break;
                case "bool": v = r.u8() !== 0; break;
                case "i16": v = r.i16(); break;
                case "u16": v = r.u16(); break;
                case "i32": v = r.i32(); break;
                case "i64": v = r.i64().toString(); break;
                case "utf": v = r.utf(); break;
                case "bytes": v = hex(r.bytes(f.len ?? r.rem())); break;
            }
            toks.push(fmt(f.name, f.t, v));
        }
    } catch (e) { toks.push("[schema lỗi/thiếu byte]"); }
    if (r.rem() > 0) toks.push(`| dư: ${autoDecode(b.slice(r.p))}`);
    return toks.join("  ");
}

// Gộp một run byte không phải chuỗi thành số nhiều byte (suy đoán, đánh dấu ~).
// Ưu tiên độ rộng lớn: 8→i64 nếu vừa khít; ngược lại greedy i32 khi còn ≥4, i16 khi còn 2, i8 cho lẻ.
// Dòng hex/ascii ở trên vẫn là ground-truth khi cần chia lại thủ công.
function collapseRun(run: number[], off: number): string {
    if (run.length === 0) return "";
    const r = new Reader(run);
    if (run.length === 8) {  // nhập nhằng: có thể là writeLong hoặc 2×writeInt → in cả hai
        const asLong = new Reader(run).i64().toString();
        const a = new Reader(run); const i1 = a.i32(), i2 = a.i32();
        return `@${off} ~i64=${asLong} (hoặc ~i32×2=[${i1},${i2}])`;
    }
    const toks: string[] = [];
    let pos = off;
    while (r.rem() >= 4) { toks.push(`@${pos} ~i32=${r.i32()}`); pos += 4; }
    if (r.rem() === 2 || r.rem() === 3) { toks.push(`@${pos} ~i16=${r.i16()}`); pos += 2; }
    while (r.rem() >= 1) { toks.push(`@${pos} ~i8=${r.i8()}`); pos += 1; }
    return toks.join("  ");
}

// Auto: writeUTF + gộp run số thành i16/i32/i64. Không có schema thì dùng hàm này.
function autoDecode(b: number[]): string {
    const toks: string[] = [];
    let i = 0, runStart = -1, run: number[] = [];
    const flush = () => { if (run.length) { toks.push(collapseRun(run, runStart)); run = []; runStart = -1; } };
    while (i < b.length) {
        let matched = false;
        if (i + 2 <= b.length) {
            const L = (b[i] << 8) | b[i + 1];
            if (L >= 2 && i + 2 + L <= b.length) {
                const chunk = b.slice(i + 2, i + 2 + L);
                const { str, ok } = utf8(chunk);
                if (ok && textRatio(str) >= 0.85) {
                    flush();
                    toks.push(`@${i} str[${L}]="${str}"`);
                    i += 2 + L; matched = true;
                }
            }
        }
        if (!matched) { if (runStart < 0) runStart = i; run.push(b[i]); i++; }
        if (toks.length > 200) { flush(); toks.push(`… (+${b.length - i} byte)`); return toks.join("  "); }
    }
    flush();
    return toks.join("  ");
}

// ---- Decoder RX lồng nhau cho gói FarmData (readFarmData @0x639438) — ✓ verify tại RVA ----
// Cấu trúc: i32 idFarm(-1=none); i8 nCell; nCell×{ i8 idTree; if idTree!=-1: cell(6 field) };
//           i8 nAnimal; nAnimal×animal(i32,i8,i8,i8,bool,bool,bool); rồi khối phụ (chưa map hết).
function decodeFarmData(b: number[]): string {
    const r = new Reader(b);
    const out: string[] = [];
    try {
        let nCell = 0;
        const idFarm = r.i32(); out.push(`idFarm=${idFarm}`);
        if (idFarm !== -1) {                       // -1 => bỏ qua cells/animals, nhảy thẳng tail
            nCell = r.i8(); out.push(`nCell=${nCell}`);
            for (let i = 0; i < nCell && r.rem() >= 1; i++) {
                const idTree = r.i8();
                if (idTree === -1) { out.push(`cell${i}{trống}`); continue; }
                const time = r.i16(), vit = r.i8(), her = r.i8();
                const arid = r.u8(), worm = r.u8(), grass = r.u8();
                out.push(`cell${i}{idTree=${idTree},time=${time},vit=${vit},her=${her},arid=${arid},worm=${worm},grass=${grass}}`);
            }
            if (r.rem() >= 1) {
                const nAnimal = r.i8(); out.push(`nAnimal=${nAnimal}`);
                for (let i = 0; i < nAnimal && r.rem() >= 7; i++) {
                    const a = r.i32(), b1 = r.i8(), b2 = r.i8(), b3 = r.i8(), f1 = r.u8(), f2 = r.u8(), f3 = r.u8();
                    out.push(`animal${i}{${a},${b1},${b2},${b3},${f1},${f2},${f3}}`);
                }
            }
        }
        // TAIL (luôn có): i8 A, i8 B, i16×7
        if (r.rem() >= 16) {
            const A = r.i8(), B = r.i8();
            const s7: number[] = []; for (let k = 0; k < 7; k++) s7.push(r.i16());
            out.push(`tail{A=${A},B=${B},shorts=[${s7.join(",")}]}`);
            // Loop1: mỗi cell 1 byte = CellFarm.level (0x5F)
            if (nCell > 0 && r.rem() >= nCell) {
                const lv: number[] = []; for (let i = 0; i < nCell; i++) lv.push(r.i8());
                out.push(`levels=[${lv.join(",")}]`);
            }
            // Khối cuối (khế/tính năng): i16 flag(0xc2) · i8 mode · i16 · 7×(i16,bool) · bool.
            // Có count-guard nên có thể lệch — bọc try, phần dư để autoDecode.
            if (r.rem() >= 3) {
                const flag = r.i16(), mode = r.i8();
                out.push(`extra{flag=${flag},mode=${mode}}`);
                const pairs: string[] = [];
                if (r.rem() >= 2) pairs.push(`s=${r.i16()}`);
                for (let k = 0; k < 7 && r.rem() >= 3; k++) pairs.push(`(${r.i16()},${r.u8()})`);
                if (r.rem() >= 1) pairs.push(`b=${r.u8()}`);
                if (pairs.length) out.push(`starfruit?[${pairs.join(" ")}]`);
            }
        }
        if (r.rem() > 0) out.push(`| còn ${r.rem()} byte (chưa map): ${autoDecode(b.slice(r.p))}`);
    } catch (e) { out.push("[decodeFarmData: thiếu byte]"); }
    return out.join("  ");
}
// ---- Decode 1 player (readListPlayer @0x5F8DE8, loop mỗi player) — ✓ verify tại RVA ----
// Thứ tự wire: i32 id · utf name · i8 nPart · nPart×i16 partId · rồi 15 field state.
function decodePlayer(r: Reader): string {
    const id = r.i32();
    const name = r.utf();
    const nPart = r.i8();
    const parts: number[] = [];
    for (let i = 0; i < nPart && r.rem() >= 2; i++) parts.push(r.i16());
    const st: number[] = [];
    // i16,i16,i8,i8,i8,i16,i8,i8,i16,i16,i16,i8,i16,i8,i8
    const widths = [2, 2, 1, 1, 1, 2, 1, 1, 2, 2, 2, 1, 2, 1, 1];
    for (const w of widths) { if (r.rem() < w) break; st.push(w === 2 ? r.i16() : r.i8()); }
    return `{id=${id},name="${name}",parts=[${parts.join(",")}],state=[${st.join(",")}]}`;
}
// readListPlayer: i8 nPlayer, rồi nPlayer × player.
function decodeListPlayerR(r: Reader): string {
    const n = r.i8();
    const out = [`nPlayer=${n}`];
    for (let i = 0; i < n && r.rem() >= 6; i++) out.push(`p${i}` + decodePlayer(r));
    return out.join(" ");
}
function decodeListPlayer(b: number[]): string {
    const r = new Reader(b);
    const s = decodeListPlayerR(r);
    return s + (r.rem() > 0 ? `  | dư ${r.rem()}b` : "");
}

// readMapItemType @0x5F9E1C: i8 nType, mỗi type { i8,i16,i8,i16,i16, i8 nPos, nPos×(i8 x,i8 y) }.
function decodeMapItemTypeR(r: Reader): string {
    const n = r.i8();
    const out = [`nType=${n}`];
    for (let i = 0; i < n && r.rem() >= 7; i++) {
        const a = r.i8(), b = r.i16(), c = r.i8(), d = r.i16(), e = r.i16();
        const nPos = r.i8(); const pos: string[] = [];
        for (let k = 0; k < nPos && r.rem() >= 2; k++) pos.push(`(${r.i8()},${r.i8()})`);
        out.push(`t${i}{${a},${b},${c},${d},${e},pos=[${pos.join("")}]}`);
    }
    return out.join(" ");
}
// readMapItem @0x5FA174: i8 nItem, mỗi item { i8,i8,i8,i8 }.
function decodeMapItemR(r: Reader): string {
    const n = r.i8();
    const out = [`nItem=${n}`];
    for (let i = 0; i < n && r.rem() >= 4; i++) out.push(`i${i}{${r.i8()},${r.i8()},${r.i8()},${r.i8()}}`);
    return out.join(" ");
}

// Đuôi map @0x5E7008: i8 nAnim, mỗi AnimItem { i16, i32, i32 }.
function decodeAnimListR(r: Reader): string {
    const n = r.i8();
    const out = [`nAnim=${n}`];
    for (let i = 0; i < n && r.rem() >= 10; i++) out.push(`a${i}{${r.i16()},${r.i32()},${r.i32()}}`);
    return out.join(" ");
}

// readItemDataMapSpecial @0xA0C280 — ✓ verify hết reads: i32,utf,i32,i32,i8, i8 nS1, nS1×i16,
//   8×i32, i8 nS2, nS2×i16. (Phần sau chỉ dựng ItemMapSpecial + orderVector, không đọc.)
function decodeMapSpecialR(r: Reader): string {
    const a = r.i32(), name = r.utf(), b = r.i32(), c = r.i32(), d = r.i8();
    const nS1 = r.i8(); const s1: number[] = [];
    for (let k = 0; k < nS1 && r.rem() >= 2; k++) s1.push(r.i16());
    const ints: number[] = []; for (let k = 0; k < 8 && r.rem() >= 4; k++) ints.push(r.i32());
    const nS2 = r.i8(); const s2: number[] = [];
    for (let k = 0; k < nS2 && r.rem() >= 2; k++) s2.push(r.i16());
    return `{a=${a},name="${name}",b=${b},c=${c},d=${d},s1=[${s1}],ints=[${ints}],s2=[${s2}]}`;
}
function decodeMapSpecialListR(r: Reader): string {
    const n = r.i8();
    const out = [`nSpecial=${n}`];
    for (let i = 0; i < n && r.rem() >= 15; i++) out.push(`sp${i}` + decodeMapSpecialR(r));
    return out.join(" ");
}

// Ghép gói enter-world (LOGIN_SUCESS cmd-34). Thứ tự @0x5E6F00 (best-effort, handler có nhánh).
function decodeEnterWorld(b: number[]): string {
    const r = new Reader(b);
    const out: string[] = [];
    try {
        out.push(`flag=${r.i8()}`, `id=${r.i32()}`, `str="${r.utf()}"`);
        out.push(`ab=[${r.i8()},${r.i8()}]`, `hdr=[${r.i16()},${r.i16()}]`);
        out.push("player{" + decodeListPlayerR(r) + "}");
        out.push(`s=${r.i16()}`);
        out.push("mapType{" + decodeMapItemTypeR(r) + "}");
        out.push("mapItem{" + decodeMapItemR(r) + "}");
        out.push("anim{" + decodeAnimListR(r) + "}");
        out.push("special{" + decodeMapSpecialListR(r) + "}");
    } catch (e) { out.push("[enter-world: lệch/thiếu byte]"); }
    if (r.rem() > 0) out.push(`| còn ${r.rem()}b: ${autoDecode(b.slice(r.p))}`);
    return out.join("  ");
}

// ---- Câu cá: 2 gói có thân độ dài động, không biểu diễn được bằng Field[] ----

// RX CAN_CAU=79 — ✓ verify tại ParkMsgHandler$$onMessage @0x718F68 (entry jump-table 0x14E3CA8[0]).
// i32 idUser; i16 idFish; i16 timeDelay; i8 n; n×{ i32 len; len byte }   // arrImg
// nếu available()>=1: i8 m; m×{ i32 len; len byte }                      // arrImgNew (có thể vắng)
// -> FishingScr.onCaCanCau(idUser, idFish, timeDelay, arrImg, arrImgNew)
function decodeCanCau(b: number[]): string {
    const r = new Reader(b);
    const out: string[] = [];
    const readArr = (label: string) => {
        const n = r.i8();
        const sizes: number[] = [];
        for (let i = 0; i < n; i++) { const len = r.i32(); r.bytes(len); sizes.push(len); }
        out.push(`${label}[${n}]=(len ${sizes.join(",") || "-"})`);
    };
    try {
        out.push(`idUser=${r.i32()}`, `idFish=${r.i16()}`, `timeDelay=${r.i16()}`);
        readArr("arrImg");
        if (r.rem() >= 1) readArr("arrImgNew"); else out.push("arrImgNew=null");
    } catch (e) { out.push("[can_cau: lệch/thiếu byte]"); }
    if (r.rem() > 0) out.push(`| còn ${r.rem()}b: ${autoDecode(b.slice(r.p))}`);
    return out.join("  ");
}

// TX CAU_THANH_CONG=43 — ✓ verify tại ParkService$$doFinishFishing @0x71BC4C.
// bool isF; i8 n; n×i8 index   (index = chuỗi phím mini-game từ FishingScr.listKeySend; 0xFF = chưa đặt)
function decodeFinishFishing(b: number[]): string {
    const r = new Reader(b);
    const out: string[] = [];
    try {
        out.push(`isF=${r.u8() !== 0}`);
        const n = r.i8();
        const idx: number[] = [];
        for (let i = 0; i < n; i++) idx.push(r.i8());
        out.push(`index[${n}]=[${idx.join(",")}]`);
    } catch (e) { out.push("[finish_fishing: lệch/thiếu byte]"); }
    if (r.rem() > 0) out.push(`| còn ${r.rem()}b: ${autoDecode(b.slice(r.p))}`);
    return out.join("  ");
}

// Command mang gói FarmData (RX). ⚠ CHƯA chắc — jump-table onMessage dùng dải 51..103.
// Chỉnh set này sau khi quan sát traffic thật (gói RX to, lồng cell/animal). Ứng viên: JOIN=69, GET_BIG_FARM=74.
const FARMDATA_CMDS = new Set<number>([61, 69]);  // ✓ verify: readFarmData gọi từ cmd 69 (JOIN) và 61

// Điểm vào: nếu 1 trong các tên ứng viên (ngăn bởi '|') có schema thì decode chính xác, không thì auto.
function smartDecode(b: number[], names?: string, dir?: string): string {
    if (names && dir === "RX") {
        for (const n of names.split("|")) if (SCHEMAS_RX[n]) {
            return `[schema ${n}/RX] ${schemaDecode(SCHEMAS_RX[n], b)}\n      auto  : ${autoDecode(b)}`;
        }
    }
    if (names) {
        for (const n of names.split("|")) if (SCHEMAS[n]) {
            // In kèm auto để đối chiếu — nếu width trong schema sai sẽ lệch ngay với dòng auto.
            return `[schema ${n}] ${schemaDecode(SCHEMAS[n], b)}\n      auto  : ${autoDecode(b)}`;
        }
    }
    return autoDecode(b);
}

// sbyte -> giá trị có dấu (command trong bảng là sbyte)
function toSByte(v: number): number { return v > 127 ? v - 256 : v; }

function dumpMessage(dir: string, msg: any) {
    let cmd = 0, data: number[] = [];
    try { cmd = toSByte(msg.field("command").value & 0xff); } catch (e) {}
    try {
        const d = msg.method("getData").invoke();
        if (d && !d.isNull()) data = readBytes(d);
    } catch (e) {}
    const name = cmdName(cmd);
    console.log(`\n[${dir}] cmd=${cmd} (${name})  len=${data.length}`);
    if (data.length) {
        console.log(`      hex   : ${hex(data)}`);
        console.log(`      ascii : ${ascii(data)}`);
        console.log(`      decode: ${smartDecode(data, name, dir)}`);
        // RX gói FarmData lồng nhau → decoder riêng (cell/animal). Chỉnh FARMDATA_CMDS nếu command khác.
        if (dir === "RX" && (FARMDATA_CMDS.has(cmd) || FARMDATA_CMDS.has((cmd + 256) & 0xff))) {
            console.log(`      farm  : ${decodeFarmData(data)}`);
        }
        if (dir === "RX" && cmd === -34) {  // LOGIN_SUCESS -> enter-world
            console.log(`      world : ${decodeEnterWorld(data)}`);
        }
        // Câu cá: thân động -> decoder riêng (xem ParkMsgHandler/ParkService).
        if (dir === "RX" && cmd === 79) {   // CAN_CAU -> onCaCanCau
            console.log(`      fish  : ${decodeCanCau(data)}`);
        }
        if (dir === "TX" && cmd === 43) {   // CAU_THANH_CONG -> doFinishFishing
            console.log(`      fish  : ${decodeFinishFishing(data)}`);
        }
    }
}

// Helper gọi tay từ REPL Frida: %resume rồi decodeListPlayer([..bytes..]) trên body enter-world.
(globalThis as any).decodeListPlayer = (b: number[]) => decodeListPlayer(b);
(globalThis as any).decodeEnterWorld = (b: number[]) => decodeEnterWorld(b);

Il2Cpp.perform(() => {
    console.log("[+] parser attached, unity =", Il2Cpp.unityVersion);
    const Session = Il2Cpp.domain.assembly("Assembly-CSharp").image.class("Session_ME");

    try {
        Session.method("sendMessage").implementation = function (m: any) {
            dumpMessage("TX", m);
            return this.method("sendMessage").invoke(m);
        };
        console.log("[+] hooked Session_ME.sendMessage (TX)");
    } catch (e) { console.log("[!] sendMessage:", e); }

    try {
        Session.method("onRecieveMsg").implementation = function (m: any) {
            dumpMessage("RX", m);
            return this.method("onRecieveMsg").invoke(m);
        };
        console.log("[+] hooked Session_ME.onRecieveMsg (RX)");
    } catch (e) { console.log("[!] onRecieveMsg:", e); }
});
