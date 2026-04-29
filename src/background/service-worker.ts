import { DEFAULT_PET_STATE, DEFAULT_STORAGE, BehaviorState } from '@shared/types';
import type { PetState, StorageSchema } from '@shared/types';
import {
  STATS_TICK_INTERVAL_MS,
  HUNGER_DRAIN_PER_TICK,
  HAPPINESS_DRAIN_PER_TICK,
  ENERGY_DRAIN_PER_TICK,
  STORAGE_DEBOUNCE_MS,
  CONTEXT_MENU_FEED_ID,
} from '@shared/constants';
import { MsgType } from '@shared/messages';
import type { ExtensionMessage } from '@shared/messages';
import { transition } from '@shared/fsm';

// ─── In-memory state (SW is single source of truth) ──────────────────────────

let petState: PetState = { ...DEFAULT_PET_STATE };
let storageDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// Shared promise so concurrent callers all wait on the same single read.
// Null = not started. Resolved promise = already loaded (instant return).
let stateLoadPromise: Promise<void> | null = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  void handleInstalled();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStateLoaded();
});

// ─── Stats tick alarm — created once on install, never recreated ──────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'statsTick') {
    void ensureStateLoaded().then(() => tickStats());
  }
});

// ─── Message handling ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((rawMsg: unknown, sender) => {
  // Fire-and-forget: handler is async but we return false synchronously so
  // Chrome doesn't wait for a response. All state mutations happen after
  // ensureStateLoaded() resolves, so the first message after SW wake never
  // processes with stale/default state.
  void handleMessage(rawMsg as ExtensionMessage, sender);
  return false;
});

async function handleMessage(
  msg: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  await ensureStateLoaded();

  switch (msg.type) {
    case MsgType.TabBecameActive: {
      const tabId = sender.tab?.id ?? null;
      petState = { ...petState, activeTabId: tabId };
      broadcastState();
      break;
    }

    case MsgType.TabBecameInactive: {
      if (petState.activeTabId === (sender.tab?.id ?? null)) {
        petState = { ...petState, activeTabId: null };
      }
      break;
    }

    case MsgType.RequestStateChange: {
      if (msg.actorPosition !== undefined || msg.actorDirection !== undefined) {
        petState = {
          ...petState,
          position: msg.actorPosition ?? petState.position,
          direction: msg.actorDirection ?? petState.direction,
        };
      }

      const { nextState, changed } = transition(petState, msg.event);
      if (changed) {
        petState = nextState;
        persistStateDebouncedWrite();
        broadcastState();
      }
      break;
    }

    case MsgType.FoodSpawned: {
      const { nextState, changed } = transition(petState, {
        type: 'FOOD_APPEARED',
        foodPos: msg.position,
      });
      if (changed) {
        petState = nextState;
        persistStateDebouncedWrite();
        broadcastState();
      }
      break;
    }

    case MsgType.PetClicked: {
      petState = {
        ...petState,
        stats: {
          ...petState.stats,
          happiness: Math.min(100, petState.stats.happiness + 2),
        },
      };
      persistStateDebouncedWrite();
      broadcastState();
      break;
    }

    case MsgType.PetAction: {
      switch (msg.action) {
        case 'sleep':
          petState = { ...petState, behavior: BehaviorState.Sleeping, target: null };
          break;
        case 'wake':
          if (petState.behavior === BehaviorState.Sleeping) {
            petState = { ...petState, behavior: BehaviorState.Idle, target: null };
          }
          break;
        case 'play':
          petState = {
            ...petState,
            stats: {
              ...petState.stats,
              happiness: Math.min(100, petState.stats.happiness + 15),
            },
          };
          break;
      }
      persistStateDebouncedWrite();
      broadcastState();
      break;
    }

    default:
      break;
  }
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function setupContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_FEED_ID,
      title: chrome.i18n.getMessage('feedCatHere'),
      contexts: ['page'],
    });
  });
}

