import type { Direction, PetState, Vec2 } from './types';

// ─── Message type discriminants ──────────────────────────────────────────────

export const enum MsgType {
  /** SW → all content scripts: full state snapshot */
  StateUpdated = 'STATE_UPDATED',
  /** Content → SW: request an FSM transition */
  RequestStateChange = 'REQUEST_STATE_CHANGE',
  /** Content → SW: food was placed on a page */
  FoodSpawned = 'FOOD_SPAWNED',
  /** Content → SW: this tab is now focused */
  TabBecameActive = 'TAB_BECAME_ACTIVE',
  /** Content → SW: this tab is being unloaded */
  TabBecameInactive = 'TAB_BECAME_INACTIVE',
  /** Content → SW: user clicked the cat */
  PetClicked = 'PET_CLICKED',
  /** Content → SW: user invoked an action from the right-click pet menu */
  PetAction = 'PET_ACTION',
}

/**
 * Actions invokable from the right-click-on-pet menu.
 * `hide` is handled directly in the content script (storage write) and never
 * reaches the SW — listed here only for type completeness.
 */
export type PetActionId = 'sleep' | 'wake' | 'play' | 'hide';

// ─── FSM events that content can request ────────────────────────────────────

export type FsmEvent =
  | { type: 'FOOD_APPEARED'; foodPos: Vec2 }
  | { type: 'CURSOR_MOVED'; cursorPos: Vec2 }
  | { type: 'CURSOR_LEFT_VIEWPORT' }
  | { type: 'REACHED_FOOD' }
  | { type: 'EATING_DONE' }
  | { type: 'ARRIVED' }
  | { type: 'IDLE_TIMEOUT'; wanderTarget: Vec2 }
  | { type: 'SIT_TIMEOUT' };

// ─── Typed message shapes ────────────────────────────────────────────────────

export interface MsgStateUpdated {
  type: MsgType.StateUpdated;
  state: PetState;
}

export interface MsgRequestStateChange {
  type: MsgType.RequestStateChange;
  event: FsmEvent;
  actorPosition?: Vec2;
  actorDirection?: Direction;
}

export interface MsgFoodSpawned {
  type: MsgType.FoodSpawned;
  position: Vec2;
  tabId: number;
}

export interface MsgTabBecameActive {
  type: MsgType.TabBecameActive;
}

export interface MsgTabBecameInactive {
  type: MsgType.TabBecameInactive;
}

export interface MsgPetClicked {
  type: MsgType.PetClicked;
}

export interface MsgPetAction {
  type: MsgType.PetAction;
  action: Exclude<PetActionId, 'hide'>;
}

export type ExtensionMessage =
  | MsgStateUpdated
  | MsgRequestStateChange
  | MsgFoodSpawned
  | MsgTabBecameActive
  | MsgTabBecameInactive
  | MsgPetClicked
  | MsgPetAction;
