export interface RateLimiter {
  /** Trả `true` nếu còn được phép, `false` nếu đã vượt ngưỡng. */
  hit(key: string, now?: number): boolean;
  reset(key: string): void;
  /** Số khoá đang giữ — để test khẳng định bộ nhớ có được dọn. */
  size(): number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Bộ đếm cửa sổ cố định, in-memory. Mất khi restart — chấp nhận được: nó chống
 * dò mật khẩu tự động, không phải chống kẻ tấn công biết canh lúc server khởi động.
 */
export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };

  return {
    hit(key, now = Date.now()) {
      sweep(now);
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= opts.max;
    },
    reset(key) {
      buckets.delete(key);
    },
    size() {
      return buckets.size;
    },
  };
}
