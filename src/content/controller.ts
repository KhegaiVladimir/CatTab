import {
  BehaviorState,
  DEFAULT_PET_STATE,
  BASE_SPEED_PX,
  ARRIVAL_THRESHOLD_PX,
  CURSOR_FOLLOW_RADIUS_PX,
  PET_SIZE,
  MsgType,
} from './runtime-shared';
import type {
  PetState,
  Vec2,
  ExtensionMessage,
  FsmEvent,
  PetMode,
  StorageSchema,
} from './runtime-shared';
import { PetRenderer, clampToViewport } from './renderer';
import type { ActionMenuItem } from './renderer';
import { resolveAnimation, PLAY_ANIM, SIT_TRANSITION_ANIM, REACT_HAPPY_ANIM, SLEEP_INTRO_ANIM, IDLE_CONFIG_CALM } from './animations';
import type { IdleVariant } from './animations';

/**
 * Orchestrates per-frame logic: reads state, moves pet, drives renderer,
 * and sends messages to the service worker on significant events.
 */
const EATING_DURATION_MS = 2400; // ~8 frames × 120ms + small buffer
const MOUSEMOVE_THROTTLE_MS = 50; // max ~20 SW messages/sec from cursor

export class PetController {
  private state: PetState = { ...DEFAULT_PET_STATE };
  private rafId = 0;
  private speedMultiplier = 1.0;
  private mode: PetMode = 'auto';
  private readonly spriteBaseUrl: string;
  private lastTickTs = 0;
  private idleElapsedMs = 0;
  private idleTriggerMs = nextIdleTriggerMs();
  private eatingElapsedMs = 0;
  private lastMouseSendTs = 0;
  // Picked once per Idle entry so the same mood plays through a session.
  // Re-rolled by `refreshIdleVariant` whenever the behavior transitions back into Idle.
  private idleVariant: IdleVariant = 'calm';
  private wasIdleLastTick = false;
  // Play animation override: counts down while cat "plays" (16 frames × 100ms × 2.5 cycles)
  private playAnimRemainingMs = 0;
  private static readonly PLAY_ANIM_MS = 4000;
  // Sit-transition one-shot: plays when entering Sitting state
  private sitTransitionRemainingMs = 0;
  // React-happy one-shot: plays on left-click
  private reactHappyRemainingMs = 0;
  private static readonly REACT_HAPPY_ANIM_MS = 9 * 140; // 9 frames × 140ms
  // Sleep intro one-shot: plays when entering Sleeping, then loops sleep_loop
  private sleepIntroRemainingMs = 0;
  // Post-override idle buffer: after play/react_happy, hold idle_calm briefly
  // so the cat doesn't abruptly jump into a new FSM state.
  private postOverrideIdleMs = 0;
  private static readonly POST_OVERRIDE_IDLE_MS = 350;
  // Sitting wander timer: after SIT_WANDER_MS in Sitting, cat gets up and wanders
  private sittingElapsedMs = 0;
  private static readonly SIT_WANDER_MS = 8000;
  // Pin: when true the cat stays put, ignoring cursor and wander
  private pinned = false;

  private readonly emotionsBaseUrl: string;
  private lastBubbleTs = 0;
  private static readonly BUBBLE_COOLDOWN_MS = 20_000;

  constructor(
    private readonly renderer: PetRenderer,
    spriteBaseUrl: string,
  ) {
    this.spriteBaseUrl = spriteBaseUrl;
    this.emotionsBaseUrl = spriteBaseUrl + 'emotions_etc/';
    this.renderer.setHeartUrl(this.emotionsBaseUrl + 'heart.png');
    this.renderer.onClick(() => this.onPetClick());
    this.renderer.onRightClick(() => this.onPetRightClick());
  }

  /** Apply a state snapshot broadcast from the service worker. */
  applyState(state: PetState): void {
    const enteringIdle =
      state.behavior === BehaviorState.Idle && this.state.behavior !== BehaviorState.Idle;
    const enteringSitting =
      state.behavior === BehaviorState.Sitting && this.state.behavior !== BehaviorState.Sitting;
    const enteringSleeping =
      state.behavior === BehaviorState.Sleeping && this.state.behavior !== BehaviorState.Sleeping;
    this.state = state;
    if (enteringIdle) this.refreshIdleVariant();
    if (enteringSleeping) {
      this.tryShowBubble('sleepy_bubble.png');
    }
    if (enteringSitting) {
      this.sitTransitionRemainingMs = SIT_TRANSITION_ANIM.frameCount * SIT_TRANSITION_ANIM.frameDurationMs;
      this.sittingElapsedMs = 0;
    }
    if (enteringSleeping) {
      this.sleepIntroRemainingMs = SLEEP_INTRO_ANIM.frameCount * SLEEP_INTRO_ANIM.frameDurationMs;
    }
  }

