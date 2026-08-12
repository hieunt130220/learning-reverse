import { EventEmitter } from 'node:events';
import net from 'node:net';

import { Message } from './message.js';

/**
 * Port của `Session_ME` (Assembly-CSharp). Mọi con số dưới đây lấy từ
 * disassembly libil2cpp.so arm64, không phải suy đoán:
 *
 *   doSendMessage  @0x6798E0 — khung gửi: [cmd:1][len:2 BE][body]
 *   readMessage    @0x7FF008 — khung nhận: len 2 byte, TRỪ 4 cmd dưới đây dùng 4 byte
 *   writeKey       @0x679E98 — out = key[curW] ^ b; curW = (curW+1) % key.length
 *   readKey        @0x679F04 — như trên nhưng dùng con trỏ curR riêng
 *   getKey         @0x7FF624 — gói cmd -27, xem parseKey()
 *
 * Trước khi nhận key thì cả 2 chiều đều là plaintext.
 */

/** RX dùng độ dài 4 byte cho các cmd này (gói ảnh/resource lớn -> readMessage2). */
const BIG_LEN_CMDS = new Set([-69, -51, -44, 79]);

/** cmd của gói trao khóa, kiểm tra trong MessageCollector.run @0x7FEC6C. */
export const CMD_GET_KEY = -27;

export type SessionCloseKind = 'remote-end' | 'socket-error' | 'local-close' | 'socket-close';

export interface SessionSocketError {
  message: string;
  code?: string;
  errno?: string | number;
  syscall?: string;
}

export interface SessionCloseInfo {
  kind: SessionCloseKind;
  hadError: boolean;
  host: string;
  port: number;
  startedAt: number;
  connectedAt?: number;
  closedAt: number;
  lastDataAt?: number;
  lifetimeMs: number;
  bytesRead: number;
  bytesWritten: number;
  error?: SessionSocketError;
}

export interface SessionEvents {
  message: (msg: Message) => void;
  key: () => void;
  connected: () => void;
  closed: (info: SessionCloseInfo) => void;
  error: (err: Error) => void;
  /** Log thô cho UI. */
  traffic: (dir: 'tx' | 'rx', cmd: number, body: Buffer) => void;
}

export declare interface Session {
  on<K extends keyof SessionEvents>(e: K, l: SessionEvents[K]): this;
  emit<K extends keyof SessionEvents>(e: K, ...a: Parameters<SessionEvents[K]>): boolean;
}

export class Session extends EventEmitter {
  private socket?: net.Socket;
  private rx = Buffer.alloc(0);

  private key: Buffer | null = null;
  private curR = 0;
  private curW = 0;
  private getKeyComplete = false;

  private targetHost = '';
  private targetPort = 0;
  private startedAt = 0;
  private connectedAt?: number;
  private lastDataAt?: number;
  private remoteEnded = false;
  private localCloseRequested = false;
  private lastSocketError?: SessionSocketError;

  connected = false;

  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.reset();
      this.targetHost = host;
      this.targetPort = port;
      this.startedAt = Date.now();
      const sock = net.createConnection({ host, port });
      this.socket = sock;
      sock.setNoDelay(true);

