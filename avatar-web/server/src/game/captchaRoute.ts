import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Router, type Request, type Response } from 'express';

import { detectImageFormat } from './captchaProtocol.js';

const DEFAULT_DATASET_DIR = path.resolve('captcha-dataset');
const MAX_BYTES = 5 * 1024 * 1024;

// Ensure dataset dir exists at startup
await fs.mkdir(DEFAULT_DATASET_DIR, { recursive: true }).catch(() => {});

export function captchaRouter(): Router {
  const r = Router();

  // POST /api/captcha/j2me-upload : raw image bytes from patched J2ME jar
  // Accepts any Content-Type, body is raw bytes (PNG/JPEG/GIF)
  // No auth for now, but limit to localhost via header check if needed.
  r.post(
    '/j2me-upload',
    // raw parser for this route only
    (req, res, next) => {
      // Collect raw body
      const chunks: Buffer[] = [];
      let total = 0;
      req.on('data', (c: Buffer) => {
        total += c.length;
        if (total > MAX_BYTES) {
          res.status(413).json({ error: 'payload too large' });
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        (req as unknown as { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
        next();
      });
      req.on('error', (err) => next(err));
    },
    async (req: Request, res: Response) => {
      const raw = (req as unknown as { rawBody: Buffer }).rawBody;
      if (!raw || raw.length === 0) {
        return res.status(400).json({ error: 'empty body' });
      }
      if (raw.length > MAX_BYTES) {
        return res.status(413).json({ error: 'image too large' });
      }
      const fmt = detectImageFormat(raw);
      if (!fmt) {
        // Still save as .bin for diagnostics
        console.warn(`[captcha-upload] unrecognized format ${raw.length} bytes`);
      }
      const ext = fmt ? (fmt === 'jpeg' ? 'jpg' : fmt) : 'bin';
      const sha = crypto.createHash('sha256').update(raw).digest('hex');
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`;
      const fileName = `captcha-${ts}-${sha.slice(0, 6)}-j2me.${ext}`;
      const target = path.join(DEFAULT_DATASET_DIR, fileName);
      const tmp = path.join(DEFAULT_DATASET_DIR, `.tmp-${fileName}`);
      try {
        await fs.writeFile(tmp, raw);
        await fs.rename(tmp, target);
      } catch (e) {
        try {
          await fs.unlink(tmp);
        } catch {}
        console.error(`[captcha-upload] save failed: ${(e as Error).message}`);
        return res.status(500).json({ error: (e as Error).message });
      }
      console.log(`[captcha-upload] saved ${fileName} [${fmt ?? 'bin'}, ${raw.length} bytes, sha=${sha.slice(0, 12)}...]`);
      return res.json({ ok: true, fileName, format: fmt, bytes: raw.length, sha256: sha });
    },
  );

  // GET /api/captcha/dataset/:fileName : download
  r.get('/dataset/:fileName', async (req: Request, res: Response) => {
    const { fileName } = req.params;
    if (!/^captcha-[\w-]+\.(png|jpg|jpeg|gif|bin|json)$/.test(fileName)) {
      return res.status(400).json({ error: 'invalid filename' });
    }
    const filePath = path.resolve(DEFAULT_DATASET_DIR, fileName);
    if (!filePath.startsWith(DEFAULT_DATASET_DIR)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'not found' });
    }
    return res.sendFile(filePath);
  });

  // GET /api/captcha/list : list recent files
  r.get('/list', async (_req: Request, res: Response) => {
    try {
      const files = await fs.readdir(DEFAULT_DATASET_DIR);
      const list = files
        .filter((f) => f.startsWith('captcha-'))
        .sort()
        .reverse()
        .slice(0, 100);
      const withStat = await Promise.all(
        list.map(async (f) => {
          try {
            const st = await fs.stat(path.join(DEFAULT_DATASET_DIR, f));
            return { fileName: f, size: st.size, mtime: st.mtime.toISOString() };
          } catch {
            return { fileName: f, size: 0, mtime: null };
          }
        }),
      );
      return res.json({ files: withStat });
    } catch (e) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  return r;
}