  applySpeedMultiplier(mult: number): void {
    this.speedMultiplier = mult;
  }

  /**
   * Switch pet behavior mode. Takes effect immediately — no tab reload required.
   * In-flight motion (a wander leg already underway, or a chase already started)
   * runs to completion gracefully; gating only suppresses NEW transitions.
   */
  applyMode(mode: PetMode): void {
    this.mode = mode;
  }

  /** Start the RAF loop. Safe to call multiple times — idempotent. */
  start(): void {
    if (this.rafId !== 0) return;
    this.loop(performance.now());
  }

  /** Stop the RAF loop (e.g. when tab becomes hidden). */
  stop(): void {
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private loop(timestamp: number): void {
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
    this.tick(timestamp);
  }

  private tick(timestamp: number): void {
    const deltaMs = this.lastTickTs === 0 ? 0 : timestamp - this.lastTickTs;
    this.lastTickTs = timestamp;
    const speed = BASE_SPEED_PX * this.speedMultiplier;
    const s = this.state;

    const overridePlaying = this.playAnimRemainingMs > 0 || this.reactHappyRemainingMs > 0;

    // Move toward target if we have one — frozen during one-shot override animations
    if (s.target !== null && !overridePlaying) {
      const { x, y } = moveToward(s.position, s.target, speed);
      this.state = { ...s, position: { x, y } };

      const dist = distance(this.state.position, s.target);
      if (dist <= ARRIVAL_THRESHOLD_PX) {
        const eventType =
          s.behavior === BehaviorState.RunningToFood ? 'REACHED_FOOD' : 'ARRIVED';
        this.sendStateChange({ type: eventType });
      }
    }

    // Clamp to viewport
    const clamped = clampToViewport(this.state.position.x, this.state.position.y);
    this.state = { ...this.state, position: clamped };

    // First tick after the cat ever spawned counts as entering idle, so the
    // initial pose isn't always `calm`. After that, applyState() handles
    // re-rolls on every transition into Idle.
    if (this.state.behavior === BehaviorState.Idle && !this.wasIdleLastTick) {
      this.refreshIdleVariant();
    }
    this.wasIdleLastTick = this.state.behavior === BehaviorState.Idle;

    const wasPlay = this.playAnimRemainingMs > 0;
    const wasReact = this.reactHappyRemainingMs > 0;

    if (this.playAnimRemainingMs > 0) {
      this.playAnimRemainingMs = Math.max(0, this.playAnimRemainingMs - deltaMs);
    }
    if (this.sitTransitionRemainingMs > 0) {
      this.sitTransitionRemainingMs = Math.max(0, this.sitTransitionRemainingMs - deltaMs);
    }
    if (this.reactHappyRemainingMs > 0) {
      this.reactHappyRemainingMs = Math.max(0, this.reactHappyRemainingMs - deltaMs);
    }
    if (this.sleepIntroRemainingMs > 0) {
      this.sleepIntroRemainingMs = Math.max(0, this.sleepIntroRemainingMs - deltaMs);
    }
    if (this.postOverrideIdleMs > 0) {
      this.postOverrideIdleMs = Math.max(0, this.postOverrideIdleMs - deltaMs);
    }

    // When a play or react_happy override just finished, start the idle buffer
    // so the cat holds a calm pose before the FSM can transition it elsewhere.
    if ((wasPlay && this.playAnimRemainingMs === 0) ||
        (wasReact && this.reactHappyRemainingMs === 0)) {
      this.postOverrideIdleMs = PetController.POST_OVERRIDE_IDLE_MS;
    }

    const overrideActive = overridePlaying;

    let anim;
    if (this.playAnimRemainingMs > 0) {
      anim = PLAY_ANIM;
    } else if (this.reactHappyRemainingMs > 0) {
      anim = REACT_HAPPY_ANIM;
    } else if (this.postOverrideIdleMs > 0) {
      anim = IDLE_CONFIG_CALM;
    } else if (this.sitTransitionRemainingMs > 0 && this.state.behavior === BehaviorState.Sitting) {
      anim = SIT_TRANSITION_ANIM;
    } else if (this.sleepIntroRemainingMs > 0 && this.state.behavior === BehaviorState.Sleeping) {
      anim = SLEEP_INTRO_ANIM;
    } else {
      anim = resolveAnimation(this.state.behavior, this.state.direction, this.idleVariant);
    }
    this.renderer.moveTo(clamped.x, clamped.y);
    this.renderer.tick(timestamp, anim, this.spriteBaseUrl);

    if (!overrideActive) {
      this.tickIdleWander(deltaMs);
      this.tickSitting(deltaMs);
    }
    this.tickEating(deltaMs);
  }

  /** Handle cursor movement — throttled to avoid spamming SW. */
  onCursorMove(cursor: Vec2, now: number): void {
    if (this.pinned) return;
    if (this.mode === 'wander') return;
    if (this.renderer.isActionMenuOpen()) return;
    // Hold still during one-shot override animations (play, react_happy).
    if (this.playAnimRemainingMs > 0 || this.reactHappyRemainingMs > 0) return;

    // The cat's `position` is its top-left corner; the cursor should appear
    // at the cat's CENTER, not its corner. Offset the target by half the
    // sprite so when the cat reaches it, its centre coincides with the cursor.
    const target: Vec2 = { x: cursor.x - PET_SIZE / 2, y: cursor.y - PET_SIZE / 2 };

    // Distance check measured from the cat's centre to the actual cursor —
    // matches the user's mental model of "is my cursor near the cat".
    const catCenter: Vec2 = {
      x: this.state.position.x + PET_SIZE / 2,
      y: this.state.position.y + PET_SIZE / 2,
    };
    const dist = distance(catCenter, cursor);
    // `auto` keeps the proximity gate so the cat doesn't chase distant cursors.
    // `follow` removes the gate — if the user explicitly opted in, they expect
    // the cat to come from across the screen.
    if (this.mode === 'auto' && dist >= CURSOR_FOLLOW_RADIUS_PX) return;
    if (now - this.lastMouseSendTs < MOUSEMOVE_THROTTLE_MS) return;
    this.lastMouseSendTs = now;
    this.sendStateChange({ type: 'CURSOR_MOVED', cursorPos: target });
  }

  onCursorLeft(): void {
    if (this.mode === 'wander') return;
    this.sendStateChange({ type: 'CURSOR_LEFT_VIEWPORT' });
  }

  private sendStateChange(event: FsmEvent): void {
    this.sendToSW({
      type: MsgType.RequestStateChange,
      event,
      actorPosition: this.state.position,
      actorDirection: this.state.direction,
    });
  }

  private sendToSW(msg: ExtensionMessage): void {
    if (!isExtensionContextAlive()) return;
    try {
      chrome.runtime.sendMessage(msg).catch(() => {
        // SW may be sleeping; it will re-broadcast state on wake
      });
    } catch {
      // Extension context can be invalidated during extension reload.
    }
  }

  private tickEating(deltaMs: number): void {
    if (this.state.behavior !== BehaviorState.Eating) {
      this.eatingElapsedMs = 0;
      return;
    }
    this.eatingElapsedMs += deltaMs;
    if (this.eatingElapsedMs >= EATING_DURATION_MS) {
      this.eatingElapsedMs = 0;
      this.sendStateChange({ type: 'EATING_DONE' });
    }
  }

  private tickIdleWander(deltaMs: number): void {
    if (this.state.behavior !== BehaviorState.Idle) {
      this.idleElapsedMs = 0;
      return;
    }
    // Pinned or follow mode: the cat sits idle, no autonomous wandering.
    if (this.pinned || this.mode === 'follow') {
      this.idleElapsedMs = 0;
      return;
    }
    this.idleElapsedMs += deltaMs;
    if (this.idleElapsedMs < this.idleTriggerMs) return;

    this.idleElapsedMs = 0;
    this.idleTriggerMs = nextIdleTriggerMs();
    // Cat sits down first; tickSitting will send IDLE_TIMEOUT to wander after SIT_WANDER_MS.
    this.sendStateChange({ type: 'SIT_TIMEOUT' });
  }

  private tickSitting(deltaMs: number): void {
    if (this.state.behavior !== BehaviorState.Sitting) {
      this.sittingElapsedMs = 0;
      return;
    }
    if (this.pinned || this.mode === 'follow') {
      this.sittingElapsedMs = 0;
      return;
    }
    this.sittingElapsedMs += deltaMs;
    if (this.sittingElapsedMs < PetController.SIT_WANDER_MS) return;

    this.sittingElapsedMs = 0;
    this.sendStateChange({ type: 'IDLE_TIMEOUT', wanderTarget: randomWanderTarget(this.state.position) });
  }

  private onPetClick(): void {
    // Don't override RunningToFood or Eating — those are high-priority states
    // where swapping the sprite mid-motion causes visual glitches.
    const b = this.state.behavior;
    if (b !== BehaviorState.RunningToFood && b !== BehaviorState.Eating) {
      this.reactHappyRemainingMs = PetController.REACT_HAPPY_ANIM_MS;
    }
    this.renderer.playHappyReaction();
    this.sendToSW({ type: MsgType.PetClicked });
  }

  private onPetRightClick(): void {
    const isSleeping = this.state.behavior === BehaviorState.Sleeping;
    const sleepWakeItem: ActionMenuItem = isSleeping
      ? {
          id: 'wake',
          emoji: '🌅',
          label: chrome.i18n.getMessage('actionWake') || 'Wake up',
          onClick: () => this.dispatchAction('wake'),
        }
      : {
          id: 'sleep',
          emoji: '😴',
          label: chrome.i18n.getMessage('actionSleep') || 'Sleep',
          onClick: () => this.dispatchAction('sleep'),
        };
    const pinItem: ActionMenuItem = this.pinned
      ? {
          id: 'unpin',
          emoji: '📌',
          label: 'Unpin',
          onClick: () => this.dispatchAction('pin'),
        }
      : {
          id: 'pin',
          emoji: '📌',
          label: 'Pin here',
          onClick: () => this.dispatchAction('pin'),
        };
    const items: ActionMenuItem[] = [
      sleepWakeItem,
      {
        id: 'play',
        emoji: '🎉',
        label: chrome.i18n.getMessage('actionPlay') || 'Play',
        onClick: () => this.dispatchAction('play'),
      },
      pinItem,
      {
        id: 'hide',
        emoji: '🙈',
        label: chrome.i18n.getMessage('actionHide') || 'Hide here',
        onClick: () => this.dispatchAction('hide'),
        divider: true,
      },
    ];
    // Anchor menu to the cat's position, not the raw mouse coords
    this.renderer.showActionMenu(items, this.state.position.x, this.state.position.y);
  }

  /** Called by the popup Play button (via tab message) to start the play animation. */
  triggerPlay(): void {
    this.playAnimRemainingMs = PetController.PLAY_ANIM_MS;
    this.renderer.playPlayBurst();
  }

  private dispatchAction(action: string): void {
    if (action === 'play') {
      this.triggerPlay();
      this.sendToSW({ type: MsgType.PetAction, action: 'play' });
      return;
    }
    if (action === 'sleep' || action === 'wake') {
      this.sendToSW({ type: MsgType.PetAction, action });
      return;
    }
    if (action === 'pin') {
      this.pinned = !this.pinned;
      return;
    }
    if (action === 'hide') this.requestHideOnThisSite();
  }

  /**
   * Add the current hostname to the blocklist. The content script's
   * storage.onChanged listener already listens for blocklist updates and
   * recomputes `isBlocked` → applyRenderGate hides the cat live.
   */
  private requestHideOnThisSite(): void {
    const hostname = location.hostname;
    if (!hostname) return;
    if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) return;
    chrome.storage.local.get(['blocklist'] as Array<keyof StorageSchema>, (items) => {
      const storage = items as Partial<StorageSchema>;
      const list = storage.blocklist ?? [];
      if (list.includes(hostname)) return;
      chrome.storage.local
        .set({ blocklist: [...list, hostname] } satisfies Partial<StorageSchema>)
        .catch((err: unknown) => console.error('[cattab] blocklist save failed', err));
    });
  }

