# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cattab** is a Chrome MV3 extension — a pixel art cat pet that lives on any webpage, walks around, follows the cursor, and eats food the user throws. Target: Chrome Web Store, 1000+ WAU by August 2026. Production quality.

Tech stack: TypeScript strict mode, Vite bundler, vanilla TS + DOM API (no React), Shadow DOM for content script isolation.

## Commands

```bash
npm install          # install deps (includes sharp for icon/sprite generation)
npm run build        # full production build (runs icon + sprite generators first via prebuild)
npm run dev          # watch mode build (runs generators first via predev)
npm run typecheck    # tsc --noEmit, must stay zero errors
npm run lint         # eslint src  (flat config — no --ext flag)
npm run format       # prettier
npm run sprites:build  # regenerate sprite sheets manually
npm run icons:build    # regenerate extension icons manually
```

To load the extension: `chrome://extensions` → Developer Mode → **Load unpacked** → select `dist/`.

After any code change: `npm run build` then reload the extension in Chrome.

## Current Status (as of 2026-04-27)

Phase 1 MVP is in progress. What works: Shadow DOM rendering, RAF loop, FSM (all states), cursor follow, idle wander, feeding system (context menu → food spawn → cat runs and eats), click reaction (heart particle), single-tab rendering gate, blocklist, **live-updating** popup stats, options page, **8-direction top-down character (`cheeto`) with two idle moods (`calm` / `exciting`) selected per-session by happiness stat**, **user-selectable behavior modes (`auto` / `follow` / `wander`) with a popup segmented control**, **right-click action menu on the pet (Sleep ↔ Wake, Play, Hide here)**. See `ROADMAP_STATUS.md` for the full checklist and `were_fixed.md` for the fix log.

**Next priorities:** dedicated sleep pose artwork, food sprite artwork (folder exists but empty — emoji `🐟` placeholder still in use), visual hunger cue on the cat itself (thought bubble), manual compatibility testing on YouTube/Gmail/GitHub/Reddit.

## Architecture

### Two separate import worlds — critical

Content scripts cannot use Vite path aliases at runtime (they run injected into host pages). All shared code needed by content scripts lives in **`src/content/runtime-shared.ts`** — a self-contained file with types, enums, constants, and message shapes. The `src/shared/` modules are imported only by background/popup/options.

- `src/shared/` → background, popup, options
- `src/content/runtime-shared.ts` → content script bundle only

