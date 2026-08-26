export const CMD_CAPTCHA_CHALLENGE = -60;
export const MAX_CAPTCHA_IMAGE_BYTES = 5 * 1024 * 1024;
export const J2ME_MAX_IMAGE_BYTES = 32767;

export interface CaptchaChallenge {
  targetId: number;
  menuId: number;
  prompt: string;
  inputType: number;
  imageBytes: Buffer | null;
}

export type CaptchaImageFormat = 'png' | 'jpeg' | 'gif';

export interface DecodedCaptchaImage {
  format: CaptchaImageFormat;
  bytes: Buffer;
}

export class CaptchaProtocolDecodeError extends Error {
  constructor(
    readonly code: string,
    readonly section: string,
    readonly offset: number | null,
    message: string,
  ) {
    super(`[${code}] at ${section}${offset !== null ? ` (offset ${offset})` : ''}: ${message}`);
    this.name = 'CaptchaProtocolDecodeError';
  }
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87A_MAGIC = Buffer.from('GIF87a', 'ascii');
const GIF89A_MAGIC = Buffer.from('GIF89a', 'ascii');

export function detectImageFormat(bytes: Buffer): CaptchaImageFormat | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG_MAGIC)) {
    return 'jpeg';
  }
  if (
    bytes.length >= 6 &&
    (bytes.subarray(0, 6).equals(GIF87A_MAGIC) || bytes.subarray(0, 6).equals(GIF89A_MAGIC))
  ) {
    return 'gif';
  }
  return null;
}

export function decodeCaptchaChallenge(
  body: Buffer,
  maxImageBytes = MAX_CAPTCHA_IMAGE_BYTES,
): CaptchaChallenge {
  let offset = 0;

  // i32 targetId (4 bytes)
  if (body.length < offset + 4) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_TARGET_ID', 'header', offset, 'thiếu bytes cho targetId');
  }
  const targetId = body.readInt32BE(offset);
  offset += 4;

  // i8 menuId (1 byte signed)
  if (body.length < offset + 1) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_MENU_ID', 'header', offset, 'thiếu byte cho menuId');
  }
  const menuId = body.readInt8(offset);
  offset += 1;

  // UTF prompt (2 bytes uint16 len + utf8 string)
  if (body.length < offset + 2) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_PROMPT_LEN', 'prompt', offset, 'thiếu bytes cho prompt length');
  }
  const promptLen = body.readUInt16BE(offset);
  offset += 2;

  if (body.length < offset + promptLen) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_PROMPT_BODY', 'prompt', offset, 'thiếu bytes cho prompt content');
  }
  const prompt = body.toString('utf8', offset, offset + promptLen);
  offset += promptLen;

  // i8 inputType (1 byte signed)
  if (body.length < offset + 1) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_INPUT_TYPE', 'input-type', offset, 'thiếu byte cho inputType');
  }
  const inputType = body.readInt8(offset);
  offset += 1;

  // Optional image data
  if (offset === body.length) {
    return {
      targetId,
      menuId,
      prompt,
      inputType,
      imageBytes: null,
    };
  }

  // If there are bytes remaining, must have at least 2 bytes for image length
  if (body.length < offset + 2) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_IMAGE_LEN', 'image-header', offset, 'thiếu bytes cho image length');
  }
  const imageLength = body.readInt16BE(offset);
  offset += 2;

  if (imageLength <= 0) {
    throw new CaptchaProtocolDecodeError('INVALID_IMAGE_LEN', 'image-header', offset - 2, `imageLength không dương: ${imageLength}`);
  }

  if (imageLength > maxImageBytes) {
    throw new CaptchaProtocolDecodeError(
      'IMAGE_TOO_LARGE',
      'image-body',
      offset,
      `imageLength (${imageLength}) vượt quá giới hạn tối đa (${maxImageBytes})`,
    );
  }

  if (body.length < offset + imageLength) {
    throw new CaptchaProtocolDecodeError(
      'TRUNCATED_IMAGE_DATA',
      'image-body',
      offset,
      `dữ liệu ảnh bị cụt: cần ${imageLength} bytes, chỉ còn ${body.length - offset} bytes`,
    );
  }

  const imageBytes = Buffer.from(body.subarray(offset, offset + imageLength));
  offset += imageLength;

  if (offset < body.length) {
    throw new CaptchaProtocolDecodeError(
      'TRAILING_BYTES',
      'payload-end',
      offset,
      `còn ${body.length - offset} bytes thừa chưa giải mã ở cuối payload`,
    );
  }

  return {
    targetId,
    menuId,
    prompt,
    inputType,
    imageBytes,
  };
}

export function decodeCaptchaImage(challenge: CaptchaChallenge): DecodedCaptchaImage {
  if (!challenge.imageBytes || challenge.imageBytes.length === 0) {
    throw new CaptchaProtocolDecodeError('NO_IMAGE_DATA', 'image', null, 'challenge không chứa dữ liệu ảnh');
  }

  const format = detectImageFormat(challenge.imageBytes);
  if (!format) {
    throw new CaptchaProtocolDecodeError('UNRECOGNIZED_IMAGE_FORMAT', 'image', 0, 'magic bytes ảnh không phải PNG, JPEG hoặc GIF');
  }

  return {
    format,
    bytes: challenge.imageBytes,
  };
}
