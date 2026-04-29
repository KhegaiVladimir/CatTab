# Fix Log

This file tracks what was fixed, why it was risky, and how the behavior changed.

## 1) FSM `CURSOR_MOVED` transition `changed` flag

- **File:** `src/shared/fsm.ts`
- **Problem:** `changed` was computed after forcing `behavior = FOLLOWING_CURSOR`, so it always returned `false`.
- **Risk:** Service worker skipped persistence/broadcast for valid cursor-follow transitions.
- **Fix:** Capture previous state in `wasFollowingCursor` and return `changed: !wasFollowingCursor`.
- **Edge cases checked:**
  - Idle -> FollowingCursor returns `changed: true`.
  - Walking -> FollowingCursor returns `changed: true`.
  - FollowingCursor -> FollowingCursor target updates but no extra broadcast (`changed: false`).

## 2) Context menu feed position flow

- **Files:** `src/content/index.ts`, `src/background/service-worker.ts`
- **Problem:** Service worker sent `FOOD_SPAWNED` with `{x:0, y:0}` placeholder; content script never provided the real right-click position.
- **Risk:** "Feed cat here" could spawn food in wrong coordinates.
- **Fix:**
  - Content script now stores `lastContextMenuPos` on `contextmenu`.
  - On SW trigger message (`MsgType.FoodSpawned`), content script sends a typed `FOOD_SPAWNED` message back to SW with real coordinates.
  - SW already applies FSM transition on real coordinates.
- **Edge cases checked:**
  - No prior right-click: safe fallback to viewport center.
  - Context click near viewport edges: coordinates still valid and then movement is clamped by renderer/controller.

## 3) Single-tab rendering gate

- **Files:** `src/shared/messages.ts`, `src/content/index.ts`, `src/background/service-worker.ts`
- **Problem:** `activeTabId` was stored in SW but content script did not gate rendering by active tab.
- **Risk:** Cat could render in more than one tab/session state conflict.
- **Fix:**
  - Added `MsgType.GetTabContext` message so content script can get its own sender tab id from SW.
  - Content script now enables rendering only when:
    - site is not blocklisted,
    - `state.activeTabId` equals current tab id,
    - document is visible.
  - SW `broadcastState()` now targets only `activeTabId` instead of all tabs.
- **Edge cases checked:**
  - Hidden tab: rendering paused.
  - Tab loses active status: host hidden + RAF stopped.
  - Tab regains active status: announces active and resumes once state confirms ownership.

## 4) XSS-safe blocklist rendering

- **File:** `src/options/options.ts`
- **Problem:** Blocklist rows were built with `innerHTML` using user-provided hostname.
- **Risk:** HTML/script injection in options page.
- **Fix:** Replaced `innerHTML` with explicit DOM node creation (`textContent`, `dataset`, `append`).
- **Edge cases checked:**
  - Hostnames with quotes/special chars are displayed as text, not interpreted as HTML.
  - Remove button still correctly resolves `data-host`.

## 5) Lint pipeline and eslint errors

- **Files:** `package.json`, `src/background/service-worker.ts`, `src/content/controller.ts`
- **Problem:** `npm run lint` used deprecated flat-config-incompatible `--ext` flag; code also had promise-rule and unused-import lint errors.
- **Fix:**
  - Updated script to `eslint src`.
  - Wrapped event-driven async calls with `void` launchers and extracted async helpers (`handleInstalled`, `ensureDefaultSettings`) to satisfy `no-misused-promises` / `no-floating-promises`.
  - Removed unused `Direction` import.
  - Context menu creation now uses `removeAll` then `create` to avoid duplicate menu entries on reinstall/update.
- **Edge cases checked:**
  - Extension reinstall/update does not duplicate context menu item.
  - Startup path still loads persisted state.

## 6) Asset pipeline auto-generation for required sprite sheets

- **Files:** `scripts/generate-cat-sprites.mjs`, `package.json`, `public/assets/cat/generated-report.json`
- **Problem:** runtime expected flattened sprite-sheet files (`idle_south.png`, `walk_*`, `eat_south.png`, etc.), but repository only had `metadata.json` and no guaranteed generated sheets.
- **Risk:** missing assets at runtime, broken animations, and manual setup fragility.
- **Fix:**
  - Added `scripts/generate-cat-sprites.mjs` using `sharp` to generate all required sprite sheets.
  - Script reads `metadata.json`, resolves available frame sequences, composes horizontal sheets, and fills missing sources with deterministic placeholder sheets.
  - Added scripts wiring:
    - `sprites:build`
    - `predev` -> runs sprite generation before watch build
    - `prebuild` -> runs sprite generation before production build
  - Added `public/assets/cat/generated-report.json` for visibility into source-backed vs placeholder-generated outputs.