If you add a new shared type/constant needed by content scripts, add it to `runtime-shared.ts` AND keep `src/shared/types.ts` / `constants.ts` in sync (they're the authoritative source; runtime-shared is the content-side copy).

### Content script loading — why `content-loader.js` was removed

Chrome content scripts cannot be ES modules. The bundle was originally split into a shared chunk requiring `import`, which broke execution. The fix was `runtime-shared.ts` — making `dist/content/index.js` fully self-contained with zero top-level imports. It now loads as a classic script directly in manifest. Do not re-introduce cross-entry imports from content scripts into `@shared/*`.

### Service Worker (`src/background/service-worker.ts`)

Single source of truth. Key details:
- `broadcastState()` sends only to `petState.activeTabId`, not all tabs (single-tab rule)
- Context menu: SW creates the item but sends `FOOD_SPAWNED` with `{x:0,y:0}` as a trigger; the content script resolves real coordinates from `lastContextMenuPos` (captured on `contextmenu` event) and sends a second typed `FOOD_SPAWNED` message back with actual position
- Uses `chrome.alarms` for stat ticks — `alarms` permission must be in manifest
- `contextMenus.removeAll()` before `create()` on install to prevent duplicate entries
- All storage writes debounced 500ms

### Content Script (`src/content/`)

Entry: `src/content/index.ts`.

**Render gate** (`applyRenderGate`): rendering enabled when `!isBlocked && canRenderOnThisTab && !document.hidden`. `canRenderOnThisTab` flips to `true` when `STATE_UPDATED` arrives (proving the SW considers this tab active). This replaced a brittle `GetTabContext` roundtrip that caused invisible-cat bugs on cold SW wake.

**`PetController`** (`controller.ts`): RAF loop owner. Each tick:
1. Moves position toward target at `BASE_SPEED_PX × speedMultiplier` px/frame
2. On arrival sends `REACHED_FOOD` or `ARRIVED` to SW
3. Attaches `actorPosition` + `actorDirection` on every `REQUEST_STATE_CHANGE` — SW applies this snapshot before FSM transition, preventing teleport-back bugs from stale SW position
4. Idle wander: fires `IDLE_TIMEOUT` after randomized 2.5–5.5s in IDLE state
5. Picks an `idleVariant` (`calm` | `exciting`) on every transition INTO Idle. Bias toward `exciting` scales with happiness (>70 → 70% exciting; >40 → 40%; else 15%). Variant is held for the whole idle session, never re-rolled mid-session, so the mood reads as a deliberate beat — not a flicker.

**`PetRenderer`** (`renderer.ts`): pure DOM. Movement via `translate3d` only. Sprite sheet via `background-position`. **No flipping** — every direction is a unique top-down pose, so do not reintroduce `scaleX(-1)`. `playHappyReaction()` spawns a `❤` div inside shadow root (non-blocking, does not touch transform).

**`resolveAnimation`** (`animations.ts`): switches by behavior. Walking/Running/FollowingCursor pick from the 8-direction `WALK_BY_DIRECTION` table. Idle picks `idle_calm` or `idle_exciting` from the variant arg. Eating uses `eat_south.png` (the cat orients south on REACHED_FOOD before eating starts). Sleeping reuses `idle_calm` until a dedicated sleep pose lands. Default branch returns `base.png` — never crashes on missing data.

### FSM (`src/shared/fsm.ts`)

Pure function: `transition(state, event) → { nextState, changed }`. Side effects happen in SW only. Key transitions:
- Any + `FOOD_APPEARED` → `RunningToFood`
- `Idle/Walking/FollowingCursor` + `CURSOR_MOVED` → `FollowingCursor` (`changed: false` if already following — avoids broadcast spam)
- `RunningToFood` + `REACHED_FOOD` → `Eating`
- `Eating` + `EATING_DONE` → `Idle` (+30 hunger, +10 happiness)
- `Idle` + `IDLE_TIMEOUT` → `Walking` (random target within 200px)
- Energy hits 0 → forced `Sleeping`

`directionTo(from, to)` returns one of **8** values (N/S/E/W + NE/NW/SE/SW) using `atan2(dy, dx)` mapped to octants. Screen-space y grows downward, so positive dy → south. The same enum lives in `runtime-shared.ts` and `src/shared/types.ts` — keep them mirrored.

### Asset Pipeline

`scripts/generate-icons.mjs` — generates `public/assets/icons/{16,32,48,128}.png` from SVG using `sharp`. Required by manifest; missing icons cause Chrome to reject the extension load entirely.

`scripts/generate-cat-sprites.mjs` — **folder-driven**, sources from `public/assets/cheeto/animations/<animation>/<direction>/frame_*.png`. Each `TARGETS` entry maps an output sheet to one source folder; missing folders produce a labelled placeholder so the build never breaks. Writes `generated-report.json`. Runs via `prebuild`/`predev`.

The active character is **`cheeto`** — 8-direction top-down view, two idle poses (`calm_idle`, `exciting_idle`), eat (south only), and walk for every direction. The legacy `public/assets/cat/` folder (4-direction side view) remains on disk for reference but is **not loaded by the runtime** (see `manifest.json` `web_accessible_resources` and `content/index.ts:spriteBaseUrl`). To swap characters, update `CHARACTER_DIR` in the sprite generator, the manifest WAR entry, and the spriteBaseUrl together.

Sprite sheets: horizontal strip, all frames in one file. `walk_east.png` = 6 frames × 92×92px = 552×92px. Generated names the runtime expects (see `animations.ts`):
- `walk_{north,south,east,west,north_east,north_west,south_east,south_west}.png` (6 frames each)
- `idle_calm.png`, `idle_exciting.png` (6 frames each)
- `eat_south.png` (6 frames)
- `base.png` (1 frame, static fallback)

The artist can drop fresh frames into the matching `cheeto/animations/<folder>/<direction>/` folder and re-run `npm run sprites:build` — no metadata.json edit required. The script ignores metadata.json entirely; the on-disk folder layout is the source of truth.

### Right-click action menu

Right-click on the pet sprite (not the page) opens a small action menu rendered inside the same shadow root. The page's native context menu is suppressed only on the pet element via `e.preventDefault()` in `renderer.onRightClick` — right-clicking elsewhere still opens the browser menu (where "Feed cat here" lives).

Items are built in `controller.onPetRightClick` based on current state:
- **Sleep / Wake up** — toggles based on `state.behavior === Sleeping`. Dispatches `MsgType.PetAction { action: 'sleep' | 'wake' }`. SW applies the transition directly (bypassing FSM — these are user commands, not autonomous transitions).
- **Play** — fires `renderer.playPlayBurst()` (5 staggered hearts) locally for instant feedback, then dispatches `PetAction { action: 'play' }` so SW bumps happiness +15.
- **Hide here** — handled entirely in the content script: writes `location.hostname` into `blocklist`. The existing `storage.onChanged` listener picks it up and the render gate hides the cat live, no SW round-trip.

Menu lifecycle (in `renderer.ts`): outside-click closes via capture-phase `mousedown` + `composedPath()` (crosses shadow boundary correctly); ESC also closes; `destroy()` tears down. While the menu is open, `controller.onCursorMove` returns early so the cat doesn't drift out from under the menu.

### Pet behavior modes (`petMode` in storage)

User-selectable mode persisted in `chrome.storage.local` as `petMode: 'auto' | 'follow' | 'wander'` (default `auto`). Controlled from the popup segmented control. **Gating lives in the controller (`controller.ts`), not the FSM or SW** — the FSM stays pure, mode-agnostic, and unit-testable.

- `auto` — current default. CURSOR_MOVED is sent only when cursor is within `CURSOR_FOLLOW_RADIUS_PX` of the cat's centre. IDLE_TIMEOUT fires normally.
- `follow` — proximity gate is dropped, so the cat will chase from anywhere on the page. IDLE_TIMEOUT is suppressed: the cat sits idle whenever the cursor isn't moving instead of wandering off.
- `wander` — CURSOR_MOVED and CURSOR_LEFT_VIEWPORT are never sent. The cat wanders as if the cursor doesn't exist.

The content script subscribes to `chrome.storage.onChanged` so popup changes apply live across all tabs without a reload. Feeding (`FOOD_APPEARED`, context menu) is mode-agnostic — feeding always works.

### Popup & Options

Warm palette: `#FFF8F0` light bg / `#2A2520` dark bg / `#F4A261` accent / `#FDDDB8` accent-dim. `border-radius: 16px` throughout. All user-visible strings via `chrome.i18n.getMessage()`, keys in `public/_locales/en/messages.json`. The mode segmented control uses `aria-pressed` for the active state — keep that attribute, screen readers depend on it.

## Service Worker lifecycle — critical MV3 pattern

MV3 SWs are killed after ~30s of inactivity. `onInstalled` fires only on install/update; `onStartup` fires only on browser start. Neither fires on SW wake. Pattern used here:

- `ensureStateLoaded()` is called at the top of every message handler and every alarm handler before any business logic. It loads from storage once per SW instance lifetime (guarded by `stateLoaded` flag).
- The stats alarm is created once inside `handleInstalled` with a `chrome.alarms.get` guard. Never call `chrome.alarms.create` at module top-level — it resets the timer on every SW wake.

## Hard-won constraints

- **No `@shared` alias in content scripts** — use `runtime-shared.ts`; violating this re-introduces the ESM import crash
- **Context guard everywhere in content scripts**: always check `isExtensionContextAlive()` (`chrome.runtime?.id !== undefined`) before any `chrome.runtime.*` call — context is invalidated on extension reload without page reload
- **`alarms` permission in manifest** — required for `chrome.alarms.create`; missing it causes SW registration failure (status code 15)
- **Storage**: never store sprite data; only `PetState` + settings; all writes debounced 500ms
- **XSS**: never use `innerHTML` with user-supplied data — options blocklist uses DOM node creation only
- **`tabs` permission required** — popup uses `chrome.tabs.query` to get `tab.url`; without `tabs` permission the URL is always `undefined`
- **Wander targets must be viewport-clamped** — `fsm.ts` is pure and has no viewport access; wander target generation lives in `controller.ts` using `window.innerWidth/Height - PET_SIZE`
- **`IDLE_TIMEOUT` carries `wanderTarget: Vec2`** — FSM does not generate random targets itself; controller passes the pre-computed clamped target
- **`mousemove` throttled at 50ms** — raw mousemove → SW message would be 60/sec; throttle lives in `onCursorMove(cursor, now)` using `Date.now()`
- **`frameTimer -= frameDurationMs`**, not `= 0` — preserves overshoot to prevent animation drift at low framerates
- **Eating exits via `tickEating()`** in controller — `EATING_DONE` fired after `EATING_DURATION_MS` (2400ms); `EATING_DONE` must exist in both `runtime-shared.ts` and `src/shared/messages.ts`
- **No sprite flipping** — top-down poses are unique per direction. The renderer must not apply `scaleX(-1)`; the FSM must classify direction as one of 8 octants. Reintroducing flipX would render east/west poses upside-down or reversed.
- **`Direction` enum has 8 values** in both `runtime-shared.ts` and `src/shared/types.ts` (N/NE/E/SE/S/SW/W/NW). Adding a value requires updates to: both enum files, `WALK_BY_DIRECTION` in `animations.ts`, the sprite generator `TARGETS`, and the `directionTo` octant switch in `fsm.ts`. All four must agree.
- **Idle variant is controller-local state** — it's not part of `PetState`, never persists, and never travels through SW messages. Picked on entry to Idle; if you add a new path into Idle, make sure `applyState` sees the transition (it compares previous behavior to new).
- **Active character folder is `cheeto/`** — the runtime path is set in three places (manifest WAR, content/index.ts spriteBaseUrl, scripts/generate-cat-sprites.mjs CHARACTER_DIR). Changing the character requires updating all three together.
- **Direction has hysteresis** — `directionTo(from, to, previous)` keeps the previous direction unless the new angle is past the octant boundary by an extra `DIRECTION_HYSTERESIS_RAD` (~11°), and ignores movements under `MIN_DIRECTION_DISTANCE_PX` (12px). Without this, slow cursor movement at an octant boundary flips the sprite every throttle tick. Always pass `s.direction` as the third arg in `transition()`.
- **Renderer preserves frame across direction-only swaps** — when only the sprite URL changes but `frameCount` and `frameDurationMs` match, the gait phase carries through. Resetting `currentFrame = 0` on every direction change makes the cat appear to teleport-restart every time it turns. Only reset on KIND change (walk → idle, idle → eat).
- **Cursor target is offset by `PET_SIZE/2`** — `position` is the sprite's top-left corner; the cursor must align with the cat's CENTER. The offset lives in `controller.ts:onCursorMove`, not in the FSM. The cursor-radius distance check is also measured from the cat's center, not its top-left.
- **Behavior mode is enforced in controller, not FSM** — `petMode` gates whether `CURSOR_MOVED` and `IDLE_TIMEOUT` are sent at all. The FSM never sees mode and stays pure. Adding mode-aware logic in the FSM or SW is the wrong fix. New modes plug in by adding a branch in `onCursorMove` and/or `tickIdleWander`.
- **`StorageSchema` keys must be defaulted in `DEFAULT_STORAGE`** — the SW's `ensureDefaultSettings` writes any missing keys on install. Adding a key to the type without adding a default leaves storage `undefined` for first-time users and may break consumers that don't tolerate `undefined`.
- **`PetAction` bypasses the FSM intentionally** — `sleep` / `wake` / `play` are user commands, not autonomous transitions. The FSM models what the cat decides; user actions go straight from SW → state mutation. Don't add user actions to `FsmEvent`; add them to `MsgType.PetAction` and handle them in the SW switch.
- **Action menu uses `composedPath()` for outside-click detection** — `event.target` retargets to the shadow host outside the shadow tree, so a plain `.contains()` check on the menu element will always claim the click is "outside". Use `composedPath().includes(menu)` instead. Capture-phase mousedown ensures the menu closes before underlying page elements (links, buttons) can register the click.
