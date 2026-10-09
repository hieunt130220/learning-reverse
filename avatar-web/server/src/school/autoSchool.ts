/**
 * autoSchool.ts — Bộ điều phối tự động trả lời câu hỏi cô giáo (Map 6 Trường học)
 *
 * Spec: docs/superpowers/specs/2026-10-09-tich-hop-co-giao-truong-hoc-web-auto-design.md
 * Plan: docs/superpowers/plans/2026-10-09-tich-hop-co-giao-truong-hoc-web-auto.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameClient } from '../game/client.js';
import type { Message } from '../proto/message.js';
import {
  idleSchoolRuntime,
  type SchoolConfig,
  type SchoolRuntimeState,
  type SchoolSubject,
} from '../session/automationTypes.js';

export const TEACHER_EN_ID = 2000000336; // Cô Giáo Tiếng Anh (Board chẵn)
export const TEACHER_VI_ID = 2000000337; // Cô Giáo Tiếng Việt (Board lẻ)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_EN_FILE = path.resolve(__dirname, '../../data/teacher-dict-en.json');
const DICT_VI_FILE = path.resolve(__dirname, '../../data/teacher-dict-vi.json');

interface ViQuestion {
  question: string;
  prefix: string;
  suffix: string;
  answer: string;
}

let dictEn: Record<string, string> = {};
let dictVi: ViQuestion[] = [];
let dictLoaded = false;

function loadDictionaries(): void {
  if (dictLoaded) return;
  try {
    if (fs.existsSync(DICT_EN_FILE)) {
      dictEn = JSON.parse(fs.readFileSync(DICT_EN_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error(`Lỗi nạp từ điển EN: ${(err as Error).message}`);
  }
  try {
    if (fs.existsSync(DICT_VI_FILE)) {
      dictVi = JSON.parse(fs.readFileSync(DICT_VI_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error(`Lỗi nạp từ điển VI: ${(err as Error).message}`);
  }
  dictLoaded = true;
}

function saveDictEn(): void {
  try {
    fs.mkdirSync(path.dirname(DICT_EN_FILE), { recursive: true });
    fs.writeFileSync(DICT_EN_FILE, JSON.stringify(dictEn, null, 2), 'utf-8');
  } catch {}
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?;:]+$/, '');
}

export function findViAnswer(text: string): string | null {
  loadDictionaries();
  const normText = normalize(text);
  for (const item of dictVi) {
    const p = normalize(item.prefix);
    const s = normalize(item.suffix);
    if (p && s) {
      if (normText.startsWith(p) && normText.endsWith(s)) {
        return item.answer;
      }
    } else if (p && normText.startsWith(p)) {
      return item.answer;
    } else if (s && normText.endsWith(s)) {
      return item.answer;
    }
  }
  return null;
}

export interface AutoSchoolRunnerDeps {
  accountId: number;
  accountLabel?: string;
  gameUser?: string;
  onStateChange?: (state: SchoolRuntimeState) => void;
  onRequestStop?: (reason: 'finished' | 'error' | 'stopped', message?: string) => void;
  onLog?: (message: string) => void;
}

export class AutoSchoolRunner {
  private state: SchoolRuntimeState;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private lastRewardedQuestion: string | null = null;

  constructor(
    private readonly client: GameClient,
    private config: SchoolConfig,
    private readonly deps: AutoSchoolRunnerDeps,
  ) {
    loadDictionaries();
    this.state = {
      ...idleSchoolRuntime(),
      subject: config.subject,
      targetWins: config.targetWins,
    };
  }

  getState(): SchoolRuntimeState {
    return { ...this.state };
  }

  updateConfig(newConfig: SchoolConfig): void {
    this.config = { ...newConfig };
    this.state = {
      ...this.state,
      subject: newConfig.subject,
      targetWins: newConfig.targetWins,
    };
    this.emitState();
  }

  private emitState(): void {
    this.deps.onStateChange?.({ ...this.state });
  }

  private log(message: string): void {
    this.deps.onLog?.(message);
  }

  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      const onAbort = () => {
        if (timer) clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(new Error('aborted'));
      };
      if (signal.aborted) {
        reject(new Error('aborted'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.attachListeners();

    try {
      await this.runLoop(signal);
    } catch (err) {
      if (!signal.aborted) {
        const msg = (err as Error).message;
        this.log(`[trường học] lỗi: ${msg}`);
        this.state = { ...this.state, lastError: msg, phase: 'idle' };
        this.emitState();
        this.deps.onRequestStop?.('error', msg);
      }
    } finally {
      this.detachListeners();
      this.isRunning = false;
    }
  }

  stop(): void {
    if (!this.isRunning) return;
    this.abortController?.abort();
    this.detachListeners();
    this.isRunning = false;
    this.state = { ...this.state, phase: 'idle' };
    this.emitState();
  }

  private attachListeners(): void {
    this.client.on('park-chat', this.handleParkChat);
    this.client.on('dialog', this.handleDialog);
  }

  private detachListeners(): void {
    this.client.removeListener('park-chat', this.handleParkChat);
    this.client.removeListener('dialog', this.handleDialog);
  }

  private handleParkChat = ({ idUser, text }: { idUser: number; text: string }): void => {
    // 1. CÔ GIÁO TIẾNG ANH (Board chẵn - ID 2000000336)
    if (idUser === TEACHER_EN_ID && this.config.subject === 'en') {
      if (text.includes(' - ')) {
        const rawQ = text.split(' - ')[0].trim().toLowerCase();
        this.state = {
          ...this.state,
          lastQuestion: rawQ,
          phase: 'answering',
        };
        this.emitState();

        const ans = dictEn[rawQ];
        if (ans) {
          this.state = { ...this.state, lastAnswer: ans };
          this.emitState();
          this.log(`⚡ [TRẢ LỜI EN]: "${ans}"`);
          this.client.chatPark(ans);
        } else {
          this.log(`⚠️ Từ chưa có trong từ điển EN: "${rawQ}"`);
        }
      }

      // Học từ mới khi cô giáo công bố đáp án
      const matchAns = text.match(/Đáp án của câu hỏi\s+(.+?)\s+là\s+([a-zA-Z\s]+)/i);
      if (matchAns) {
        const q = matchAns[1].trim().toLowerCase();
        const a = matchAns[2].trim().toLowerCase();
        if (!dictEn[q]) {
          dictEn[q] = a;
          saveDictEn();
          this.log(`💡 [ĐÃ HỌC TỪ EN]: "${q}" -> "${a}" (Tổng: ${Object.keys(dictEn).length})`);
        }
      }

      if (text.includes('Chúc mừng bạn')) {
        this.state = { ...this.state, lastWinner: text };
        this.emitState();
        this.checkWinFromTeacherChat(text);
      }
    }
    // 2. CÔ GIÁO TIẾNG VIỆT (Board lẻ - ID 2000000337)
    else if (idUser === TEACHER_VI_ID && this.config.subject === 'vi') {
      if (text.includes('đợi các bạn đến đông đủ')) {
        this.state = { ...this.state, phase: 'waiting_students' };
        this.emitState();
        this.log(`👩‍🏫 [CÔ VIỆT]: Đang đợi học sinh đến đông đủ...`);
      } else if (text.includes('...')) {
        this.state = {
          ...this.state,
          lastQuestion: text,
          phase: 'answering',
        };
        this.emitState();

        const ans = findViAnswer(text);
        if (ans) {
          this.state = { ...this.state, lastAnswer: ans };
          this.emitState();
          this.log(`⚡ [TRẢ LỜI VN]: "${ans}"`);
          this.client.chatPark(ans);
        } else {
          this.log(`⚠️ Chưa khớp câu tục ngữ nào trong DB: "${text}"`);
        }
      }

      // Học đáp án VN khi cô công bố
      const matchAns = text.match(/Đáp án của câu hỏi\s+(.+?)\s+là\s+(.+)/i);
      if (matchAns) {
        const q = matchAns[1].trim().toLowerCase();
        const a = matchAns[2].trim().toLowerCase();
        this.log(`💡 [CÔNG BỐ ĐÁP ÁN VN]: "${q}" -> "${a}"`);
      }

      if (text.includes('Chúc mừng bạn')) {
        this.state = { ...this.state, lastWinner: text };
        this.emitState();
        this.checkWinFromTeacherChat(text);
      }
    }
  };

  private checkWinFromTeacherChat(text: string): void {
    const gameUser = this.deps.gameUser?.toLowerCase();
    if (gameUser && text.toLowerCase().includes(gameUser)) {
      this.recordWin();
    }
  }

  private handleDialog = (dialogText: string): void => {
    if (dialogText.includes('Bạn thu hoạch được 1 cuốc từ hoạt động trả lời cô giáo')) {
      this.recordWin();
    }
  };

  private recordWin(): void {
    const currentQ = this.state.lastQuestion;
    if (currentQ && currentQ === this.lastRewardedQuestion) {
      return; // Tránh đếm trùng cùng một câu hỏi
    }
    this.lastRewardedQuestion = currentQ;

    const nextCount = this.state.correctCount + 1;
    this.state = {
      ...this.state,
      correctCount: nextCount,
    };
    this.emitState();

    const targetStr = this.config.targetWins > 0 ? `/${this.config.targetWins}` : '';
    this.log(`🏆 [TRẢ LỜI ĐÚNG]: Câu thứ ${nextCount}${targetStr}`);

    if (this.config.targetWins > 0 && nextCount >= this.config.targetWins) {
      this.log(`🎯 Đã hoàn thành mục tiêu ${this.config.targetWins} câu thắng!`);
      this.state = { ...this.state, phase: 'finished' };
      this.emitState();
      this.deps.onRequestStop?.('finished', `Đã đạt đủ ${nextCount} câu thắng`);
    }
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    this.state = { ...this.state, phase: 'moving' };
    this.emitState();

    // 1. Chuyển context Park nếu cần
    await this.ensureParkContext(signal);

    // 2. Xoay vòng Board tìm phòng học
    await this.enterSchoolBoardWithFallback(signal);

    this.log(`[trường học] Đã vào phòng học Map 6 Khu ${this.state.currentArea}. Đang chờ câu hỏi...`);
    this.state = { ...this.state, phase: 'answering' };
    this.emitState();

    // 3. Giữ kết nối và theo dõi
    while (!signal.aborted) {
      await this.sleep(5000, signal);

      // Kiểm tra xem nhân vật có bị rơi ra khỏi phòng không
      const snap = this.client.currentParkSnapshot;
      if (!snap || snap.roomId !== 6) {
        this.log(`[trường học] Nhân vật bị rời khỏi phòng học, đang vào lại...`);
        this.state = { ...this.state, phase: 'moving' };
        this.emitState();
        await this.enterSchoolBoardWithFallback(signal);
      }
    }
  }

  private async ensureParkContext(signal: AbortSignal): Promise<void> {
    if (this.client.currentHandlerContext === 9) return;

    this.log('[trường học] Chuyển context sang Park (handler 9)...');
    await new Promise<void>((resolve, reject) => {
      const onMsg = (msg: Message) => {
        if (msg.command === -1 && msg.getData()[0] === 9) {
          cleanup();
          resolve();
        }
      };
      const onAbort = () => {
        cleanup();
        reject(new Error('aborted'));
      };
      const cleanup = () => {
        this.client.session.removeListener('message', onMsg);
        signal.removeEventListener('abort', onAbort);
      };

      this.client.session.on('message', onMsg);
      signal.addEventListener('abort', onAbort, { once: true });
      this.client.enterParkContext();

      // Timeout 8s
      setTimeout(() => {
        cleanup();
        resolve(); // Tiếp tục thử join park
      }, 8000);
    });
  }

  /**
   * Xoay vòng Board (Board Fallback Rotation):
   * - Tiếng Anh (en): Board chẵn (0, 2, 4, 6... tối đa 20 khu)
   * - Tiếng Việt (vi): Board lẻ (1, 3, 5, 7... tối đa 20 khu)
   */
  private async enterSchoolBoardWithFallback(signal: AbortSignal): Promise<void> {
    const isEn = this.config.subject === 'en';
    let board = isEn ? 0 : 1;
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal.aborted) throw new Error('aborted');

      const subjectName = isEn ? 'Tiếng Anh' : 'Tiếng Việt';
      this.log(`[trường học] Đang vào Lớp ${subjectName} Map 6 (Khu ${board})...`);

      try {
        const snapPromise = this.client.waitForWorldSnapshot(signal, 7000, { map: 6, area: board });
        this.client.joinPark(6, board);
        await snapPromise;

        this.state = {
          ...this.state,
          currentMap: 6,
          currentArea: board,
        };
        this.emitState();
        return;
      } catch (err) {
        if (signal.aborted) throw err;
        this.log(`[trường học] Không vào được Khu ${board} (${(err as Error).message}). Đổi sang khu tiếp theo...`);
        // Xoay vòng:
        // EN: 0 -> 2 -> 4 -> 6 -> ... -> 18 -> 0
        // VI: 1 -> 3 -> 5 -> 7 -> ... -> 19 -> 1
        if (isEn) {
          board = (board + 2) % 20;
        } else {
          board = (((board - 1 + 2) % 20) + 1);
        }
        await this.sleep(2000, signal);
      }
    }

    throw new Error('Không thể kết nối vào bất kỳ khu học nào trên Map 6');
  }
}
