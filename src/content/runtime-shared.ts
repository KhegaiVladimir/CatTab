export enum BehaviorState {
  Idle = 'IDLE',
  Walking = 'WALKING',
  RunningToFood = 'RUNNING_TO_FOOD',
  Eating = 'EATING',
  Sleeping = 'SLEEPING',
  FollowingCursor = 'FOLLOWING_CURSOR',
  Sitting = 'SITTING',
}

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

export interface Vec2 {
  x: number;
  y: number;
}

export interface PetStats {
  hunger: number;
  happiness: number;
  energy: number;
}

export interface PetState {
  position: Vec2;
  behavior: BehaviorState;
  direction: Direction;
  stats: PetStats;
  target: Vec2 | null;
  activeTabId: number | null;
}

export type PetMode = 'auto' | 'follow' | 'wander';

export interface StorageSchema {
  petState: PetState;
  blocklist: string[];
  speedMultiplier: number;
  soundEnabled: boolean;
  petMode: PetMode;
  compatWarningDismissed: boolean;
}

export const DEFAULT_PET_STATE: PetState = {
  position: { x: 100, y: 100 },
  behavior: BehaviorState.Idle,
  direction: Direction.South,
  stats: { hunger: 80, happiness: 80, energy: 100 },
  target: null,
  activeTabId: null,
};

export const PET_SIZE = 92;
export const BASE_SPEED_PX = 2.5;
export const ARRIVAL_THRESHOLD_PX = 8;
export const CURSOR_FOLLOW_RADIUS_PX = 200;

export const enum MsgType {
  StateUpdated = 'STATE_UPDATED',
  RequestStateChange = 'REQUEST_STATE_CHANGE',
  FoodSpawned = 'FOOD_SPAWNED',
  TabBecameActive = 'TAB_BECAME_ACTIVE',
  TabBecameInactive = 'TAB_BECAME_INACTIVE',
  PetClicked = 'PET_CLICKED',
  PetAction = 'PET_ACTION',
}

export type PetActionId = 'sleep' | 'wake' | 'play' | 'hide';

export type FsmEvent =
  | { type: 'FOOD_APPEARED'; foodPos: Vec2 }
  | { type: 'CURSOR_MOVED'; cursorPos: Vec2 }
  | { type: 'CURSOR_LEFT_VIEWPORT' }
  | { type: 'REACHED_FOOD' }
  | { type: 'EATING_DONE' }
  | { type: 'ARRIVED' }
  | { type: 'IDLE_TIMEOUT'; wanderTarget: Vec2 }
  | { type: 'SIT_TIMEOUT' };

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
