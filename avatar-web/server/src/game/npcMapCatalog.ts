import type { NpcMapLocation } from '../session/automationTypes.js';

/**
 * Ordered production catalog from the live RX90 board-list for room 5:
 * 35 zero-based UI area indexes (0..34).
 *
 * The native map-5 join position is verified separately as (254,82). An empty
 * RX80 `specials` list means only that the target is absent from that area; it
 * does not promote any occupancy value to an NPC match.
 */
export const VERIFIED_NPC_MAP_CATALOG: readonly NpcMapLocation[] = Object.freeze(
  Array.from({ length: 35 }, (_, area): NpcMapLocation => ({ map: 5, area })),
);
