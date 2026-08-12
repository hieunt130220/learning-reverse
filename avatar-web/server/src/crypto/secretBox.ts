import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

/**
 * Mã hoá một bí mật ngắn (mật khẩu game) bằng AES-256-GCM.
 *
 * `aad` là id bản ghi `avatar_accounts`. Buộc nó vào bản mã để kẻ có quyền ghi
 * DB không thể chép bản mã của tài khoản này sang tài khoản khác rồi bắt ứng
 * dụng giải mã hộ.
 *
 * Định dạng: `v1:<iv_b64>:<tag_b64>:<ct_b64>` — tiền tố phiên bản để sau này
 * xoay khoá được mà vẫn đọc được bản cũ.
 */
export function encryptSecret(key: Buffer, aad: string, plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Giải mã. Ném lỗi nếu sai khoá, sai AAD, hoặc bản mã bị sửa. */
export function decryptSecret(key: Buffer, aad: string, boxed: string): string {
  const parts = boxed.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('không nhận ra định dạng bản mã');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
