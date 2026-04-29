# ROADMAP Status

Current status snapshot aligned to `ROADMAP.md`.

Last updated: 2026-04-27 (cheeto 8-direction art landed)
Owner: Vladimir
Project phase: Phase 1 (MVP implementation)

---

## Done

### Phase 0: Research & Setup

- [x] Repo initialized and working
- [x] Vite + TypeScript + Chrome MV3 boilerplate configured
- [x] ESLint + Prettier configured
- [x] `CLAUDE.md` created and used as implementation guidance

### Phase 1.2: Core engine

- [x] Content script with Shadow DOM container
- [x] Pet renderer class with sprite sheet animation
- [x] Position and state persistence via `chrome.storage.local`
- [x] `requestAnimationFrame` loop for movement
- [x] `transform: translate3d` in hot path
- [x] Viewport clamping (edge awareness baseline)

### Phase 1.3: Behaviors (partial)

- [x] Idle baseline state
- [x] Wander behavior (`IDLE_TIMEOUT` -> `WALKING`)
- [x] Follow cursor behavior in FSM/controller
- [x] Single-tab rule enforced (`activeTabId` render gating)

### Phase 1.4: Feeding system (partial)

- [x] Context-menu entry "Feed cat here"
- [x] Feed position pipeline fixed to use real right-click coordinates
- [x] Pet transitions to run/eat path (`FOOD_APPEARED` -> `RUNNING_TO_FOOD` -> `EATING`)

### Phase 1.4: Feeding system

- [x] `EATING_DONE` event wired — eating timer in controller (2400ms), cat now exits Eating → Idle correctly
- [x] Hunger +30, happiness +10 on eat confirmed working

### Phase 1.1: Asset pipeline (cheeto character)

- [x] Cheeto 8-direction top-down sprite set integrated (N/S/E/W + NE/NW/SE/SW walks)
- [x] Two idle moods (`calm_idle`, `exciting_idle`) authored and wired
- [x] Eat animation (south) wired into Eating state
- [x] Sprite generator rewritten to be folder-driven against `public/assets/cheeto/animations/`
- [x] `Direction` enum extended to 8 values in both `runtime-shared.ts` and `src/shared/types.ts`
- [x] `directionTo` rewritten as atan2-based 8-way classifier
- [x] Idle variant picker (controller-local, biased by happiness stat)
- [x] Manifest `web_accessible_resources` switched from `cat/` to `cheeto/`
- [x] All 12 generated sheets sourced from real frames (zero placeholders in latest report)

### Quality / Stability fixes completed

- [x] FSM `CURSOR_MOVED` `changed`-flag bug fixed
- [x] XSS-safe blocklist rendering in options page
- [x] Lint script fixed for flat ESLint config
- [x] Typecheck passing
- [x] ESLint passing
- [x] SW alarm no longer resets on every wake — created once on install
- [x] SW loads state from storage on every wakeup (`ensureStateLoaded` guard)
- [x] `tabs` permission added — popup hide toggle now works
- [x] Wander target clamped to viewport — cat no longer gets stuck at screen edge
- [x] `mousemove` throttled to ~20 msg/sec — SW no longer hammered by cursor events
- [x] `frameTimer -= duration` (was `= 0`) — animation drift fixed
- [x] `canRenderOnThisTab = false` initially — no multi-tab flicker on load
- [x] Dead `MsgType.ReachedTarget` removed

---

### Phase 1-A: Live popup portrait

- [x] Animated cat sprite in popup header (92×92 → 72×72 scaled, pixelated)
- [x] RAF loop drives frame advance — same timing logic as content renderer
- [x] `chrome.storage.onChanged` switches animation in real time (idle → eating → walking)
- [x] Direction-aware walk pose in portrait (matches what cat does on page)
- [x] Status label ("Idle", "Eating", "Following you", etc.) updates live
- [x] Dark mode compatible (portrait bg uses `--accent-dim`)

---

## In Progress

### Phase 1.1: Asset pipeline

- [x] Cheeto 8-direction sprite set landed and wired (see "Done" above)
- [ ] Dedicated sleep pose (currently falls back to `idle_calm`)
- [ ] Food sprite artwork (`public/assets/food/` exists but empty — emoji `🐟` placeholder still in use)
- [ ] Decide whether to retire `public/assets/cat/` (legacy 4-dir side-view set) or keep as alternative skin

### Phase 1.3: Behaviors


- [x] Left-click interaction reaction (happy animation + particles)
- [ ] Right-click on pet custom actions ("sleep / play / hide")

### Phase 1.4: Feeding UX

- [ ] Food entity visuals and lifecycle polish
- [ ] Clear hunger indicator in UI

### Phase 1.5: Polish & edge cases

- [ ] Manual compatibility testing on top websites
- [ ] CSP stress validation on strict sites
- [ ] Fullscreen behavior policy and handling
- [ ] Iframe/top-frame behavior audit

---

## Next (Priority Order)

1. **Feeding UX polish** ← in progress
   - [x] Food sprite (`🐟` emoji) visible at right-click point, bobbing animation, burst on eat
   - [ ] Hunger indicator in popup updates live
   - [ ] Replace emoji with real pixel-art food asset from `public/assets/food/` once authored

2. **Right-click-on-pet action menu**
   - "Sleep", "Play", "Hide on this site" context actions directly on the pet

3. **Manual compatibility sweep**
   - YouTube, Gmail, GitHub, Reddit, Twitter/X — test all behaviors
   - Tab switching storms, window resize, SPA navigation
   - CSP validation on strict sites (GitHub, Google)

4. **Performance audit**
   - Profile CPU idle vs active against roadmap targets (<5% idle, <10% active)
   - Memory leak check after several hours open

5. **Release readiness**
   - Privacy policy page
   - CWS promo images (5× 1280×800)
   - Store description with keywords
   - Demo video (30s)

---

## Known Gaps vs `ROADMAP.md`

- Landing/growth/launch phases (Phase 2+) not started.
- Multi-pet/personality/gamification/monetization phases not started.
- Definition of Done for v1.0 not yet met.

---

## Notes

- Detailed implementation-level fix log lives in `were_fixed.md`.
- This file should be updated after every meaningful feature or stability change.
