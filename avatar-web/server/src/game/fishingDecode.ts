import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MyReader } from '../proto/reader.js';

/** Cmd 79 CAN_CAU — cá cắn câu, kèm chuỗi ảnh mini-game (PNG blob). */
export const CMD_CAN_CAU = 79;

export interface CanCauPayload {
  idUser: number;
  idFish: number; // i16
  timeDelayMs: number; // i16 — đơn vị ms theo TickCount client (verify vòng đầu)
  images: Buffer[]; // arrImg PNG blobs
  imagesNew?: Buffer[]; // arrImgNew (chỉ có khi gói còn byte)
}

export interface FishingRx {
  kind:
    | 'start-ok'
    | 'start-rejected'
    | 'cast'
    | 'can-cau'
    | 'finish'
    | 'end'
    | 'status'
    | 'info';
  error?: string;
  idUser?: number;
  idFish?: number;
  payload?: CanCauPayload;
  status?: number;
  lv?: number;
  perLv?: number;
  numFish?: number;
  idPart?: number;
}

/** Đọc n blob: mỗi blob = i32 len + len byte. */
function readBlobArray(r: MyReader, count: number): Buffer[] {
  const out: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const len = r.readInt();
    out.push(r.readBytes(len));
  }
  return out;
}

/**
 * Decode RX 79 CAN_CAU. Layout (verify tại RVA trong fishing.md):
 *   i32 idUser, i16 idFish, i16 timeDelay, i8 n,
 *   n × {i32 len; len byte} arrImg
 *   [nếu available() >= 1: i8 m, m × {i32 len; len byte} arrImgNew]
 */
export function decodeCanCau(body: Buffer): CanCauPayload {
  const r = new MyReader(body);
  const idUser = r.readInt();
  const idFish = r.readShort(); // i16 dù chữ ký callback khai báo int
  const timeDelayMs = r.readShort(); // i16
  const n = r.readByte();
  const images = readBlobArray(r, n);
  let imagesNew: Buffer[] | undefined;
  if (r.available() >= 1) {
    const m = r.readByte();
    imagesNew = readBlobArray(r, m);
  }
  return { idUser, idFish, timeDelayMs, images, imagesNew };
}

/**
 * Lưu mọi blob PNG trong payload xuống tmp để verify tay ánh xạ ảnh↔phím.
 * Trả về đường dẫn file đã ghi (1 file/ảnh, prefix phân biệt arrImg/arrImgNew).
 * Không throw nếu ghi thất bại — probe chỉ cần log.
 */
export async function saveCanCauImages(
  payload: CanCauPayload,
  tag = 'probe',
): Promise<string[]> {
  const dir = path.join(os.tmpdir(), 'avatar-fishing');
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    return [];
  }
  const written: string[] = [];
  const stamp = `${Date.now()}`;
  const dump = async (buf: Buffer, prefix: string, idx: number): Promise<void> => {
    const p = path.join(dir, `${tag}_${stamp}_${prefix}${idx}.png`);
    try {
      await fs.writeFile(p, buf);
      written.push(p);
    } catch {
      /* ignore */
    }
  };
  for (let i = 0; i < payload.images.length; i++) {
    await dump(payload.images[i], 'img', i);
  }
  if (payload.imagesNew) {
    for (let i = 0; i < payload.imagesNew.length; i++) {
      await dump(payload.imagesNew[i], 'new', i);
    }
  }
  return written;
}

export interface SavedCanCauBatch {
  batchId: string;
  directory: string;
  manifestPath: string;
  imageCount: number;
  imageNewCount: number;
}

export interface SaveCanCauBatchOptions {
  outputDir: string;
  tag: string;
  map: number;
  area: number;
  capturedAt?: Date;
}

export interface CanCauImageEntry {
  index: number;
  path: string;
  bytes: number;
  sha256: string;
}

const MANIFEST_SCHEMA_VERSION = 1;

