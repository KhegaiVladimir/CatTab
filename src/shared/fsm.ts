import { BehaviorState, Direction } from './types';
import type { PetState, Vec2 } from './types';
import type { FsmEvent } from './messages';

export interface FsmResult {
  nextState: PetState;
  /** true if the state actually changed (caller may want to broadcast) */
  changed: boolean;
}

/**
 * Pure state machine transition function.
 * Takes current state + an event, returns the next state.
 * All side effects (storage writes, broadcasts) happen in the service worker.
 */
export function transition(state: PetState, event: FsmEvent): FsmResult {
  const s = { ...state };

  switch (event.type) {
    case 'FOOD_APPEARED': {
      s.behavior = BehaviorState.RunningToFood;
      s.target = event.foodPos;
      s.direction = directionTo(s.position, event.foodPos, s.direction);
      return { nextState: s, changed: true };
    }

    case 'SIT_TIMEOUT': {
      if (s.behavior === BehaviorState.Idle) {
        s.behavior = BehaviorState.Sitting;
        s.target = null;
        return { nextState: s, changed: true };
      }
      return { nextState: s, changed: false };
    }

    case 'CURSOR_MOVED': {
      if (
        s.behavior === BehaviorState.Idle ||
        s.behavior === BehaviorState.Walking ||
        s.behavior === BehaviorState.FollowingCursor ||
        s.behavior === BehaviorState.Sitting
      ) {
        const wasFollowingCursor = s.behavior === BehaviorState.FollowingCursor;
        s.behavior = BehaviorState.FollowingCursor;
        s.target = event.cursorPos;
        const nextDir = directionTo(s.position, event.cursorPos, s.direction);
        const dirChanged = nextDir !== s.direction;
        s.direction = nextDir;
        // Suppress broadcast when nothing meaningful changed — same behavior,
        // same direction, just a target tweak. The controller is already moving
        // toward the (slightly-stale) target; one extra tick of drift is far
        // cheaper than another full state round-trip.
        return { nextState: s, changed: !wasFollowingCursor || dirChanged };
      }
      return { nextState: s, changed: false };
    }

    case 'CURSOR_LEFT_VIEWPORT': {
      if (s.behavior === BehaviorState.FollowingCursor) {
        s.behavior = BehaviorState.Idle;
        s.target = null;
        return { nextState: s, changed: true };
      }
      return { nextState: s, changed: false };
    }

    case 'REACHED_FOOD': {
      if (s.behavior === BehaviorState.RunningToFood) {
        s.behavior = BehaviorState.Eating;
        s.target = null;
        return { nextState: s, changed: true };
      }
      return { nextState: s, changed: false };
    }

    case 'EATING_DONE': {
      s.behavior = BehaviorState.Idle;
      s.stats = {
        ...s.stats,
        hunger: Math.min(100, s.stats.hunger + 30),
        happiness: Math.min(100, s.stats.happiness + 10),
        energy: Math.min(100, s.stats.energy + 10),
      };
      return { nextState: s, changed: true };
    }

    case 'ARRIVED': {
      if (
        s.behavior === BehaviorState.Walking ||
        s.behavior === BehaviorState.FollowingCursor
      ) {
        s.behavior = BehaviorState.Idle;
        s.target = null;
        return { nextState: s, changed: true };
      }
      return { nextState: s, changed: false };
    }

    case 'IDLE_TIMEOUT': {
      if (s.behavior === BehaviorState.Idle || s.behavior === BehaviorState.Sitting) {
        if (!event.wanderTarget) return { nextState: s, changed: false };
        s.behavior = BehaviorState.Walking;
        s.target = event.wanderTarget;
        s.direction = directionTo(s.position, s.target, s.direction);
        return { nextState: s, changed: true };
      }
      return { nextState: s, changed: false };
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Below this delta the cursor is functionally on top of the cat — direction
 * is meaningless and tiny pointer jitter would otherwise spam octant changes.
 */
const MIN_DIRECTION_DISTANCE_PX = 12;

/**
 * Past the perfect octant boundary (22.5°) we require an extra ~11° of angular
 * commitment before flipping direction. The result is a 33° "stay on this
 * direction" cone — a slow cursor crossing the boundary stops thrashing
 * between e.g. East and South-East on every throttle tick.
 */
const DIRECTION_HYSTERESIS_RAD = Math.PI / 16;

const HALF_OCTANT_RAD = Math.PI / 8;

function directionTo(from: Vec2, to: Vec2, previous?: Direction): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < MIN_DIRECTION_DISTANCE_PX) return previous ?? Direction.South;

  // atan2 returns radians in (-π, π]. Screen-space y grows downward.
  const angle = Math.atan2(dy, dx);
  const candidate = octantToDirection(angle);
  if (previous === undefined || previous === candidate) return candidate;

  // Hysteresis: keep the previous direction until the cursor's angle is
  // clearly inside a different octant. Without this, slow cursor moves at
  // an octant boundary flip the sprite on every 50ms throttle tick.
  const delta = wrapPi(angle - directionToAngle(previous));
  if (Math.abs(delta) < HALF_OCTANT_RAD + DIRECTION_HYSTERESIS_RAD) return previous;
  return candidate;
}

function octantToDirection(angle: number): Direction {
  const octant = Math.round(angle / (Math.PI / 4));
  switch (octant) {
    case 0:  return Direction.East;
    case 1:  return Direction.SouthEast;
    case 2:  return Direction.South;
    case 3:  return Direction.SouthWest;
    case 4:
    case -4: return Direction.West;
    case -3: return Direction.NorthWest;
    case -2: return Direction.North;
    case -1: return Direction.NorthEast;
    default: return Direction.South;
  }
}

function directionToAngle(d: Direction): number {
  switch (d) {
    case Direction.East:      return 0;
    case Direction.SouthEast: return Math.PI / 4;
    case Direction.South:     return Math.PI / 2;
    case Direction.SouthWest: return 3 * Math.PI / 4;
    case Direction.West:      return Math.PI;
    case Direction.NorthWest: return -3 * Math.PI / 4;
    case Direction.North:     return -Math.PI / 2;
    case Direction.NorthEast: return -Math.PI / 4;
  }
}

function wrapPi(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