  /**
   * Rolls a new idle mood. Higher happiness biases toward `exciting` so the
   * mood reflects the stat — a happy cat fidgets, a content one sits.
   */
  private refreshIdleVariant(): void {
    const { happiness, hunger } = this.state.stats;
    const excitingChance = happiness > 70 ? 0.7 : happiness > 40 ? 0.4 : 0.15;
    this.idleVariant = Math.random() < excitingChance ? 'exciting' : 'calm';

    if (hunger < 30) {
      this.tryShowBubble('hungry_bubble.png');
    } else if (this.idleVariant === 'exciting' && happiness > 75) {
      this.tryShowBubble('wanna_play_bubble.png');
    }
  }

  private tryShowBubble(sprite: string): void {
    const now = performance.now();
    if (now - this.lastBubbleTs < PetController.BUBBLE_COOLDOWN_MS) return;
    this.lastBubbleTs = now;
    const { x, y } = this.state.position;
    this.renderer.showEmotionBubble(this.emotionsBaseUrl + sprite, x, y);
  }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function moveToward(pos: Vec2, target: Vec2, speed: number): Vec2 {
  const dist = distance(pos, target);
  if (dist <= speed) return { ...target };
  const ratio = speed / dist;
  return { x: pos.x + (target.x - pos.x) * ratio, y: pos.y + (target.y - pos.y) * ratio };
}

function nextIdleTriggerMs(): number {
  return 2500 + Math.random() * 3000;
}

function randomWanderTarget(pos: Vec2): Vec2 {
  const WANDER_RADIUS = 200;
  const maxX = window.innerWidth - PET_SIZE;
  const maxY = window.innerHeight - PET_SIZE;
  return {
    x: Math.max(0, Math.min(maxX, pos.x + (Math.random() - 0.5) * WANDER_RADIUS * 2)),
    y: Math.max(0, Math.min(maxY, pos.y + (Math.random() - 0.5) * WANDER_RADIUS * 2)),
  };
}

function isExtensionContextAlive(): boolean {
  return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
}