/** Validate a PNG keeps source bytes and is exactly 75×75 (IHDR at offset 16). */
function validatePng75x75(buf: Buffer, label: string): void {
  if (buf.length < 24) {
    throw new Error(`${label} không đủ byte để là PNG hợp lệ`);
  }
  if (buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${label} không bắt đầu bằng chữ ký PNG`);
  }
  if (buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error(`${label} CRC newline PNG không khớp`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== 75 || height !== 75) {
    throw new Error(`${label} kích thước PNG không phải 75×75 (thực tế ${width}×${height})`);
  }
}

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function randomHex6(): string {
  const bytes = new Uint8Array(3);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(bytes).toString('hex').padStart(6, '0');
}

/**
 * Lưu một batch CAN_CAU RX79 thành thư mục bất biến (immutable), có checksum,
 * schema-v1. Không chứa raw packet hex, account id, cookie hay credentials.
 *
 * Quy trình: tạo thư mục tạm sibling, ghi đúng byte PNG ra `img/<i>.png` và
 * `new/<i>.png`, tính SHA-256, viết manifest schema-v1, rồi rename nguyên tử.
 * Từ chối: images rỗng, imagesNew vắng/rỗng, trùng batchId, ghi lửng.
 *
 * KHÔNG gửi TX43 — chỉ capture/save offline (Giai đoạn A).
 */
export async function saveCanCauBatch(
  payload: CanCauPayload,
  options: SaveCanCauBatchOptions,
): Promise<SavedCanCauBatch> {
  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    throw new Error('images rỗng — từ chối lưu batch');
  }
  if (!Array.isArray(payload.imagesNew) || payload.imagesNew.length === 0) {
    throw new Error('imagesNew vắng hoặc rỗng — từ chối lưu batch');
  }

  const capturedAt = options.capturedAt ?? new Date();
  const batchId = `${options.tag}_${capturedAt.getTime()}_${randomHex6()}`;

  const finalDir = path.join(options.outputDir, batchId);
  const parentDir = options.outputDir;
  const tmpDir = path.join(parentDir, `${batchId}.tmp`);

  // Đảm bảo thư mục chứa tồn tại; từ chối nếu batchId đã tồn tại (collision).
  await fs.mkdir(parentDir, { recursive: true });
  try {
    await fs.mkdir(finalDir, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      // Không xóa data cũ — chỉ báo collision rõ ràng.
      throw new Error(`batchId đã tồn tại (collision): ${batchId}`);
    }
    throw error;
  }

  try {
    await fs.mkdir(tmpDir, { recursive: false });
    await fs.mkdir(path.join(tmpDir, 'img'), { recursive: false });
    await fs.mkdir(path.join(tmpDir, 'new'), { recursive: false });

    const writeImage = async (
      buf: Buffer,
      subDir: 'img' | 'new',
      index: number,
    ): Promise<CanCauImageEntry> => {
      validatePng75x75(buf, `${subDir}/${index}`);
      const relPath = path.join(subDir, `${index}.png`);
      const absPath = path.join(tmpDir, relPath);
      await fs.writeFile(absPath, buf);
      return {
        index,
        path: relPath,
        bytes: buf.length,
        sha256: sha256Hex(buf),
      };
    };

    const images: CanCauImageEntry[] = [];
    for (let i = 0; i < payload.images.length; i++) {
      images.push(await writeImage(payload.images[i]!, 'img', i));
    }
    const imagesNew: CanCauImageEntry[] = [];
    for (let i = 0; i < payload.imagesNew.length; i++) {
      imagesNew.push(await writeImage(payload.imagesNew[i]!, 'new', i));
    }

    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      batchId,
      capturedAt: capturedAt.toISOString(),
      map: options.map,
      area: options.area,
      idFish: payload.idFish,
      timeDelayMs: payload.timeDelayMs,
      imageCount: images.length,
      imageNewCount: imagesNew.length,
      images,
      imagesNew,
    };

    await fs.writeFile(
      path.join(tmpDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );

    // Rename nguyên tử từ thư mục tạm sang thư mục final.
    await fs.rename(tmpDir, finalDir);

    return {
      batchId,
      directory: finalDir,
      manifestPath: path.join(finalDir, 'manifest.json'),
      imageCount: images.length,
      imageNewCount: imagesNew.length,
    };
  } catch (error) {
    // Dọn dẹp thư mục tạm nếu ghi lửng; không nuốt lỗi.
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup failure */
    }
    if (error instanceof Error) throw error;
    throw new Error(`lưu batch thất bại: ${String(error)}`);
  }
}

/**
 * Decode bất kỳ gói RX câu cá nào thành FishingRx thuần (test được bằng fixture).
 * `cmd` là opcode gói, `body` là phần thân nhị phân.
 */
export function decodeFishingRx(cmd: number, body: Buffer): FishingRx {
  const r = new MyReader(body);
  switch (cmd) {
    case 45: {
      // START_CAU_CA: bool iss; nếu false thêm utf error
      const iss = r.readBoolean();
      if (iss) return { kind: 'start-ok' };
      return { kind: 'start-rejected', error: r.readUTF() };
    }
    case 41: // QUANG_CAU: i32 idUser
      return { kind: 'cast', idUser: r.readInt() };
    case 79: // CAN_CAU
      return { kind: 'can-cau', payload: decodeCanCau(body) };
    case 43: // CAU_THANH_CONG: i32 idUser, i16 idFish
      return { kind: 'finish', idUser: r.readInt(), idFish: r.readShort() };
    case 44: // CAU_CA_XONG: i32 idUser
      return { kind: 'end', idUser: r.readInt() };
    case 46: // STATUS_FISH: i32 idUser, i8 status
      return { kind: 'status', idUser: r.readInt(), status: r.readByte() };
    case -111: {
      // INFO_FISH: i32 idUser, i8 lv, i8 perLv, i32 numFish, i16 idPart
      const idUser = r.readInt();
      const lv = r.readByte();
      const perLv = r.readByte();
      const numFish = r.readInt();
      const idPart = r.readShort();
      return { kind: 'info', idUser, lv, perLv, numFish, idPart };
      // idUser bỏ qua (INFO_FISH broadcast, không cần biết ai)
    }
    default:
      throw new Error(`cmd câu cá không hỗ trợ: ${cmd}`);
  }
}