      sock.once('connect', () => {
        this.connected = true;
        this.connectedAt = Date.now();
        this.emit('connected');
        resolve();
      });
      sock.on('data', (chunk) => {
        this.lastDataAt = Date.now();
        this.onData(chunk);
      });
      sock.on('end', () => {
        this.remoteEnded = true;
      });
      sock.on('error', (err: NodeJS.ErrnoException) => {
        this.lastSocketError = {
          message: err.message,
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
        };
        this.emit('error', err);
        reject(err);
      });
      sock.on('close', (hadError) => {
        const closedAt = Date.now();
        const kind: SessionCloseKind = this.localCloseRequested
          ? 'local-close'
          : this.lastSocketError
            ? 'socket-error'
            : this.remoteEnded
              ? 'remote-end'
              : 'socket-close';
        this.connected = false;
        this.emit('closed', {
          kind,
          hadError,
          host: this.targetHost,
          port: this.targetPort,
          startedAt: this.startedAt,
          connectedAt: this.connectedAt,
          closedAt,
          lastDataAt: this.lastDataAt,
          lifetimeMs: closedAt - this.startedAt,
          bytesRead: sock.bytesRead,
          bytesWritten: sock.bytesWritten,
          error: this.lastSocketError,
        });
      });
    });
  }

  close(): void {
    this.localCloseRequested = true;
    this.socket?.destroy();
    this.connected = false;
  }

  private reset(): void {
    this.rx = Buffer.alloc(0);
    this.key = null;
    this.curR = 0;
    this.curW = 0;
    this.getKeyComplete = false;
    this.connectedAt = undefined;
    this.lastDataAt = undefined;
    this.remoteEnded = false;
    this.localCloseRequested = false;
    this.lastSocketError = undefined;
  }

  send(msg: Message): void {
    if (!this.socket || !this.connected) throw new Error('chưa kết nối');
    const body = msg.getData();
    const out = Buffer.allocUnsafe(3 + body.length);
    out[0] = this.writeKey(msg.command);
    out[1] = this.writeKey((body.length >> 8) & 0xff);
    out[2] = this.writeKey(body.length & 0xff);
    for (let i = 0; i < body.length; i++) out[3 + i] = this.writeKey(body[i]);
    this.socket.write(out);
    this.emit('traffic', 'tx', msg.command, body);
  }

  private writeKey(b: number): number {
    if (!this.getKeyComplete || !this.key) return b & 0xff;
    const out = (this.key[this.curW] ^ b) & 0xff;
    this.curW = (this.curW + 1) % this.key.length;
    return out;
  }

  private onData(chunk: Buffer): void {
    this.rx = Buffer.concat([this.rx, chunk]);
    for (;;) {
      const msg = this.tryParse();
      if (!msg) break;
      if (msg.command === CMD_GET_KEY && !this.getKeyComplete) {
        this.parseKey(msg);
        this.emit('key');
      } else {
        this.emit('traffic', 'rx', msg.command, msg.getData());
        this.emit('message', msg);
      }
    }
  }

  /**
   * Giải mã tại chỗ mà chưa commit con trỏ khóa: nếu gói chưa về đủ thì
   * curR phải giữ nguyên để lần sau đọc lại từ đúng vị trí.
   */
  private tryParse(): Message | null {
    const buf = this.rx;
    if (buf.length < 1) return null;

    let cur = this.curR;
    const dec = (b: number): number => {
      if (!this.getKeyComplete || !this.key) return b;
      const out = (this.key[cur] ^ b) & 0xff;
      cur = (cur + 1) % this.key.length;
      return out;
    };

    const raw = dec(buf[0]);
    const cmd = raw > 127 ? raw - 256 : raw;
    const lenSize = BIG_LEN_CMDS.has(cmd) ? 4 : 2;
    if (buf.length < 1 + lenSize) return null;

    let len = 0;
    for (let i = 0; i < lenSize; i++) len = len * 256 + dec(buf[1 + i]);
    if (len < 0 || len > 32 * 1024 * 1024) {
      this.emit('error', new Error(`độ dài gói vô lý: cmd=${cmd} len=${len}`));
      this.close();
      return null;
    }
    if (buf.length < 1 + lenSize + len) return null;

    const body = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) body[i] = dec(buf[1 + lenSize + i]);

    this.curR = cur;
    this.rx = buf.subarray(1 + lenSize + len);
    return Message.fromData(cmd, body);
  }

  /** getKey @0x7FF624: đọc len + len byte, rồi cuộn XOR key[i+1] ^= key[i]. */
  private parseKey(msg: Message): void {
    const r = msg.reader!;
    const len = r.readByte();
    const key = Buffer.alloc(len);
    for (let i = 0; i < len; i++) key[i] = r.readUnsignedByte();
    for (let i = 0; i < len - 1; i++) key[i + 1] = (key[i + 1] ^ key[i]) & 0xff;
    this.key = key;
    this.curR = 0;
    this.curW = 0;
    this.getKeyComplete = true;
  }
}
