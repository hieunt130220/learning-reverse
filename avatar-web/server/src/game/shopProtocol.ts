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

export interface ShopPriceRule {
  itemId: number;
  minPrice: number;
  maxPrice: number;
}

export type ShopProtocolEvent =
  | { subType: 0; kind: 'own-snapshot'; slots: OwnShopSlot[]; numSlot: number; canOpenSlot: boolean }
  | { subType: 1; kind: 'market-snapshot'; status: number; listings: MarketListing[] }
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
      validateCount(count, MAX_OWN_SLOTS, 'own.count', reader, body, 11, 1);
      const slots: OwnShopSlot[] = [];
      for (let slot = 0; slot < count; slot += 1) {
        const itemId = readShort(reader, `own[${slot}].itemId`, body);
        const quantity = readInt(reader, `own[${slot}].quantity`, body);
        const price = readInt(reader, `own[${slot}].price`, body);
        const isSale = readBoolean(reader, `own[${slot}].isSale`, body);
        const isTimeOut = isSale ? false : readBoolean(reader, `own[${slot}].isTimeOut`, body);
        slots.push({ slot, itemId, quantity, price, isSale, isTimeOut });
      }
      const canOpenSlot = readBoolean(reader, 'own.canOpenSlot', body);
      return { subType: 0, kind: 'own-snapshot', slots, numSlot: count, canOpenSlot };
    }
    case 1: {
      const status = readByte(reader, 'market.status', body);
      const count = readShort(reader, 'market.count', body);
      validateCount(
        count,
        MAX_MARKET_LISTINGS,
        'market.count',
        reader,
        body,
        status === 1 ? 16 : 0,
      );
      const listings: MarketListing[] = [];
      if (status === 1) {
        for (let index = 0; index < count; index += 1) {
          listings.push({
            index,
            idShop: readInt(reader, `market[${index}].idShop`, body),
            verShop: readShort(reader, `market[${index}].verShop`, body),
            itemId: readShort(reader, `market[${index}].itemId`, body),
            quantity: readInt(reader, `market[${index}].quantity`, body),
            price: readInt(reader, `market[${index}].price`, body),
          });
        }
      }
      return { subType: 1, kind: 'market-snapshot', status, listings };
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
