import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';
import {
  CMD_CAPTCHA_CHALLENGE,
  decodeCaptchaChallenge,
  type CaptchaChallenge,
} from './captchaProtocol.js';

export const CMD_OPEN_GAME_GATE = -1;
export const GAME_GATE_ID = 3;

export class GameGateService {
  constructor(private readonly session: Session) {}

  /**
   * Gửi packet mở cổng game: cmd = -1, body = int8(3).
   * Evidence: class aO.case() gọi fV.do().int(aO.do[10]) với aO.do[10] = 3.
   * fV.int(int) gọi bH.do(int) -> DataOutputStream.writeByte(i).
   */
  openGameGate(): void {
    const m = Message.create(CMD_OPEN_GAME_GATE);
    m.writer!.writeByte(GAME_GATE_ID);
    this.session.send(m);
  }

  /**
   * Đóng dialog captcha trên client.
   * Evidence: class cc.if(..., 120) thực hiện bx.do = null (UI-only),
   * không gửi packet lên server. Không gọi callback submit (eg).
   */
  closeCaptchaDialog(): void {
    // No-op theo static reverse evidence cc.if(..., 120)
  }

  /**
   * Chờ nhận packet captcha (cmd -60) từ server.
   * Đăng ký listener trước khi gọi openGameGate() để không bị miss packet.
   */
  waitForCaptcha(
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<CaptchaChallenge> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;

      const onMessage = (msg: Message): void => {
        if (msg.command !== CMD_CAPTCHA_CHALLENGE) return;
        cleanup();
        try {
          const challenge = decodeCaptchaChallenge(msg.getData());
          resolve(challenge);
        } catch (err) {
          reject(err);
        }
      };

      const onClosed = (): void => {
        cleanup();
        reject(new Error('kết nối đã đóng khi đang chờ captcha (-60)'));
      };

      const onAbort = (): void => {
        cleanup();
        reject(new Error('chờ captcha bị hủy'));
      };

      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        this.session.removeListener('message', onMessage);
        this.session.removeListener('closed', onClosed);
        signal.removeEventListener('abort', onAbort);
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`hết thời gian chờ captcha (-60) sau ${timeoutMs}ms`));
      }, timeoutMs);

      this.session.on('message', onMessage);
      this.session.once('closed', onClosed);
      signal.addEventListener('abort', onAbort, { once: true });

      if (signal.aborted) {
        onAbort();
      }
    });
  }
}
