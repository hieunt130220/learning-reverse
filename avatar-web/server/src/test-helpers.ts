import crypto from 'node:crypto';

import { openDb, type Db } from './db/index.js';

/** DB trong RAM đã migrate — mỗi test một cái, không dọn dẹp gì thêm. */
export function newTestDb(): Db {
  return openDb(':memory:');
}

/** Khoá 32 byte cố định cho test không cần ngẫu nhiên. */
export const TEST_KEY = crypto.createHash('sha256').update('test-master-key').digest();
