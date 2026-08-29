import http, {
  type ClientRequest,
  type IncomingMessage,
  type OutgoingHttpHeaders,
} from 'node:http';

import type { RequestHandler, Response } from 'express';

const DEFAULT_UPSTREAM_ORIGIN = 'http://127.0.0.1:8643';
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);
const REQUEST_HEADERS = ['content-type', 'user-agent', 'accept'] as const;
const RESPONSE_HEADERS = ['content-type', 'content-length'] as const;

export interface CaptchaSolverProxyOptions {
  upstreamOrigin?: string;
  maxBodyBytes?: number;
  timeoutMs?: number;
}

function parsePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function parseUpstreamOrigin(value: string): URL {
  const origin = new URL(value);
  if (origin.protocol !== 'http:') {
    throw new Error('captcha solver upstream must use http');
  }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('captcha solver upstream must be an origin without credentials, path, query, or hash');
  }
  return origin;
}

function sendEmpty(res: Response, status: number, headers: Record<string, string> = {}): void {
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  res.statusCode = status;
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
  res.setHeader('Content-Length', '0');
  res.end();
}

export function captchaSolverProxy(
  options: CaptchaSolverProxyOptions = {},
): RequestHandler {
  const upstream = parseUpstreamOrigin(options.upstreamOrigin ?? DEFAULT_UPSTREAM_ORIGIN);
  const maxBodyBytes = parsePositiveInteger(
    options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    'maxBodyBytes',
  );
  const timeoutMs = parsePositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeoutMs');

  return (req, res) => {
    const method = req.method.toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      req.resume();
      sendEmpty(res, 405, { Allow: 'GET, HEAD, POST' });
      return;
    }

    const contentLengthHeader = req.headers['content-length'];
    let declaredLength: number | undefined;
    if (contentLengthHeader !== undefined) {
      if (Array.isArray(contentLengthHeader) || !/^\d+$/.test(contentLengthHeader)) {
        req.resume();
        sendEmpty(res, 400);
        return;
      }
      declaredLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(declaredLength)) {
        req.resume();
        sendEmpty(res, 400);
        return;
      }
      if (declaredLength > maxBodyBytes) {
        req.resume();
        sendEmpty(res, 413);
        return;
      }
    }

    let failed = false;
    let downstreamClosed = false;
    let upstreamRequest: ClientRequest | undefined;
    let upstreamResponse: IncomingMessage | undefined;

    const abortUpstream = (): void => {
      upstreamResponse?.destroy();
      upstreamRequest?.destroy();
    };

    const fail = (status: number, error?: Error): void => {
      if (failed || downstreamClosed) return;
      failed = true;
      abortUpstream();
      req.resume();
      if (!res.headersSent) {
        sendEmpty(res, status);
      } else if (!res.writableEnded && !res.destroyed) {
        res.destroy(error);
      }
    };

    const handleUpstreamError = (error: Error): void => {
      if (!failed && !downstreamClosed) {
        console.error(`[captcha-solver-proxy] ${method} ${req.originalUrl}: ${error.message}`);
      }
      fail(502, error);
    };

    res.once('close', () => {
      if (!res.writableEnded) {
        downstreamClosed = true;
        abortUpstream();
      }
    });

    req.once('aborted', () => {
      downstreamClosed = true;
      abortUpstream();
    });

    req.once('error', (error) => {
      fail(400, error);
    });

    const createUpstreamRequest = (contentLength: number): ClientRequest | undefined => {
      if (failed || downstreamClosed) return undefined;

      const headers: OutgoingHttpHeaders = {
        Connection: 'close',
        Host: upstream.host,
        'Content-Length': String(contentLength),
      };
      for (const name of REQUEST_HEADERS) {
        const value = req.headers[name];
        if (value !== undefined) headers[name] = value;
      }

      const requestPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
      const request = http.request(
        {
          protocol: upstream.protocol,
          hostname: upstream.hostname,
          port: upstream.port || undefined,
          method,
          path: requestPath,
          headers,
          agent: false,
        },
        (response) => {
          upstreamResponse = response;
          if (failed || downstreamClosed) {
            response.destroy();
            return;
          }

          res.statusCode = response.statusCode ?? 502;
          for (const name of RESPONSE_HEADERS) {
            const value = response.headers[name];
            if (value !== undefined) res.setHeader(name, value);
          }

          response.once('error', handleUpstreamError);
          if (method === 'HEAD') {
            response.resume();
            response.once('end', () => {
              if (!res.writableEnded && !res.destroyed) res.end();
            });
            return;
          }
          response.pipe(res);
        },
      );

      upstreamRequest = request;
      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`upstream timeout after ${timeoutMs}ms`));
      });
      request.once('error', handleUpstreamError);
      return request;
    };

    if (declaredLength === undefined) {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      req.on('data', (chunk: Buffer) => {
        if (failed || downstreamClosed) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBodyBytes) {
          chunks.length = 0;
          fail(413);
          return;
        }
        chunks.push(chunk);
      });
      req.once('end', () => {
        if (failed || downstreamClosed) return;
        const request = createUpstreamRequest(totalBytes);
        request?.end(Buffer.concat(chunks, totalBytes));
      });
      return;
    }

    const request = createUpstreamRequest(declaredLength);
    if (!request) return;

    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      if (failed || downstreamClosed) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBodyBytes) {
        fail(413);
        return;
      }
      if (!request.write(chunk)) {
        req.pause();
        request.once('drain', () => {
          if (!failed && !downstreamClosed) req.resume();
        });
      }
    });
    req.once('end', () => {
      if (!failed && !downstreamClosed) request.end();
    });
  };
}
