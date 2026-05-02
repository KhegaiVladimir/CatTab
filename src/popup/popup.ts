import type { PetMode, StorageSchema } from '@shared/types';
import { BehaviorState, Direction } from '@shared/types';
import { MsgType } from '@shared/messages';

// ─── Pet portrait (live animated sprite) ──────────────────────────────────────

interface PortraitAnim {
  sprite: string;
  frameCount: number;
  frameDurationMs: number;
}

const SPRITE_BASE = chrome.runtime.getURL('assets/cheeto/');

const WALK_BY_DIR: Record<Direction, { sprite: string; frameCount: number }> = {
  [Direction.North]:     { sprite: 'walk_north.png',      frameCount: 6  },
  [Direction.NorthEast]: { sprite: 'walk_north_east.png', frameCount: 6  },
  [Direction.East]:      { sprite: 'walk_east.png',       frameCount: 10 },
  [Direction.SouthEast]: { sprite: 'walk_south_east.png', frameCount: 6  },
  [Direction.South]:     { sprite: 'walk_south.png',      frameCount: 6  },
  [Direction.SouthWest]: { sprite: 'walk_south_west.png', frameCount: 6  },
  [Direction.West]:      { sprite: 'walk_west.png',       frameCount: 10 },
  [Direction.NorthWest]: { sprite: 'walk_north_west.png', frameCount: 6  },
};

function portraitAnim(behavior: BehaviorState, direction: Direction): PortraitAnim {
  switch (behavior) {
    case BehaviorState.Eating:
      return { sprite: 'eat_south.png',  frameCount: 6,  frameDurationMs: 120 };
    case BehaviorState.Sleeping:
      return { sprite: 'sleep_loop.png', frameCount: 16, frameDurationMs: 220 };
    case BehaviorState.Walking:
    case BehaviorState.RunningToFood:
    case BehaviorState.FollowingCursor: {
      const w = WALK_BY_DIR[direction];
      return { sprite: w.sprite, frameCount: w.frameCount, frameDurationMs: 100 };
    }
    default:
      return { sprite: 'idle_calm.png', frameCount: 6, frameDurationMs: 150 };
  }
}

const STATUS_LABELS: Record<string, string> = {
  IDLE: 'Idle', WALKING: 'Wandering', FOLLOWING_CURSOR: 'Following you',
  RUNNING_TO_FOOD: 'Hungry!', EATING: 'Eating', SLEEPING: 'Sleeping',
};

class PopupPortrait {
  private el: HTMLElement;
  private statusEl: HTMLElement | null;
  private currentSprite = '';
  private frameCount = 6;
  private frameDurationMs = 150;
  private currentFrame = 0;
  private frameTimer = 0;
  private lastTs = 0;
  private rafId = 0;
  private frameSize = 92;
  private displaySize = 80;

  constructor(el: HTMLElement, statusEl: HTMLElement | null) {
    this.el = el;
    this.statusEl = statusEl;
  }

  applyState(behavior: BehaviorState, direction: Direction): void {
    const anim = portraitAnim(behavior, direction);
    if (this.statusEl) {
      this.statusEl.textContent = STATUS_LABELS[behavior] ?? 'Idle';
    }
    if (anim.sprite === this.currentSprite) return;

    this.currentSprite = anim.sprite;
    this.frameCount = anim.frameCount;
    this.frameDurationMs = anim.frameDurationMs;
    this.currentFrame = 0;
    this.frameTimer = 0;

    const url = `${SPRITE_BASE}${anim.sprite}`;
    const scale = this.displaySize / this.frameSize;
    const totalWidth = this.frameCount * this.frameSize * scale;

    // Preload the image before applying it so the portrait never shows a blank
    // frame between sprite swaps. The swap is atomic from the user's POV.
    const img = new Image();
    img.onload = (): void => {
      // Guard: another applyState may have changed currentSprite while loading
      if (this.currentSprite !== anim.sprite) return;
      this.el.style.backgroundImage = `url(${url})`;
      this.el.style.backgroundSize = `${totalWidth}px ${this.displaySize}px`;
      this.applyFrame();
    };
    img.src = url;
  }

  private applyFrame(): void {
    const scale = this.displaySize / this.frameSize;
    const offsetX = -(this.currentFrame * this.frameSize * scale);
    this.el.style.backgroundPosition = `${offsetX}px 0px`;
  }

  start(): void {
    this.lastTs = performance.now();
    const tick = (ts: number): void => {
      const dt = ts - this.lastTs;
      this.lastTs = ts;
      this.frameTimer += dt;
      if (this.frameTimer >= this.frameDurationMs) {
        this.frameTimer -= this.frameDurationMs;
        this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        this.applyFrame();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }
}

const portraitEl = document.getElementById('pet-portrait');
const statusEl = document.getElementById('portrait-status');

let portrait: PopupPortrait | null = null;
if (portraitEl) {
  portrait = new PopupPortrait(portraitEl, statusEl);
  // Show walk_south immediately so the stage isn't blank while storage loads.
  portrait.applyState(BehaviorState.Walking, Direction.South);
  portrait.start();
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-i18n]').forEach((el) => {
  const key = el.getAttribute('data-i18n');
  if (!key) return;
  const msg = chrome.i18n.getMessage(key);
  if (msg) el.textContent = msg;
});

