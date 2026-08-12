import { MyReader } from './reader.js';
import { MyWriter } from './writer.js';

/** Tương ứng class `Message` trong game: 1 sbyte command + body nhị phân. */
export class Message {
  readonly command: number;
  readonly writer?: MyWriter;
  readonly reader?: MyReader;
  private readonly data?: Buffer;

  private constructor(command: number, writer?: MyWriter, data?: Buffer) {
    this.command = command;
    this.writer = writer;
    this.data = data;
    if (data) this.reader = new MyReader(data);
  }

  /** Gói để gửi đi. */
  static create(command: number): Message {
    return new Message(command, new MyWriter());
  }

  /** Gói nhận về. */
  static fromData(command: number, data: Buffer): Message {
    return new Message(command, undefined, data);
  }

  getData(): Buffer {
    if (this.data) return this.data;
    return this.writer ? this.writer.getData() : Buffer.alloc(0);
  }
}
