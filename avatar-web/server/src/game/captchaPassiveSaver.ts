import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { detectImageFormat, type CaptchaChallenge } from './captchaProtocol.js';

const DEFAULT_OUTPUT_DIR = path.resolve('captcha-dataset');

let globalSeq = 0;

export interface PassiveCaptchaSaveResult {
  fileName: string | null;
  savedPath: string | null;
  format: string | null;
  sha256: string | null;
  isDiagnostic: boolean;
}

/**
 * Lưu captcha nhận được trong lúc chơi game bình thường.
 * - Tạo thư mục nếu chưa có.
 * - Đặt tên unique `captcha-YYYYMMDD-HHmmss-SSS-<seq>.<ext>` với seq 3 chữ số, xử lý collision.
 * - Ghi temp + rename nguyên tử, không ghi đè.
 * - Trả về thông tin để caller log và broadcast.
 */
export async function savePassiveCaptcha(
  challenge: CaptchaChallenge,
  accountId: number,
  outputDir = DEFAULT_OUTPUT_DIR,
): Promise<PassiveCaptchaSaveResult> {
  await fs.mkdir(outputDir, { recursive: true });

  const bytes = challenge.imageBytes;
  let ext = 'bin';
  let isDiagnostic = true;
  if (bytes && bytes.length > 0) {
    const fmt = detectImageFormat(bytes);
    if (fmt) {
      ext = fmt === 'jpeg' ? 'jpg' : fmt;
      isDiagnostic = false;
    } else {
      ext = 'bin';
      isDiagnostic = true;
    }
  } else {
    // text-only captcha, lưu diagnostic JSON chứ không lưu ảnh
    ext = 'bin';
    isDiagnostic = true;
  }

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`;
  // global sequence per process to avoid collision within same ms
  globalSeq = (globalSeq + 1) % 1000;

  let fileName = '';
  let targetPath = '';
  // Attempt to find non-colliding name; include accountId to isolate
  for (let attempt = 0; attempt < 1000; attempt++) {
    const seq = String((globalSeq + attempt) % 1000).padStart(3, '0');
    // Include accountId for traceability but keep collector naming compatibility
    fileName = `captcha-${ts}-${seq}-${accountId}.${ext}`;
    targetPath = path.join(outputDir, fileName);
    try {
      await fs.access(targetPath);
      // exists, try next
      continue;
    } catch {
      break;
    }
  }
  // Fallback if all collide (rare)
  if (!fileName) {
    fileName = `captcha-${ts}-${String(globalSeq).padStart(3, '0')}-${accountId}-${Date.now()}.${ext}`;
    targetPath = path.join(outputDir, fileName);
  }

  const tmpPath = path.join(outputDir, `.tmp-${fileName}`);
  let sha256: string | null = null;
  if (bytes && bytes.length > 0) {
    sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(tmpPath, bytes);
  } else {
    // Lưu diagnostic JSON cho text-only
    const diagnostic = {
      receivedAt: now.toISOString(),
      accountId,
      targetId: challenge.targetId,
      menuId: challenge.menuId,
      prompt: challenge.prompt,
      inputType: challenge.inputType,
      imageLength: bytes?.length ?? 0,
      sha256: null as string | null,
      isDiagnostic: true,
    };
    await fs.writeFile(tmpPath, JSON.stringify(diagnostic, null, 2));
    // Đổi tên thành .json nếu text-only để dễ phân biệt
    const jsonFileName = fileName.replace(/\.bin$/, '.json');
    const jsonTarget = path.join(outputDir, jsonFileName);
    try {
      await fs.access(jsonTarget);
      // collision, keep bin name
    } catch {
      fileName = jsonFileName;
      targetPath = jsonTarget;
    }
  }

  try {
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    // cleanup temp on failure
    try {
      await fs.unlink(tmpPath);
    } catch {}
    throw err;
  }

  return {
    fileName,
    savedPath: targetPath,
    format: isDiagnostic ? null : ext,
    sha256,
    isDiagnostic,
  };
}

/**
 * Lưu diagnostic cho trường hợp decode lỗi (không có challenge).
 */
export async function saveCaptchaDiagnostic(
  rawHex: string,
  errorMessage: string,
  accountId: number,
  outputDir = DEFAULT_OUTPUT_DIR,
): Promise<{ fileName: string; savedPath: string }> {
  await fs.mkdir(outputDir, { recursive: true });
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`;
  globalSeq = (globalSeq + 1) % 1000;
  const seq = String(globalSeq).padStart(3, '0');
  const fileName = `captcha-${ts}-${seq}-${accountId}-failed.json`;
  const targetPath = path.join(outputDir, fileName);
  const payload = {
    receivedAt: now.toISOString(),
    accountId,
    error: errorMessage,
    rawHex: rawHex.slice(0, 512),
    rawLength: rawHex.length / 2,
  };
  const tmpPath = path.join(outputDir, `.tmp-${fileName}`);
  await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2));
  await fs.rename(tmpPath, targetPath);
  return { fileName, savedPath: targetPath };
}
