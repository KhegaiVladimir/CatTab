// ─── Geometry ────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ─── FSM ─────────────────────────────────────────────────────────────────────

export enum BehaviorState {
  Idle = 'IDLE',
  Walking = 'WALKING',
  RunningToFood = 'RUNNING_TO_FOOD',
  Eating = 'EATING',
  Sleeping = 'SLEEPING',
  FollowingCursor = 'FOLLOWING_CURSOR',
  Sitting = 'SITTING',
}

/**
 * 8-way compass direction. Top-down sprites are rendered as unique poses per
 * direction (no flipping), so all eight values must be addressable in the
 * animation table.
 */
export enum Direction {
  North = 'N',
  NorthEast = 'NE',
  East = 'E',
  SouthEast = 'SE',
  South = 'S',
  SouthWest = 'SW',
  West = 'W',
  NorthWest = 'NW',
}

// ─── Pet Stats ────────────────────────────────────────────────────────────────

export interface PetStats {
  /** 0–100 */
  hunger: number;
  /** 0–100 */
  happiness: number;
  /** 0–100 */
  energy: number;
}

// ─── Full pet state (persisted in chrome.storage.local) ──────────────────────

export interface PetState {
  position: Vec2;
  behavior: BehaviorState;
  direction: Direction;
  stats: PetStats;
  /** Target position for WALKING / RUNNING_TO_FOOD */
  target: Vec2 | null;
  /** ID of the tab currently rendering the cat; null = no active tab */
  activeTabId: number | null;
}

// ─── Pet mode ────────────────────────────────────────────────────────────────

/**
 * User-selectable behavior mode.
 * - `auto`   — follows the cursor when it's within range, wanders otherwise (default).
 * - `follow` — only follows the cursor; never wanders on its own. Sits idle if no cursor.
 * - `wander` — never follows the cursor; just walks the screen on its own.
 *
 * Mode is enforced in the controller, not the FSM, so the FSM stays pure.
 * In `wander`, CURSOR_MOVED is never sent. In `follow`, IDLE_TIMEOUT is never sent.
 * Feeding (FOOD_APPEARED) is unaffected by mode.
 */
export type PetMode = 'auto' | 'follow' | 'wander';

// ─── Storage schema ───────────────────────────────────────────────────────────

export interface StorageSchema {
  petState: PetState;
  /** Hostnames where cat is hidden, e.g. ["twitter.com"] */
  blocklist: string[];
  /** Cat movement speed multiplier (0.5 – 2.0) */
  speedMultiplier: number;
  soundEnabled: boolean;
  petMode: PetMode;
  /** Whether the user dismissed the compat-warning banner in the popup. */
  compatWarningDismissed: boolean;
}

// ─── Settings with defaults ───────────────────────────────────────────────────

export const DEFAULT_PET_STATE: PetState = {
  position: { x: 100, y: 100 },
  behavior: BehaviorState.Idle,
  direction: Direction.South,
  stats: { hunger: 80, happiness: 80, energy: 100 },
  target: null,
  activeTabId: null,
};

export const DEFAULT_STORAGE: Omit<StorageSchema, 'petState'> = {
  blocklist: [],
  speedMultiplier: 1.0,
  soundEnabled: false,
  petMode: 'auto',
  compatWarningDismissed: false,
};
