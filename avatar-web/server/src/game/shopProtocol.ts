import { MyReader } from '../proto/reader.js';

export interface OwnShopSlot {
  slot: number;
  itemId: number;
  quantity: number;
  price: number;
  isSale: boolean;
  isTimeOut: boolean;
}

export interface MarketListing {
  index: number;
  idShop: number;
  verShop: number;
  itemId: number;
  quantity: number;
  price: number;
}

export interface MarketCatalogItem {
  itemId: number;
  price: number;
}

export interface ShopPriceRule {
  itemId: number;
  minPrice: number;
  maxPrice: number;
}

export type ShopProtocolEvent =
  | { subType: 0; kind: 'own-snapshot'; slots: OwnShopSlot[]; numSlot: number; canOpenSlot: boolean }
  | {
      subType: 1;
      kind: 'market-catalog';
      status: 0;
      items: MarketCatalogItem[];
      timeRefresh: number;
      priceRefresh: number;
    }
  | { subType: 1; kind: 'market-listings'; status: 1; listings: MarketListing[] }
  | { subType: 2; kind: 'slot-info'; state: 0; type: number; value: number }
  | { subType: 2; kind: 'slot-opened'; state: 1; type: number; value: number; numSlot: number; canOpenSlot: boolean }
  | { subType: 3; kind: 'listing-added'; slot: number; itemId: number; quantity: number; price: number }
  | { subType: 4; kind: 'listing-withdrawn'; slot: number; result: 0; value: number }
  | { subType: 4; kind: 'listing-withdrawn'; slot: number; result: 1; itemId: number; value: number }
  | { subType: 5; kind: 'purchase-ack'; itemId: number; value: number }
  | { subType: 6 | 7; kind: 'refresh' }
  | { subType: 8; kind: 'price-rules'; rules: ShopPriceRule[] };

export interface ShopProtocolWarning {
  code: 'TRAILING_BYTES';
  remaining: number;
}

export interface DecodedShopPacket {
  event: ShopProtocolEvent;
  warning?: ShopProtocolWarning;
}

const MAX_OWN_SLOTS = 127;
const MAX_MARKET_LISTINGS = 4096;
const MAX_PRICE_RULES = 4096;
const ERROR_HEX_PREFIX_BYTES = 32;

export class ShopProtocolDecodeError extends Error {
  readonly code = 'SHOP_PROTOCOL_ERROR';
  readonly offset: number;
  readonly hexPrefix: string;

  constructor(message: string, offset: number, body: Buffer) {
    super(`${message} tại offset ${offset}`);
    this.name = 'ShopProtocolDecodeError';
    this.offset = offset;
    this.hexPrefix = body.subarray(0, ERROR_HEX_PREFIX_BYTES).toString('hex');
  }
}

function need(reader: MyReader, bytes: number, field: string, body: Buffer): void {
  if (reader.available() < bytes) {
    throw new ShopProtocolDecodeError(
      `cmd 103 thiếu ${bytes} byte cho ${field}, còn ${reader.available()}`,
      reader.position,
      body,
    );
  }
}

function readByte(reader: MyReader, field: string, body: Buffer): number {
  need(reader, 1, field, body);
  return reader.readByte();
}

function readUnsignedByte(reader: MyReader, field: string, body: Buffer): number {
  need(reader, 1, field, body);
  return reader.readUnsignedByte();
}

function readBoolean(reader: MyReader, field: string, body: Buffer): boolean {
  need(reader, 1, field, body);
  return reader.readBoolean();
}

function readShort(reader: MyReader, field: string, body: Buffer): number {
  need(reader, 2, field, body);
  return reader.readShort();
}

function readInt(reader: MyReader, field: string, body: Buffer): number {
  need(reader, 4, field, body);
  return reader.readInt();
}

function validateCount(
  count: number,
  max: number,
  label: string,
  reader: MyReader,
  body: Buffer,
  minimumRecordBytes = 0,
  trailingBytes = 0,
): void {
  if (count < 0 || count > max) {
    throw new ShopProtocolDecodeError(`${label} không hợp lệ: ${count}`, reader.position, body);
  }
  if (minimumRecordBytes > 0) {
    const required = count * minimumRecordBytes + trailingBytes;
    if (required > reader.available()) {
      throw new ShopProtocolDecodeError(
        `${label}=${count} cần tối thiểu ${required} byte, còn ${reader.available()}`,
        reader.position,
        body,
      );
    }
  }
}