- **Edge cases checked:**
  - Missing metadata file: script still generates placeholders to keep extension runnable.
  - Partial frame availability: script cycles existing frames to required frame count.
  - Mixed frame dimensions: frames are normalized to configured size before composing sheets.

## Verification

- `npm run typecheck` passes.
- `npm run lint` passes with updated script.
- `npm run sprites:build` passes and outputs generation report.
- `npm run build` passes (with sprite generation via `prebuild`).

## 7) Manifest icon loading failure (`Failed to load extension`)

- **Files:** `scripts/generate-icons.mjs`, `package.json`, `public/assets/icons/*`
- **Problem:** Manifest referenced `assets/icons/icon16|32|48|128.png`, but icons were missing in build output.
- **Risk:** Chrome rejects extension load with `Could not load icon ... Could not load manifest`.
- **Fix:**
  - Added `scripts/generate-icons.mjs` to generate all required icon sizes.
  - Added `icons:build` npm script.
  - Wired icon generation into both `predev` and `prebuild` so `dist/` always contains manifest-required icons.
- **Edge cases checked:**
  - Fresh repo without icon files still builds loadable extension.
  - `npm run build` confirms icons copied to `dist/assets/icons/`.

## 8) Runtime invisible pet despite enabled site

- **Files:** `src/content/index.ts`, `src/shared/messages.ts`, `src/background/service-worker.ts`
- **Problem:** render gate depended on `GetTabContext` roundtrip; if that initial request failed, `currentTabId` stayed `null` and `STATE_UPDATED` never unlocked rendering.
- **Risk:** extension appears "loaded" (popup works), but cat remains invisible on normal pages.
- **Fix:**
  - Removed `GetTabContext` protocol and related SW handler.
  - Simplified content render gating:
    - optimistic tab eligibility on visible page,
    - hidden-tab disables render,
    - receiving `STATE_UPDATED` explicitly enables rendering for active tab stream.
- **Edge cases checked:**
  - SW cold start / wake-up race no longer blocks first render.
  - Visibility transitions still stop/resume rendering correctly.
  - Build/typecheck/lint remain green after protocol simplification.

## 9) Service worker registration failure (`Status code: 15`)

- **File:** `public/manifest.json`
- **Problem:** runtime errors showed `Cannot use import statement outside a module` and `chrome.alarms.create` crash path.
- **Root causes:**
  - Content script bundle is ESM (imports shared chunk), but manifest content script was declared without module type.
  - Service worker uses `chrome.alarms`, but `alarms` permission was missing.
- **Fix:**
  - Added `"type": "module"` under `content_scripts` entry.
  - Added `"alarms"` to `permissions`.
  - Rebuilt `dist` and verified updated `dist/manifest.json`.
- **Edge cases checked:**
  - MV3 SW can import ESM and access `chrome.alarms` with declared permission.
  - Content script ESM import path is now valid by manifest declaration.

## 10) Content script module syntax crash on pages

- **Files:** `public/manifest.json`, `public/content-loader.js`
- **Problem:** Chrome executed content script as classic script while bundle used top-level `import`, causing `Cannot use import statement outside a module` at `content/index.js`.
- **Fix:**
  - Switched manifest content script to `content-loader.js` (classic script).
  - Added loader that performs `import(chrome.runtime.getURL('content/index.js'))` at runtime.
  - This keeps bundled module graph intact while satisfying content script execution constraints.
- **Edge cases checked:**
  - Loader failure is caught and logged without breaking host page JS.
  - `dist/manifest.json` points to `content-loader.js`.
  - `dist/content-loader.js` exists after build.

## 11) Remove cross-entry shared chunk dependency from content script

- **Files:** `src/content/runtime-shared.ts`, `src/content/index.ts`, `src/content/controller.ts`, `src/content/renderer.ts`, `src/content/animations.ts`
- **Problem:** `content/index.js` was emitted with top-level `import` from a shared chunk when content code imported symbols from `@shared/*`.
- **Risk:** on Chrome content-script execution path, classic-script evaluation throws `Cannot use import statement outside a module`.
- **Fix:**
  - Introduced local `src/content/runtime-shared.ts` with content-runtime enums/constants/types/message shapes.
  - Switched content-side imports from `@shared/*` to local runtime-shared module.
  - Rebuilt and verified `dist/content/index.js` now starts without `import` statements.
- **Edge cases checked:**
  - Message discriminants remain aligned with SW (`STATE_UPDATED`, `REQUEST_STATE_CHANGE`, etc.).
  - `npm run typecheck`, `npm run lint`, `npm run build` all pass.

## 12) Dynamic import blocked by `web_accessible_resources` policy