// ─── Stat bars (live-updating) ────────────────────────────────────────────────

function setBar(id: string, valId: string, value: number): void {
  const bar = document.getElementById(id);
  const val = document.getElementById(valId);
  if (bar) bar.style.width = `${Math.round(value)}%`;
  if (val) val.textContent = `${Math.round(value)}%`;
}

function paintStats(stats: { hunger: number; happiness: number; energy: number }): void {
  setBar('bar-hunger',    'val-hunger',    stats.hunger);
  setBar('bar-happiness', 'val-happiness', stats.happiness);
  setBar('bar-energy',    'val-energy',    stats.energy);
}

chrome.storage.local.get(['petState'] as Array<keyof StorageSchema>, (items) => {
  const storage = items as Partial<StorageSchema>;
  if (storage.petState?.stats) paintStats(storage.petState.stats);
  if (storage.petState && portrait) {
    portrait.applyState(storage.petState.behavior, storage.petState.direction);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const next = changes.petState?.newValue as StorageSchema['petState'] | undefined;
  if (next?.stats) paintStats(next.stats);
  if (next && portrait) {
    portrait.applyState(next.behavior, next.direction);
  }
});

// ─── Mode segmented control ───────────────────────────────────────────────────

const modeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('.segmented__btn[data-mode]'),
);

function paintMode(active: PetMode): void {
  for (const btn of modeButtons) {
    const isActive = btn.dataset.mode === active;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
}

chrome.storage.local.get(['petMode'] as Array<keyof StorageSchema>, (items) => {
  const storage = items as Partial<StorageSchema>;
  paintMode(storage.petMode ?? 'auto');
});

for (const btn of modeButtons) {
  btn.addEventListener('click', () => {
    const next = btn.dataset.mode as PetMode | undefined;
    if (!next) return;
    paintMode(next);
    chrome.storage.local.set({ petMode: next } satisfies Partial<StorageSchema>).catch((err: unknown) => {
      console.error('[cattab] petMode save failed', err);
    });
  });
}

// ─── Feed / Play buttons ──────────────────────────────────────────────────────

const btnFeed = document.getElementById('btn-feed') as HTMLButtonElement | null;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement | null;

if (btnFeed) {
  btnFeed.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId == null) return;
      // Trigger food spawn in content script using the same flow as the context menu.
      // Content script uses lastContextMenuPos (defaults to viewport center).
      chrome.tabs.sendMessage(tabId, {
        type: MsgType.FoodSpawned,
        position: { x: 0, y: 0 },
      }).catch(() => { /* tab may not have content script loaded */ });
    });
  });
}

if (btnPlay) {
  btnPlay.addEventListener('click', () => {
    // Tell SW to bump happiness (state change)
    chrome.runtime.sendMessage({ type: MsgType.PetAction, action: 'play' })
      .catch(() => {});
    // Tell the active tab's content script to start the play animation locally
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId == null) return;
      chrome.tabs.sendMessage(tabId, { type: MsgType.PetAction, action: 'play' })
        .catch(() => {});
    });
  });
}

// ─── Hide toggle ──────────────────────────────────────────────────────────────

const hideToggle = document.getElementById('hide-toggle') as HTMLInputElement;
const hostnameEl = document.getElementById('current-hostname');

// Determine current hostname from the active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url;
  if (!url) return;
  const hostname = new URL(url).hostname;
  if (hostnameEl) hostnameEl.textContent = hostname;

  chrome.storage.local.get(['blocklist'] as Array<keyof StorageSchema>, (items) => {
    const storage = items as Partial<StorageSchema>;
    const blocklist = storage.blocklist ?? [];
    hideToggle.checked = blocklist.includes(hostname);
  });

  hideToggle.addEventListener('change', () => {
    chrome.storage.local.get(['blocklist'] as Array<keyof StorageSchema>, (items) => {
      const storage = items as Partial<StorageSchema>;
      let blocklist = storage.blocklist ?? [];

      if (hideToggle.checked) {
        if (!blocklist.includes(hostname)) blocklist = [...blocklist, hostname];
      } else {
        blocklist = blocklist.filter((h) => h !== hostname);
      }

      chrome.storage.local.set({ blocklist } satisfies Partial<StorageSchema>).catch((err: unknown) => {
        console.error('[cattab] blocklist save failed', err);
      });
    });
  });
});

// ─── Compat warning banner ────────────────────────────────────────────────────

const compatWarn = document.getElementById('compat-warn');
const compatClose = document.getElementById('compat-warn-close') as HTMLButtonElement | null;

chrome.storage.local.get(['compatWarningDismissed'] as Array<keyof StorageSchema>, (items) => {
  const storage = items as Partial<StorageSchema>;
  if (!storage.compatWarningDismissed && compatWarn) {
    compatWarn.hidden = false;
  }
});

compatClose?.addEventListener('click', () => {
  if (compatWarn) compatWarn.hidden = true;
  chrome.storage.local
    .set({ compatWarningDismissed: true } satisfies Partial<StorageSchema>)
    .catch(() => {});
});
