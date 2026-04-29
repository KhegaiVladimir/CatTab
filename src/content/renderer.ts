import type { AnimationConfig } from './animations';
import { PET_SIZE } from './runtime-shared';

/** One row in the right-click pet menu. */
export interface ActionMenuItem {
  id: string;
  label: string;
  emoji?: string;
  onClick: () => void;
  /** If true, a thin divider line is rendered above this item. */
  divider?: boolean;
}

/**
 * Pure DOM layer. Owns the pet `<div>` inside the Shadow DOM.
 * Knows nothing about game logic — only how to draw.
 */
export class PetRenderer {
  private readonly el: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private currentSprite = '';
  private currentFrame = 0;
  private frameTimer = 0;
  private lastTimestamp = 0;
  private lastX = 0;
  private lastY = 0;
  // Track the active animation's identity so we can tell direction-only swaps
  // (same gait, different sheet) from kind changes (walk → idle, idle → eat).
  private currentFrameCount = 0;
  private currentFrameDurationMs = 0;
  // Action menu (right-click on pet).
  private actionMenu: HTMLDivElement | null = null;
  private menuOutsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private menuKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
    this.el = document.createElement('div');
    this.el.id = 'cattab-pet';
    shadowRoot.appendChild(this.el);
  }

  /**
   * Move the pet to an absolute viewport position.
   * Uses translate3d for GPU-composited movement.
   */
  moveTo(x: number, y: number): void {
    this.lastX = x;
    this.lastY = y;
    this.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  /**
   * Advance animation by delta ms and update the sprite sheet offset.
   * Call once per RAF tick.
   */
  tick(timestamp: number, config: AnimationConfig, spriteBaseUrl: string): void {
    const delta = this.lastTimestamp === 0 ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Swap sprite sheet if behavior/direction changed
    const spriteUrl = `${spriteBaseUrl}${config.sprite}`;
    if (spriteUrl !== this.currentSprite) {
      // Direction-only swaps (e.g. walk_east → walk_south_east) share frame
      // count and timing — preserve the frame index so the gait keeps phase
      // through turns instead of restarting at frame 0 every time the cat
      // changes octant. Reset only when the animation KIND changes
      // (walk → idle, idle → eat), since those have different frame counts
      // or pacing and starting mid-cycle would look wrong.
      const sameKind =
        this.currentFrameCount === config.frameCount &&
        this.currentFrameDurationMs === config.frameDurationMs;
      this.currentSprite = spriteUrl;
      this.currentFrameCount = config.frameCount;
      this.currentFrameDurationMs = config.frameDurationMs;
      if (!sameKind) {
        this.currentFrame = 0;
        this.frameTimer = 0;
        // Brief opacity flash so abrupt sprite swaps feel like a transition
        this.el.style.opacity = '0';
        requestAnimationFrame(() => { this.el.style.opacity = '1'; });
      } else if (this.currentFrame >= config.frameCount) {
        this.currentFrame = 0;
      }
      this.el.style.backgroundImage = `url("${spriteUrl}")`;
      this.el.style.backgroundSize = `${config.frameSize * config.frameCount}px ${config.frameSize}px`;
    }

    // Advance frame — subtract rather than reset to preserve overshoot timing
    this.frameTimer += delta;
    if (this.frameTimer >= config.frameDurationMs) {
      this.frameTimer -= config.frameDurationMs;
      if (config.loop) {
        this.currentFrame = (this.currentFrame + 1) % config.frameCount;
      } else {
        this.currentFrame = Math.min(this.currentFrame + 1, config.frameCount - 1);
      }
    }

    this.el.style.backgroundPosition = `-${this.currentFrame * config.frameSize}px 0px`;
  }

  /** Tear down — remove element + any open menu from DOM */
  destroy(): void {
    this.hideActionMenu();
    this.el.remove();
  }

  onClick(handler: () => void): void {
    this.el.addEventListener('click', handler);
  }

  /**
   * Wire a contextmenu handler on the pet sprite. The default page menu is
   * suppressed only for the pet — right-clicks elsewhere on the page still
   * open the browser's context menu (where "Feed cat here" lives).
   */
  onRightClick(handler: () => void): void {
    this.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    });
  }

  playHappyReaction(): void {
    this.spawnHeart();
  }

  /**
   * Multi-heart burst — fired by the right-click "Play" action so it reads
   * as a deliberate, more rewarding interaction than a plain click.
   */
  playPlayBurst(): void {
    for (let i = 0; i < 5; i += 1) {
      const jitterX = (Math.random() - 0.5) * 44;
      const jitterY = (Math.random() - 0.5) * 14;
      setTimeout(() => this.spawnHeart(jitterX, jitterY), i * 90);
    }
  }

  /**
   * Show an emotion bubble sprite above the cat for ~2.8 s then remove it.
   * Pass the full resolved URL to the png (e.g. emotions_etc/sleepy_bubble.png).
   */
  showEmotionBubble(imgUrl: string, catX: number, catY: number): void {
    const existing = this.shadowRoot.querySelector('.cattab-bubble');
    if (existing !== null) existing.remove();

    const BUBBLE_SIZE = 44;
    const GAP = 4;
    const bubble = document.createElement('div');
    bubble.className = 'cattab-bubble';
    bubble.style.backgroundImage = `url("${imgUrl}")`;
    bubble.style.left = `${catX + PET_SIZE / 2 - BUBBLE_SIZE / 2}px`;
    bubble.style.top = `${catY - BUBBLE_SIZE - GAP}px`;
    this.shadowRoot.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2850);
  }

  private heartImgUrl = '';

  /** Must be called once after construction so hearts use the sprite. */
  setHeartUrl(url: string): void {
    this.heartImgUrl = url;
  }

  private spawnHeart(jitterX = 0, jitterY = 0): void {
    const heart = document.createElement('div');
    heart.className = 'cattab-heart';
    if (this.heartImgUrl) {
      heart.style.backgroundImage = `url("${this.heartImgUrl}")`;
    } else {
      heart.textContent = '❤';
    }
    heart.style.left = `${this.lastX + PET_SIZE / 2 - 12 + jitterX}px`;
    heart.style.top = `${this.lastY - 12 + jitterY}px`;
    this.shadowRoot.appendChild(heart);
    setTimeout(() => heart.remove(), 850);
  }

  // ─── Action menu ───────────────────────────────────────────────────────────

  isActionMenuOpen(): boolean {
    return this.actionMenu !== null;
  }

  showActionMenu(items: ActionMenuItem[], anchorX: number, anchorY: number): void {
    this.hideActionMenu();

    const menu = document.createElement('div');
    menu.className = 'cattab-menu';
    menu.setAttribute('role', 'menu');

    const grid = document.createElement('div');
    grid.className = 'cattab-menu__grid';

    for (const item of items) {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'cattab-menu__divider';
        grid.appendChild(div);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cattab-menu__item';
      btn.setAttribute('role', 'menuitem');
      btn.dataset.actionId = item.id;

      const iconWrap = document.createElement('span');
      iconWrap.className = 'cattab-menu__icon';
      iconWrap.textContent = item.emoji ?? '';
      btn.appendChild(iconWrap);

      const label = document.createElement('span');
      label.className = 'cattab-menu__label';
      label.textContent = item.label;
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        item.onClick();
        this.hideActionMenu();
      });
      grid.appendChild(btn);
    }

    menu.appendChild(grid);

    this.shadowRoot.appendChild(menu);
    this.actionMenu = menu;
    this.positionMenu(menu, anchorX, anchorY);

    // Outside-click closes the menu. composedPath() crosses shadow boundaries
    // so we can detect clicks inside the shadow-DOM menu vs outside.
    // Capture-phase mousedown so the menu closes before the underlying click
    // can register (e.g. links won't trigger when the user dismisses by clicking on them).
    this.menuOutsideClickHandler = (e: MouseEvent): void => {
      const path = e.composedPath();
      if (!path.includes(menu)) this.hideActionMenu();
    };
    document.addEventListener('mousedown', this.menuOutsideClickHandler, { capture: true });

    this.menuKeydownHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') this.hideActionMenu();
    };
    document.addEventListener('keydown', this.menuKeydownHandler);
  }

  hideActionMenu(): void {
    if (this.actionMenu !== null) {
      this.actionMenu.remove();
      this.actionMenu = null;
    }
    if (this.menuOutsideClickHandler !== null) {
      document.removeEventListener('mousedown', this.menuOutsideClickHandler, { capture: true });
      this.menuOutsideClickHandler = null;
    }
    if (this.menuKeydownHandler !== null) {
      document.removeEventListener('keydown', this.menuKeydownHandler);
      this.menuKeydownHandler = null;
    }
  }

  /**
   * Place the menu as an overlay centered horizontally on the cat.
   * Prefers above the cat; flips below when near the top edge.
   */
  private positionMenu(menu: HTMLDivElement, catX: number, catY: number): void {
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    const rect = menu.getBoundingClientRect();
    const w = rect.width || 176;
    const h = rect.height || 152;
    const pad = 10;
    const gap = 8;
    const catCenterX = catX + PET_SIZE / 2;

    // Center horizontally on the cat
    let finalX = catCenterX - w / 2;
    finalX = Math.max(pad, Math.min(window.innerWidth - w - pad, finalX));

    // Prefer above, flip below if not enough room
    let finalY = catY - h - gap;
    if (finalY < pad) finalY = catY + PET_SIZE + gap;
    finalY = Math.max(pad, Math.min(window.innerHeight - h - pad, finalY));

    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.visibility = 'visible';
  }
}

/**
 * Builds the Shadow DOM host element and returns the shadow root.
 * Attaches a <link> for the bundled pet.css.
 */
export function createShadowHost(cssUrl: string): { host: HTMLDivElement; shadow: ShadowRoot } {
  const host = document.createElement('div');
  host.id = 'cattab-host';
  // Pointer events off on host so page interactions aren't blocked;
  // the inner pet element re-enables them for click detection.
  host.style.cssText = [
    'position:fixed',
    'inset:0',
    'pointer-events:none',
    `z-index:${2147483646}`,
    'overflow:visible',
  ].join(';');

  const shadow = host.attachShadow({ mode: 'open' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  shadow.appendChild(link);

  return { host, shadow };
}

/**
 * Clamps a position so the pet stays within the visible viewport.
 */
export function clampToViewport(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, window.innerWidth - PET_SIZE)),
    y: Math.max(0, Math.min(y, window.innerHeight - PET_SIZE)),
  };
}