- **File:** `public/manifest.json`
- **Problem:** `content-loader.js` attempted `import(chrome-extension://.../content/index.js)`, but the page denied loading extension module URL not listed as web-accessible.
- **Fix:** Removed loader path and restored direct content script entry to `"js": ["content/index.js"]`.
- **Why safe now:** `dist/content/index.js` is fully self-contained (no top-level imports), so it works as classic content script.

## 13) Teleport-back bug after movement transitions

- **Files:** `src/content/controller.ts`, `src/shared/messages.ts`, `src/content/runtime-shared.ts`, `src/background/service-worker.ts`
- **Problem:** after local movement, SW sometimes still had stale position; on next state broadcast the cat snapped back ("teleport back").
- **Fix:**
  - Extended `REQUEST_STATE_CHANGE` message with optional actor snapshot:
    - `actorPosition`
    - `actorDirection`
  - Content controller now attaches current actor position/direction on every state-change request.
  - SW updates in-memory `petState` with actor snapshot before running FSM transition and broadcasting.
- **Edge cases checked:**
  - Arrival events (`ARRIVED`, `REACHED_FOOD`) no longer rebroadcast stale coordinates.
  - Cursor-driven transitions keep direction aligned with actual renderer direction.
  - `npm run typecheck`, `npm run lint`, `npm run build` all pass.

## 14) Animation quality and fallback robustness pass

- **Files:** `src/content/animations.ts`, `scripts/generate-cat-sprites.mjs`, `public/assets/cat/generated-report.json`
- **Problem:** animation quality looked inconsistent when direction-specific sources were missing.
- **Fix:**
  - Improved runtime resolver in `resolveAnimation()` to degrade gracefully by behavior-direction order before static fallback.
  - Expanded sprite generation candidate order (walk/eat/sleep) to reuse the best available directional sources before placeholder.
  - Regenerated assets and confirmed latest report shows `7 source / 0 placeholder`.
- **Edge cases checked:**
  - Missing direction no longer collapses immediately to static `base_south`.
  - Generated walk/eat/sleep sheets always available through source fallback chain.

## 15) Click interaction MVP (happy reaction)

- **Files:** `src/content/renderer.ts`, `public/styles/pet.css`, `src/content/controller.ts`, `src/content/runtime-shared.ts`, `src/background/service-worker.ts`
- **Problem:** roadmap behavior for left-click reaction was not implemented.
- **Fix:**
  - Added clickable pet hook in renderer (`onClick`).
  - Added visual heart-particle reaction (`playHappyReaction`) with scoped CSS animation.
  - Controller now handles pet clicks and sends `PET_CLICKED`.
  - Service worker now handles `PET_CLICKED` by incrementing happiness and broadcasting updated state.
- **Edge cases checked:**
  - Reaction is non-blocking and does not interfere with movement transform.
  - Happiness is clamped to 100.
  - Type/lint/build checks stay green after message-protocol extension.

## 16) Idle stall bug (cat stays still forever)

- **Files:** `src/content/controller.ts`, `src/content/runtime-shared.ts`
- **Problem:** cat could remain in `IDLE` indefinitely when no nearby cursor/food events occurred.
- **Fix:**
  - Added `IDLE_TIMEOUT` to content runtime event union.
  - Implemented idle wander timer in controller:
    - tracks per-frame delta,
    - after randomized 2.5-5.5s in idle sends `IDLE_TIMEOUT`,
    - resets timer while non-idle.
- **Edge cases checked:**
  - No event spam while walking/following/eating.
  - Idle trigger cadence is randomized for more natural movement.
  - `npm run typecheck`, `npm run lint`, `npm run build` all pass.

## 17) `Extension context invalidated` runtime noise on reload

- **Files:** `src/content/index.ts`, `src/content/controller.ts`
- **Problem:** after extension reload, old injected content scripts can continue running briefly; direct `chrome.runtime.*` calls throw `Extension context invalidated`.
- **Fix:**
  - Added context-alive guard (`chrome.runtime?.id`) before runtime calls.
  - Wrapped message sends in safe helper/try-catch to avoid uncaught errors during reload race.
  - Guarded `init()` early when extension context is unavailable.
- **Edge cases checked:**
  - Reloading extension while page remains open no longer produces uncaught message-send crashes.
  - Normal message flow still works when context is alive.

## 18) Eating state never exits (cat stuck forever)

- **Files:** `src/content/runtime-shared.ts`, `src/content/controller.ts`
- **Problem:** `EATING_DONE` was missing from `runtime-shared.ts` FsmEvent union, so the content script could never fire it. No eating timer existed in controller. Cat entered `Eating` and stayed there indefinitely.
- **Fix:**
  - Added `EATING_DONE` to `runtime-shared.ts` FsmEvent.
  - Added `tickEating(deltaMs)` to controller: tracks elapsed ms in Eating state, fires `EATING_DONE` after `EATING_DURATION_MS` (2400ms ≈ 8 frames × 120ms + buffer).
  - Eating timer resets on any non-Eating state.
