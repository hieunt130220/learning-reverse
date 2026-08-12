import { argon2id, hash, verify, type Options } from 'argon2';

/** Không đặt luật ký tự đặc biệt — độ dài là thứ thực sự có ích. */
export const MIN_PASSWORD_LENGTH = 10;

const OPTIONS: Options = { type: argon2id };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    // Hash hỏng trong DB không phải là "đăng nhập thành công".
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verify giả trên một hash cố định, dùng khi email không tồn tại.
 *
 * Không có nó thì đường "email không tồn tại" trả về gần như tức thì còn đường
 * "sai mật khẩu" tốn cả trăm ms — chênh lệch đó đủ để dò ra email nào có thật.
 */
export async function verifyDummy(plain: string): Promise<void> {
  dummyHash ??= hashPassword('mat-khau-gia-de-can-bang-thoi-gian');
  await verifyPassword(await dummyHash, plain);
}
