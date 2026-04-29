export const PET_SIZE = 92; // px — must match sprite frame size

/** How often stats tick (ms) */
export const STATS_TICK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

/** Stats drain per tick */
export const HUNGER_DRAIN_PER_TICK = 5;
export const HAPPINESS_DRAIN_PER_TICK = 3;
export const ENERGY_DRAIN_PER_TICK = 4;

/** Base movement speed in px/frame at 60fps */
export const BASE_SPEED_PX = 2.5;

/** Distance threshold to consider "reached target" (px) */
export const ARRIVAL_THRESHOLD_PX = 8;

/** Cursor follow activation radius (px) */
export const CURSOR_FOLLOW_RADIUS_PX = 200;

/** Debounce for storage writes (ms) */
export const STORAGE_DEBOUNCE_MS = 500;

/** Context menu item ID */
export const CONTEXT_MENU_FEED_ID = 'cattab_feed';

/** z-index for Shadow DOM host — one below max to let site chrome overlay if needed */
export const SHADOW_HOST_Z_INDEX = 2147483646;
