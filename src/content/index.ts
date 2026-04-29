import { MsgType, BehaviorState, PET_SIZE } from './runtime-shared';
import type { ExtensionMessage, StorageSchema } from './runtime-shared';
import { createShadowHost, PetRenderer } from './renderer';
import { PetController } from './controller';
import { FoodSprite } from './food';

// ─── Guard: skip chrome:// pages, extension pages, etc. ──────────────────────

if (document.body && !isBlockedPage()) {
  init();
}

function isBlockedPage(): boolean {
  return (
    location.protocol === 'chrome:' ||
    location.protocol === 'chrome-extension:' ||
    location.protocol === 'about:'
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  if (!isExtensionContextAlive()) return;
  const cssUrl = chrome.runtime.getURL('styles/pet.css');
  const spriteBaseUrl = chrome.runtime.getURL('assets/cheeto/');
  const fishUrl = chrome.runtime.getURL('assets/cheeto/fish.png');

  const { host, shadow } = createShadowHost(cssUrl);
  document.body.appendChild(host);

  const renderer = new PetRenderer(shadow);
  const controller = new PetController(renderer, spriteBaseUrl);
  // Wait for SW to confirm this tab is active before rendering.
  // Prevents showing cat on background tabs before SW arbitration.
  let canRenderOnThisTab = false;
  let isBlocked = false;
  let lastContextMenuPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let activeFood: FoodSprite | null = null;

  const applyRenderGate = (): void => {
    const shouldRender = !isBlocked && canRenderOnThisTab && !document.hidden;
    host.style.display = shouldRender ? 'block' : 'none';
    if (shouldRender) {
      controller.start();
      return;
    }
    controller.stop();
  };

  // ── Listen for state broadcasts from SW ──────────────────────────────────
  chrome.runtime.onMessage.addListener((rawMsg: unknown) => {
    const msg = rawMsg as ExtensionMessage;

    if (msg.type === MsgType.StateUpdated) {
      canRenderOnThisTab = true;
      controller.applyState(msg.state);
      applyRenderGate();

      // Consume food as soon as the cat transitions into Eating
      if (msg.state.behavior === BehaviorState.Eating && activeFood !== null) {
        activeFood.consume();
        activeFood = null;
      }
      return;
    }

    if (msg.type === MsgType.PetAction && msg.action === 'play') {
      controller.triggerPlay();
      return;
    }

    if (msg.type === MsgType.FoodSpawned) {
      // Dismiss any previous uneaten food first
      activeFood?.destroy();
      activeFood = new FoodSprite(shadow, lastContextMenuPos.x, lastContextMenuPos.y, fishUrl);

      // Offset so the cat arrives with its CENTER on the food, not its top-left corner.
      const foodTarget = {
        x: lastContextMenuPos.x - PET_SIZE / 2,
        y: lastContextMenuPos.y - PET_SIZE / 2,
      };
      safeSendMessage({
        type: MsgType.FoodSpawned,
        position: foodTarget,
        tabId: msg.tabId,
      } satisfies ExtensionMessage);
    }
  });

  // ── Request initial state + settings ────────────────────────────────────
  chrome.storage.local.get(
    ['petState', 'speedMultiplier', 'blocklist', 'petMode'] as Array<keyof StorageSchema>,
    (items) => {
      const storage = items as Partial<StorageSchema>;

      isBlocked = isCurrentSiteBlocked(storage.blocklist ?? []);
      if (isBlocked) {
        applyRenderGate();
        return;
      }

      if (storage.petState) controller.applyState(storage.petState);
      if (storage.speedMultiplier != null) controller.applySpeedMultiplier(storage.speedMultiplier);
      if (storage.petMode != null) controller.applyMode(storage.petMode);

      // Fallback: if SW doesn't reply within 1s (e.g. cold start race), render anyway
      // so the cat isn't invisible forever. STATE_UPDATED will correct state when SW wakes.
      setTimeout(() => {
        if (!canRenderOnThisTab && !isBlocked) {
          canRenderOnThisTab = true;
          applyRenderGate();
        }
      }, 1000);
    },
  );

  // ── Live-react to settings changes (popup writes → all tabs see immediately) ──
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.petMode?.newValue != null) {
      controller.applyMode(changes.petMode.newValue as StorageSchema['petMode']);
    }
    if (changes.speedMultiplier?.newValue != null) {
      controller.applySpeedMultiplier(changes.speedMultiplier.newValue as number);
    }
    if (changes.blocklist?.newValue !== undefined) {
      isBlocked = isCurrentSiteBlocked(
        (changes.blocklist.newValue as string[] | undefined) ?? [],
      );
      applyRenderGate();
    }
  });

  // ── Cursor tracking ──────────────────────────────────────────────────────

  // Prevent the browser's native context menu (including extension items) from
  // appearing when the user right-clicks on the cat. The pet element calls
  // e.preventDefault() inside the shadow, but composed events re-fire at the
  // host boundary — we block it here on the host too. Only suppress when the
  // click originated inside our shadow (composedPath includes the shadow root).
  // Suppress the browser native context menu when the click is on the cat.
  // capture:true so it runs before other listeners, but we do NOT stopPropagation —
  // the event still needs to reach the pet element inside the shadow to trigger our menu.
  host.addEventListener('contextmenu', (e) => {
    const path = e.composedPath();
    if (path.some((n) => n instanceof Element && n.id === 'cattab-pet')) {
      e.preventDefault();
    }
  }, { capture: true });

  document.addEventListener('contextmenu', (e) => {
    lastContextMenuPos = { x: e.clientX, y: e.clientY };
  });

  document.addEventListener('mousemove', (e) => {
    controller.onCursorMove({ x: e.clientX, y: e.clientY }, Date.now());
  });

  document.addEventListener('mouseleave', () => {
    controller.onCursorLeft();
  });

  // ── Pause RAF when tab is hidden ─────────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      canRenderOnThisTab = false;
      applyRenderGate();
      safeSendMessage({ type: MsgType.TabBecameInactive });
    } else {
      // Re-read state from storage immediately so we don't briefly show stale
      // state while the SW wakes up and processes TabBecameActive.
      chrome.storage.local.get(
        ['petState', 'speedMultiplier', 'petMode'] as Array<keyof StorageSchema>,
        (items) => {
          const s = items as Partial<StorageSchema>;
          if (s.petState) controller.applyState(s.petState);
          if (s.speedMultiplier != null) controller.applySpeedMultiplier(s.speedMultiplier);
          if (s.petMode != null) controller.applyMode(s.petMode);
          canRenderOnThisTab = true;
          applyRenderGate();
        },
      );
      safeSendMessage({ type: MsgType.TabBecameActive });
    }
  });

  // ── Notify SW this tab is active ─────────────────────────────────────────
  safeSendMessage({ type: MsgType.TabBecameActive });
}

function isCurrentSiteBlocked(blocklist: string[]): boolean {
  return blocklist.includes(location.hostname);
}

function safeSendMessage(msg: ExtensionMessage): void {
  if (!isExtensionContextAlive()) return;
  try {
    void chrome.runtime.sendMessage(msg).catch(() => {});
  } catch {
    // Extension context can be invalidated during extension reload.
  }
}

function isExtensionContextAlive(): boolean {
  return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
}