async function handleInstalled(): Promise<void> {
  await ensureStateLoaded();
  setupContextMenu();
  await ensureDefaultSettings();
  // Create alarm once on install; alarm persists across SW restarts.
  chrome.alarms.get('statsTick', (existing) => {
    if (!existing) {
      void chrome.alarms.create('statsTick', { periodInMinutes: STATS_TICK_INTERVAL_MS / 60000 });
    }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_FEED_ID || tab?.id == null) return;

  // Tell the content script to spawn food at the clicked position.
  // pageX/pageY are in info but only available for link/image contexts;
  // we use a custom approach: content script listens for the contextmenu event
  // and stores the last right-click position, which it then uses here.
  chrome.tabs.sendMessage(tab.id, {
    type: MsgType.FoodSpawned,
    // Position will be resolved by content script using stored cursor pos
    position: { x: 0, y: 0 },
    tabId: tab.id,
  }).catch(() => {});
});

// ─── Stats tick ───────────────────────────────────────────────────────────────

function tickStats(): void {
  if (petState.behavior === BehaviorState.Sleeping) return;

  petState = {
    ...petState,
    stats: {
      hunger: Math.max(0, petState.stats.hunger - HUNGER_DRAIN_PER_TICK),
      happiness: Math.max(0, petState.stats.happiness - HAPPINESS_DRAIN_PER_TICK),
      energy: Math.max(0, petState.stats.energy - ENERGY_DRAIN_PER_TICK),
    },
  };

  // Trigger sleep if energy bottoms out
  if (petState.stats.energy === 0 && petState.behavior !== BehaviorState.Sleeping) {
    petState = { ...petState, behavior: BehaviorState.Sleeping };
  }

  persistStateDebouncedWrite();
  broadcastState();
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Loads persisted state exactly once per SW instance lifetime.
 * Returns the same promise to all concurrent callers — no double-read,
 * no race where the second caller sees stateLoaded=true but storage hasn't
 * resolved yet.
 */
function ensureStateLoaded(): Promise<void> {
  if (stateLoadPromise !== null) return stateLoadPromise;
  stateLoadPromise = (async (): Promise<void> => {
    // Snapshot runtime-only fields already set before the await.
    // TabBecameActive can arrive in the same turn as this load; preserve it.
    const runtimeActiveTabId = petState.activeTabId;
    const result = await chrome.storage.local.get(['petState'] as Array<keyof StorageSchema>);
    const stored = result as Partial<StorageSchema>;
    petState = {
      ...(stored.petState ?? DEFAULT_PET_STATE),
      activeTabId: runtimeActiveTabId,
    };
  })();
  return stateLoadPromise;
}

function persistStateDebouncedWrite(): void {
  if (storageDebounceTimer !== null) clearTimeout(storageDebounceTimer);
  storageDebounceTimer = setTimeout(() => {
    storageDebounceTimer = null;
    chrome.storage.local.set({ petState } satisfies Partial<StorageSchema>).catch((err: unknown) => {
      console.error('[cattab] storage write failed', err);
    });
  }, STORAGE_DEBOUNCE_MS);
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

function broadcastState(): void {
  const msg: ExtensionMessage = { type: MsgType.StateUpdated, state: petState };
  const activeTabId = petState.activeTabId;
  if (activeTabId == null) return;
  chrome.tabs.sendMessage(activeTabId, msg).catch(() => {
    // Active tab may not host a content script (e.g. chrome:// pages) — ignore
  });
}

// ─── Default settings init ────────────────────────────────────────────────────

async function ensureDefaultSettings(): Promise<void> {
  const existing = await chrome.storage.local.get(
    Object.keys(DEFAULT_STORAGE) as Array<keyof typeof DEFAULT_STORAGE>,
  );
  const toSet: Partial<StorageSchema> = {};
  for (const key of Object.keys(DEFAULT_STORAGE) as Array<keyof typeof DEFAULT_STORAGE>) {
    if (existing[key] === undefined) {
      // @ts-expect-error dynamic key assignment
      toSet[key] = DEFAULT_STORAGE[key];
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
}
