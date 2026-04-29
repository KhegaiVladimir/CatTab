# Cattab — Master Product Plan

> Owner: Vladimir · Target: 1000+ WAU by August 2026 · Platform: Chrome MV3

---

## Vision

A pixel-art cat that genuinely feels alive. Not a widget — a companion. The cat has moods, gets hungry, reacts to the user, and makes browsing feel less lonely. Every feature should either make the cat feel *more real* or make the user smile.

---

## Phase 1 — MVP Polish (now → May 2026)

Goal: ship to Chrome Web Store with a quality bar that earns 4.5+ stars from day one.

### 1-A · Live Popup Portrait ← NEXT

**What**: Instead of a static 🐱 emoji in the header, show the actual animated cat sprite (92×92 px) playing the real current animation — idle_calm, idle_exciting, eating, sleeping.

**Why it matters**: First thing every user sees when they click the extension icon. Right now it looks dead. A breathing, blinking cat immediately communicates "this thing is alive."

**Implementation plan**:
1. Add `<div id="pet-portrait">` to popup HTML, styled as a 92×92 sprite canvas
2. Shared mini-renderer (no Shadow DOM needed in popup — isolated document)
3. RAF loop reads `petState.behavior` from storage → picks sprite URL + frame count
4. `chrome.storage.onChanged` switches animation when state changes (e.g. cat starts eating)
5. Same `background-position` trick as content renderer — one sprite sheet, frame index steps every `frameDurationMs`
6. Portrait shows current direction too (so if cat is walking east, portrait shows east pose)

**Acceptance**: open popup → cat animates → feed the cat → portrait switches to eating pose in real time.

---

### 1-B · Food Sprite Artwork

**What**: Replace the 🐟 emoji placeholder with real pixel-art food items. Folder `public/assets/food/` exists but is empty.

**Planned items**:
- `fish.png` — default food (matches 🐟 current placeholder)
- `shrimp.png`, `treat.png` — unlockable variety (Phase 3)

**Spec**: 48×48 px, bobbing animation (4 frames), burst effect on eat (4 frames). Sprite sheet horizontal strip.

**Pipeline**: drop frames into `public/assets/food/fish/frame_*.png` → `npm run sprites:build` picks them up automatically (same folder-driven system as cheeto).

---

### 1-C · Sleep Pose Artwork

**What**: Dedicated sleep sprite instead of reusing `idle_calm`. Cat curls up, slow breathing animation.

**Spec**: 6 frames, 92×92 px, `sleep.png` sprite sheet. Generator maps `Sleeping` state → `sleep.png`.

**Code change**: `resolveAnimation` in `animations.ts` — replace `idle_calm` fallback for Sleeping with `sleep.png` once the file exists.

---

### 1-D · Hunger Visual Cue

**What**: When hunger < 30, show a small thought bubble above the cat on the page: `🐟?`

**Why**: Right now hunger can drop to 0 and the user has no idea. The cat needs to tell you it's hungry.

**Implementation**:
- `renderer.ts` gets `showHungerCue(visible: boolean)` method
- Controller calls it on every state update when `stats.hunger < 30`
- Bubble is a `<div>` inside shadow root, CSS-animated float
- Disappears when cat starts eating

---

### 1-E · Compatibility Testing

Manual sweep before CWS submission. Priority order:

| Site | Risk | Known issues |
|------|------|-------------|
| YouTube | High | SPA navigation, custom scroll, fullscreen player |
| Gmail | High | Strict CSP, custom event model |
| GitHub | Medium | MathML, iframe heavy |
| Reddit | Medium | Infinite scroll, periodic DOM nukes |
| Twitter/X | Medium | Aggressive SW, frequent re-renders |
| Notion | Low | Canvas-based editor |
| Google Docs | Low | iframe + canvas |

Test matrix per site:
- Cat renders and walks ✓
- Feed via context menu works ✓
- Tab switch → single-tab rule ✓
- Resize + scroll ✓
- SPA navigation (pushState) ✓
- No JS errors in devtools ✓

---

### 1-F · Performance Audit

Targets from roadmap:
- CPU idle: < 5% on low-end hardware
- CPU active (walking/eating): < 10%
- Memory: < 30 MB RSS after 2 hours open

Tools: Chrome DevTools Performance panel, Task Manager.

Known risk areas:
- `mousemove` at 50ms throttle — OK
- RAF loop always running even when tab hidden — fix: pause on `document.hidden`
- Storage writes debounced 500ms — OK

---

## Phase 2 — Growth & Retention (June–July 2026)

Goal: make users want to open a new tab just to check on their cat.

### 2-A · New Tab Page (optional, opt-in)

Replace the Chrome new tab with a full-viewport cat habitat. Cat lives in a little room, user can interact directly. Toggle in options: "Use as new tab page."

**Why opt-in**: mandatory NTP takeover gets 1-star reviews. Offer it, don't force it.

---

### 2-B · Cat Personalities / Named Cats

User names their cat in the options page. Name shows in popup header.

Three starting personalities (cosmetic only, same FSM):
- **Cheeto** (default) — orange, energetic, current sprite
- **Mochi** — white/grey, calm, higher chance of `idle_calm`
- **Pepper** — black, mischievous, faster wander speed