function decodeEvent(reader: MyReader, body: Buffer): ShopProtocolEvent {
  const subType = readUnsignedByte(reader, 'subType', body);
  switch (subType) {
    case 0: {
      const count = readByte(reader, 'own.count', body);
      validateCount(count, MAX_OWN_SLOTS, 'own.count', reader, body, 2, 1);
      const slots: OwnShopSlot[] = [];
      for (let slot = 0; slot < count; slot += 1) {
        const itemId = readShort(reader, `own[${slot}].itemId`, body);
        if (itemId === -1) {
          slots.push({
            slot,
            itemId,
            quantity: 0,
            price: 0,
            isSale: false,
            isTimeOut: false,
          });
          continue;
        }
        const quantity = readInt(reader, `own[${slot}].quantity`, body);
        const price = readInt(reader, `own[${slot}].price`, body);
        const isSale = readBoolean(reader, `own[${slot}].isSale`, body);
        const isTimeOut = isSale
          ? false
          : readBoolean(reader, `own[${slot}].isTimeOut`, body);
        slots.push({ slot, itemId, quantity, price, isSale, isTimeOut });
      }
      const canOpenSlot = readBoolean(reader, 'own.canOpenSlot', body);
      return { subType: 0, kind: 'own-snapshot', slots, numSlot: count, canOpenSlot };
    }
    case 1: {
      const status = readByte(reader, 'market.status', body);
      const count = readShort(reader, 'market.count', body);

      if (status === 0) {
        validateCount(count, MAX_MARKET_LISTINGS, 'market.catalog.count', reader, body, 6, 8);
        const items: MarketCatalogItem[] = [];
        for (let index = 0; index < count; index += 1) {
          items.push({
            itemId: readShort(reader, `market.catalog[${index}].itemId`, body),
            price: readInt(reader, `market.catalog[${index}].price`, body),
          });
        }
        const timeRefresh = readInt(reader, 'market.timeRefresh', body);
        const priceRefresh = readInt(reader, 'market.priceRefresh', body);
        return {
          subType: 1,
          kind: 'market-catalog',
          status: 0,
          items,
          timeRefresh,
          priceRefresh,
        };
      }

      if (status === 1) {
        validateCount(count, MAX_MARKET_LISTINGS, 'market.listings.count', reader, body, 16);
        const listings: MarketListing[] = [];
        for (let index = 0; index < count; index += 1) {
          listings.push({
            index,
            idShop: readInt(reader, `market.listings[${index}].idShop`, body),
            verShop: readShort(reader, `market.listings[${index}].verShop`, body),
            itemId: readShort(reader, `market.listings[${index}].itemId`, body),
            quantity: readInt(reader, `market.listings[${index}].quantity`, body),
            price: readInt(reader, `market.listings[${index}].price`, body),
          });
        }
        return { subType: 1, kind: 'market-listings', status: 1, listings };
      }

      throw new ShopProtocolDecodeError(
        `market.status không hỗ trợ: ${status}`,
        reader.position - 3,
        body,
      );
    }
    case 2: {
      const state = readByte(reader, 'slot.state', body);
      if (state !== 0 && state !== 1) {
        throw new ShopProtocolDecodeError(`slot.state không hỗ trợ: ${state}`, reader.position - 1, body);
      }
      const type = readByte(reader, 'slot.type', body);
      const value = readInt(reader, 'slot.value', body);
      if (state === 0) return { subType: 2, kind: 'slot-info', state, type, value };
      const numSlot = readByte(reader, 'slot.numSlot', body);
      if (numSlot < 0) {
        throw new ShopProtocolDecodeError(`slot.numSlot không hợp lệ: ${numSlot}`, reader.position - 1, body);
      }
      const canOpenSlot = readBoolean(reader, 'slot.canOpenSlot', body);
      return { subType: 2, kind: 'slot-opened', state, type, value, numSlot, canOpenSlot };
    }
    case 3:
      return {
        subType: 3,
        kind: 'listing-added',
        slot: readByte(reader, 'listing.slot', body),
        itemId: readShort(reader, 'listing.itemId', body),
        quantity: readInt(reader, 'listing.quantity', body),
        price: readInt(reader, 'listing.price', body),
      };
    case 4: {
      const slot = readByte(reader, 'withdraw.slot', body);
      const result = readByte(reader, 'withdraw.result', body);
      if (result === 0) {
        return { subType: 4, kind: 'listing-withdrawn', slot, result, value: readInt(reader, 'withdraw.value', body) };
      }
      if (result === 1) {
        return {
          subType: 4,
          kind: 'listing-withdrawn',
          slot,
          result,
          itemId: readShort(reader, 'withdraw.itemId', body),
          value: readInt(reader, 'withdraw.value', body),
        };
      }
      throw new ShopProtocolDecodeError(`withdraw.result không hỗ trợ: ${result}`, reader.position - 1, body);
    }
    case 5:
      return {
        subType: 5,
        kind: 'purchase-ack',
        itemId: readShort(reader, 'purchase.itemId', body),
        value: readInt(reader, 'purchase.value', body),
      };
    case 6:
    case 7:
      return { subType, kind: 'refresh' };
    case 8: {
      const count = readShort(reader, 'rules.count', body);
      validateCount(count, MAX_PRICE_RULES, 'rules.count', reader, body, 10);
      const rules: ShopPriceRule[] = [];
      for (let index = 0; index < count; index += 1) {
        rules.push({
          itemId: readShort(reader, `rules[${index}].itemId`, body),
          minPrice: readInt(reader, `rules[${index}].minPrice`, body),
          maxPrice: readInt(reader, `rules[${index}].maxPrice`, body),
        });
      }
      return { subType: 8, kind: 'price-rules', rules };
    }
    default:
      throw new ShopProtocolDecodeError(`subType cmd 103 không hỗ trợ: ${subType}`, 0, body);
  }
}