- **Edge cases checked:**
  - Timer resets correctly if state changes before eating completes (e.g. food spawned during eating → RunningToFood → re-enter Eating later starts fresh).
  - `EATING_DONE` triggers FSM: hunger +30, happiness +10, → Idle.

## 19) SW alarm resets every page navigation

- **Files:** `src/background/service-worker.ts`
- **Problem:** `chrome.alarms.create('statsTick', ...)` was called at module top-level, executing every time the SW wakes up. `create` with duplicate name resets the alarm timer. Frequent tab switching/navigation could prevent stats from ever draining.
- **Fix:**
  - Removed top-level `create` call.
  - Alarm created once inside `handleInstalled`, guarded by `chrome.alarms.get` check (only creates if not already present).

## 20) SW loses state on wakeup after being killed by Chrome

- **Files:** `src/background/service-worker.ts`
- **Problem:** MV3 service workers are killed after ~30s of inactivity and restarted on next event. `onInstalled` and `onStartup` don't fire on SW wake — only on initial install and browser start. So after a kill/wake cycle, `petState` was the in-memory default, not the persisted value.
- **Fix:**
  - Introduced `stateLoaded` flag and `ensureStateLoaded()` which loads from storage exactly once per SW instance lifetime.
  - Called `ensureStateLoaded()` at the top of both the message listener and the alarm listener, before any business logic runs.

## 21) `tabs` permission missing — popup hide toggle broken

- **File:** `public/manifest.json`
- **Problem:** `chrome.tabs.query` returns tabs without `url` populated unless `tabs` permission is declared. The popup relied on `tab.url` to determine current hostname for the blocklist toggle. Without `tabs`, `url` was always `undefined` → `if (!url) return` → toggle never initialized.
- **Fix:** Added `"tabs"` to manifest permissions.

## 22) Wander targets outside viewport — cat stuck at screen edge

- **Files:** `src/shared/fsm.ts`, `src/content/controller.ts`, `src/shared/messages.ts`, `src/content/runtime-shared.ts`
- **Problem:** `randomWanderTarget` in `fsm.ts` clamped x/y to `>= 0` but not to viewport max. The controller clamps the cat's position but the target remained off-screen. Cat walked to viewport edge and stopped in WALKING state forever because `ARRIVAL_THRESHOLD_PX` was never reached.
- **Fix:**
  - Moved wander target generation to `controller.ts` where `window.innerWidth/Height` is accessible.
  - Target is clamped to `[0, viewport - PET_SIZE]` on both axes.
  - `IDLE_TIMEOUT` FsmEvent now carries `wanderTarget: Vec2` (required field) passed from controller.
  - `fsm.ts` removed `randomWanderTarget` helper entirely.

## 23) `mousemove` sent ~60 SW messages/second

- **Files:** `src/content/controller.ts`, `src/content/index.ts`
- **Problem:** `mousemove` fired SW messages on every event when cursor was within follow radius — up to 60/sec. This kept the SW alive, burned CPU, and created message queue pressure.
- **Fix:** Added 50ms throttle (`MOUSEMOVE_THROTTLE_MS`) using `Date.now()`. Max ~20 messages/sec while following.

## 24) `frameTimer` reset to 0 caused animation drift

- **File:** `src/content/renderer.ts`
- **Problem:** On frame advance, `frameTimer = 0` discarded overshoot time. If a frame took 60ms but `frameDurationMs = 50ms`, the extra 10ms was lost. Animations ran progressively slower than configured, especially at lower framerates.
- **Fix:** Changed to `frameTimer -= config.frameDurationMs` to preserve overshoot.

## 25) `canRenderOnThisTab = true` initially caused multi-tab flicker

- **Files:** `src/content/index.ts`
- **Problem:** Cat started rendering immediately from local storage state, before the SW confirmed this tab was the active one. Could briefly show cat on background tabs.
- **Fix:** Set `canRenderOnThisTab = false` initially. Rendering starts only when `STATE_UPDATED` arrives from SW. Added 1s fallback timeout for cold-start race (SW not yet awake).

## 26) Dead `MsgType.ReachedTarget` in `src/shared/messages.ts`

- **File:** `src/shared/messages.ts`
- **Problem:** `MsgType.ReachedTarget` and `MsgReachedTarget` existed in the shared messages module but not in `runtime-shared.ts`. SW didn't handle it. Dead code that could mislead future development.
- **Fix:** Removed entirely from `shared/messages.ts`.

## Verification

- `npm run typecheck` passes (zero errors).
- `npm run build` passes.