Each personality is a different sprite set in `public/assets/<name>/`. Switching personality = switching `CHARACTER_DIR`.

---

### 2-C · Achievements System

Small dopamine hits that reward interaction:

| Achievement | Trigger | Reward |
|---|---|---|
| First Meal | feed cat for first time | +sparkle animation |
| Well Fed | feed 10 total times | unlock shrimp food |
| Best Friends | 7 days streak of any interaction | name badge in popup |
| Night Owl | cat is active after midnight | custom idle pose |
| World Traveler | cat seen on 20+ different hostnames | globe badge |

Stored in `chrome.storage.local` as `achievements: string[]`. Checked in SW on relevant events.

---

### 2-D · Sound Effects (opt-in)

`soundEnabled` is already in storage and options, just not wired to anything.

Sounds:
- Soft meow on click (already has heart reaction, add sound layer)
- Purr loop while eating
- Pad steps while walking (very subtle, 10% volume)

All sounds: short OGG files, < 20 KB each. Loaded as `new Audio(chrome.runtime.getURL(...))`.

---

### 2-E · Cat Mood System (visible)

Extend stats to affect visible behavior:

| Stat | Low effect | High effect |
|---|---|---|
| Hunger | cat walks slower, hunger cue shows | — |
| Happiness | only `idle_calm` variant | `idle_exciting` bias already implemented |
| Energy | Sleeping forced at 0, already done | cat moves slightly faster |

Add color tint to stat bars in popup (green → yellow → red) so user understands urgency.

---

## Phase 3 — Monetization & Scale (August 2026+)

Goal: sustainable revenue that funds continued development.

### 3-A · Cattab Pro (one-time purchase, ~$2.99)

**Free tier** (keeps everything current):
- Cheeto character
- Auto/Follow/Wander modes
- Basic feeding

**Pro tier unlocks**:
- Additional character skins (Mochi, Pepper, + seasonal)
- Extra food items (shrimp, cake, sushi)
- Sound effects
- Achievement system
- New Tab page habitat

**Implementation**: `isPro: boolean` in storage. Verified against Chrome Identity API or a simple license key system. No server required for v1 — local validation is fine at this scale.

---

### 3-B · Seasonal Events

Limited-time content to drive re-engagement:

- **Halloween** (Oct): cat wears tiny witch hat, spooky idle pose, pumpkin food
- **Christmas** (Dec): Santa hat, snowflake particles on walk, cookie food
- **Valentine's** (Feb): extra heart particles on click, chocolate food

Each event: 2 new sprites, 1 new food, 1 achievement. Activates automatically by system date.

---

### 3-C · Chrome Web Store Growth

**ASO (App Store Optimization)**:
- Title: "Cattab — Cat Pet for Chrome"
- Keywords: cat, pet, virtual pet, browser companion, pixel art cat, new tab cat
- Short description (132 chars): "A pixel art cat that lives on every webpage. Feed it, play with it, watch it wander."
- 5× promo screenshots: feeding, sleeping, following cursor, popup stats, new tab page

**Content marketing**:
- 30-second demo video (cat walks around, gets fed, eats, sleeps)
- Reddit post in r/chrome, r/pixelart, r/InternetIsBeautiful
- Product Hunt launch

**Viral mechanic**: share your cat's current mood/stats as an image ("My cat Cheeto is 87% happy today 🐱"). One button in popup → copies/shares a generated stat card.

---

## Timeline

```
Apr 27 – May 4   Phase 1-A: Live popup portrait (this week)
May 5 – May 11   Phase 1-B/C: Food + sleep artwork (waiting on art)
May 12 – May 18  Phase 1-D: Hunger cue on cat
May 19 – May 25  Phase 1-E: Compatibility testing sweep
May 26 – Jun 1   Phase 1-F: Performance audit + final fixes
Jun 2            Submit to Chrome Web Store
Jun 2 – Jun 15   CWS review period (2 weeks typical)
Jun 16           PUBLIC LAUNCH
Jun 16 – Jul 31  Phase 2 features, iterate based on reviews
Aug 2026         Phase 3 monetization, target 1000 WAU
```

---

## Definition of Done (v1.0 for CWS submission)

- [ ] Zero console errors on YouTube, Gmail, GitHub, Reddit
- [ ] CPU < 5% idle, < 10% active (verified in Task Manager)
- [ ] All three stat bars update live in popup
- [ ] Feed system works on all 5 test sites
- [ ] Live popup portrait animates correctly
- [ ] Popup actions (mode switch, hide toggle) apply instantly
- [ ] Privacy policy page live (required by CWS)
- [ ] 5× 1280×800 promo screenshots
- [ ] Store description with keywords written
- [ ] 30s demo video recorded

---

## Tech Debt & Known Risks

| Item | Risk | Fix |
|---|---|---|
| `public/assets/cat/` legacy 4-dir set on disk | Confusing, ~2 MB wasted | Delete after v1.0 ships |
| SW killed after 30s inactivity | Stats tick may miss | Already mitigated by alarms |
| No error tracking | Blind to user crashes | Add `chrome.runtime.onInstalled` error handler, consider Sentry (Phase 2) |
| No automated tests | Regressions sneak in | Add Vitest unit tests for FSM in Phase 2 |
| Popup closes on `blur` | Can't inspect while popup open | Expected Chrome behavior, not fixable |