export function decodeShopPacket(body: Buffer): DecodedShopPacket {
  const reader = new MyReader(body);
  const event = decodeEvent(reader, body);
  const remaining = reader.available();
  return remaining > 0
    ? { event, warning: { code: 'TRAILING_BYTES', remaining } }
    : { event };
}

export interface StallInnerLimit {
  innerMin: number;
  innerMax: number;
}

/**
 * Giới hạn đơn giá nghiệp vụ thực tế trên game server AvatarHD (Live-verified 100%).
 * Server game kiểm tra giá qua 2 tầng:
 * - Tầng 1 (Protocol cmd 103 sub 8): Khoảng giá kỹ thuật cũ (30-500 xu).
 * - Tầng 2 (Inner Server Limit): Chặn cứng theo giá thị trường động.
 * Khoảng giá thực tế có thể bán được là giao giữa 2 tầng:
 * minPrice = Math.max(protocolMin, innerMin)
 * maxPrice = Math.min(protocolMax, innerMax)
 */
export const STALL_INNER_PRICE_LIMITS: Readonly<Record<number, StallInnerLimit>> = Object.freeze({
  // Cây trồng cơ bản (#0 – #10)
  0: { innerMin: 1, innerMax: 10 },   // Cà chua
  1: { innerMin: 1, innerMax: 10 },   // Cà rốt
  2: { innerMin: 1, innerMax: 10 },   // Khóm (Dứa)
  3: { innerMin: 1, innerMax: 10 },   // Dưa Hấu
  4: { innerMin: 1, innerMax: 10 },   // Nho
  5: { innerMin: 1, innerMax: 10 },   // Hoa Hồng
  6: { innerMin: 1, innerMax: 10 },   // Lúa
  7: { innerMin: 1, innerMax: 10 },   // Xoài
  8: { innerMin: 1, innerMax: 10 },   // Thanh long
  9: { innerMin: 1, innerMax: 10 },   // Hoa hướng dương
  10: { innerMin: 1, innerMax: 10 },  // Hoa tulip

  // Sản phẩm chăn nuôi
  50: { innerMin: 8, innerMax: 30 },  // Trứng Gà (protocol min 10 -> 10 - 30 xu)
  51: { innerMin: 16, innerMax: 40 }, // Sữa Bò (protocol min 20 -> 20 - 40 xu)
  55: { innerMin: 8, innerMax: 30 },  // Trứng Vịt (protocol min 30 -> đúng 30 xu)
  56: { innerMin: 72, innerMax: 110 },// Lông Cừu (72 - 110 xu)
  60: { innerMin: 48, innerMax: 80 }, // Sữa Dê (protocol min 60 -> 60 - 80 xu)

  // Cây vụ mùa / cao cấp
  200: { innerMin: 1, innerMax: 20 }, // Bắp (protocol min 3 -> 3 - 20 xu)
  201: { innerMin: 1, innerMax: 20 }, // Nha đam (protocol min 3 -> 3 - 20 xu)
  202: { innerMin: 1, innerMax: 10 }, // Dưa Leo (2 - 10 xu)
  204: { innerMin: 1, innerMax: 10 }, // Tỏi (2 - 10 xu)
  248: { innerMin: 1, innerMax: 10 }, // Dâu Tây (2 - 10 xu)
  249: { innerMin: 1, innerMax: 10 }, // Chuối (2 - 10 xu)
  270: { innerMin: 1, innerMax: 10 }, // Bí Ngô (2 - 10 xu)
  271: { innerMin: 3, innerMax: 30 }, // Khoai Tây (protocol min 6 -> 6 - 30 xu)
  286: { innerMin: 1, innerMax: 10 }, // Ớt hiểm (1 - 10 xu)
  288: { innerMin: 1, innerMax: 10 }, // Cải Thảo (3 - 10 xu)
});

/**
 * Chuẩn hoá danh sách giá sạp thô từ server (cmd 103 sub 8) theo khoảng giá thực tế
 * mà server chấp nhận trên wire (giao giữa protocol limits và inner server limits).
 */
export function resolveEffectivePriceRules(rules: readonly ShopPriceRule[]): ShopPriceRule[] {
  return rules.map((rule) => {
    const inner = STALL_INNER_PRICE_LIMITS[rule.itemId];
    if (!inner) return { ...rule };

    const minPrice = Math.max(rule.minPrice, inner.innerMin);
    const maxPrice = Math.min(rule.maxPrice, inner.innerMax);

    return {
      itemId: rule.itemId,
      minPrice: Math.min(minPrice, maxPrice),
      maxPrice: Math.max(minPrice, maxPrice),
    };
  });
}

