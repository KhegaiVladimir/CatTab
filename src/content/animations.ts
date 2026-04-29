import { BehaviorState, Direction } from './runtime-shared';

export interface AnimationConfig {
  /** Sprite sheet filename (relative to the active character's asset folder) */
  sprite: string;
  frameCount: number;
  /** Width and height of a single frame in px */
  frameSize: number;
  /** Duration of each frame in ms */
  frameDurationMs: number;
  loop: boolean;
}

/**
 * Two idle moods. Picked by the controller on each Idle entry — see
 * PetController.idleVariant. Bias toward `Exciting` when happiness is high.
 */
export type IdleVariant = 'calm' | 'exciting';

const FRAME_SIZE = 92;
const WALK_FRAME_MS = 120;
const RUN_FRAME_MS = 85;

/** Walk sprite per direction. Top-down poses are unique — no mirroring. */
const WALK_BY_DIRECTION: Record<Direction, string> = {
  [Direction.North]:     'walk_north.png',
  [Direction.NorthEast]: 'walk_north_east.png',
  [Direction.East]:      'walk_east.png',
  [Direction.SouthEast]: 'walk_south_east.png',
  [Direction.South]:     'walk_south.png',
  [Direction.SouthWest]: 'walk_south_west.png',
  [Direction.West]:      'walk_west.png',
  [Direction.NorthWest]: 'walk_north_west.png',
};

// East/West improved animations have 10 frames; all other directions have 6.
const WALK_FRAME_COUNT: Partial<Record<Direction, number>> = {
  [Direction.East]: 10,
  [Direction.West]: 10,
};

function walkConfig(dir: Direction, frameDurationMs: number): AnimationConfig {
  return {
    sprite: WALK_BY_DIRECTION[dir],
    frameCount: WALK_FRAME_COUNT[dir] ?? 6,
    frameSize: FRAME_SIZE,
    frameDurationMs,
    loop: true,
  };
}

export const IDLE_CONFIG_CALM: AnimationConfig = {
  sprite: 'idle_calm.png',
  frameCount: 6,
  frameSize: FRAME_SIZE,
  frameDurationMs: 180,
  loop: true,
};

const IDLE_CONFIG: Record<IdleVariant, AnimationConfig> = {
  calm: IDLE_CONFIG_CALM,
  exciting: {
    sprite: 'idle_exciting.png',
    frameCount: 6,
    frameSize: FRAME_SIZE,
    frameDurationMs: 130,
    loop: true,
  },
};

const EAT_CONFIG: AnimationConfig = {
  sprite: 'eat_south.png',
  frameCount: 6,
  frameSize: FRAME_SIZE,
  frameDurationMs: 120,
  loop: false,
};

/** Play animation — triggered by right-click "Play". Loops for the full play duration. */
export const PLAY_ANIM: AnimationConfig = {
  sprite: 'cat_playing.png',
  frameCount: 16,
  frameSize: FRAME_SIZE,
  frameDurationMs: 100,
  loop: true,
};

/** One-shot intro played when the cat first falls asleep. */
export const SLEEP_INTRO_ANIM: AnimationConfig = {
  sprite: 'sleep.png',
  frameCount: 8,
  frameSize: FRAME_SIZE,
  frameDurationMs: 180,
  loop: false,
};

/** Looping deep-sleep animation played after the intro finishes. */
export const SLEEP_ANIM: AnimationConfig = {
  sprite: 'sleep_loop.png',
  frameCount: 16,
  frameSize: FRAME_SIZE,
  frameDurationMs: 220,
  loop: true,
};

export const SIT_ANIM: AnimationConfig = {
  sprite: 'sit.png',
  frameCount: 8,
  frameSize: FRAME_SIZE,
  frameDurationMs: 180,
  loop: true,
};

/** One-shot played when entering Sitting — transitions from standing to seated. */
export const SIT_TRANSITION_ANIM: AnimationConfig = {
  sprite: 'sit_transition.png',
  frameCount: 9,
  frameSize: FRAME_SIZE,
  frameDurationMs: 80,
  loop: false,
};

/** One-shot played on left-click happy reaction. */
export const REACT_HAPPY_ANIM: AnimationConfig = {
  sprite: 'react_happy.png',
  frameCount: 9,
  frameSize: FRAME_SIZE,
  frameDurationMs: 140,
  loop: false,
};

/** Static fallback — guaranteed to exist. */
const FALLBACK: AnimationConfig = {
  sprite: 'base.png',
  frameCount: 1,
  frameSize: FRAME_SIZE,
  frameDurationMs: 9999,
  loop: true,
};

/**
 * Resolves the correct AnimationConfig for the current behavior + direction.
 * Sleeping has no dedicated artwork yet, so it falls back to `idle_calm` which
 * reads as "still and peaceful." When the sleep pose lands, add a Sleeping
 * branch here.
 */
export function resolveAnimation(
  behavior: BehaviorState,
  direction: Direction,
  idleVariant: IdleVariant,
): AnimationConfig {
  switch (behavior) {
    case BehaviorState.Idle:
      return IDLE_CONFIG[idleVariant];

    case BehaviorState.Walking:
    case BehaviorState.FollowingCursor:
      return walkConfig(direction, WALK_FRAME_MS);

    case BehaviorState.RunningToFood:
      return walkConfig(direction, RUN_FRAME_MS);

    case BehaviorState.Eating:
      return EAT_CONFIG;

    case BehaviorState.Sleeping:
      return SLEEP_ANIM;

    case BehaviorState.Sitting:
      return SIT_ANIM;

    default:
      return FALLBACK;
  }
}
