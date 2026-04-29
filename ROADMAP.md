# 🐾 Pet Extension — Roadmap

Chrome MV3 extension для интерактивных пиксельных питомцев на любой вебстранице.

---

## 🎯 Видение и позиционирование

**Одной строкой:** "Tamagotchi встречает Shimeji в твоём браузере — но красиво и с интерактивом."

**Чем отличаемся от конкурентов:**
- **vs Shimeji-ee / eSheep:** мы в браузере, работаем на любом сайте, не надо устанавливать desktop software
- **vs Pet Tab / Tabby Cat:** мы на КАЖДОЙ странице, а не только в new tab; у нас реальный интерактив, а не статичная картинка
- **vs Desktop Goose:** мы дружелюбные, а не "злые", и не мешают работе (toggle off)

**Целевая аудитория:**
- Разработчики/дизайнеры с виайбом (Linear/Raycast/Arc эстетика)
- Студенты которые сидят целый день в браузере
- Люди которые скучают по Tamagotchi / старым пиксельным играм

**Success metrics для портфолио (важно для интерншипов!):**
- 1000+ WAU к моменту подачи заявок (август 2026)
- 4.5+ звёзд в Chrome Web Store
- Попадание в "featured" в CWS
- Одна виральная волна (HN front page / Reddit r/chrome топ пост / Product Hunt top 5)

---

## 🏗️ Архитектура (high-level)

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension MV3                      │
├─────────────────────────────────────────────────────────────┤
│  Service Worker (background.js)                              │
│    - state machine (hunger, happiness, energy)              │
│    - tick system (каждые N минут списывать stats)           │
│    - chrome.storage.local sync                              │
│    - message bus между tabs                                  │
├─────────────────────────────────────────────────────────────┤
│  Content Script (на каждой странице)                         │
│    - Shadow DOM container для изоляции стилей               │
│    - Pet renderer (canvas или CSS sprite animation)         │
│    - Input handlers (mouse tracking, click events)          │
│    - Physics engine (движение, collision с viewport edges)  │
│    - Behavior FSM (idle/walk/run/eat/sleep/follow)          │
├─────────────────────────────────────────────────────────────┤
│  Popup UI (extension icon click)                             │
│    - Pet selection                                           │
│    - Stats display                                           │
│    - Settings (speed, visibility, disable на сайтах)        │
├─────────────────────────────────────────────────────────────┤
│  Options Page                                                │
│    - Site blocklist                                          │
│    - Pet customization                                       │
│    - Premium features (потом)                                │
└─────────────────────────────────────────────────────────────┘
```

**Ключевые технические решения:**

1. **Shadow DOM обязательно** — для изоляции от стилей сайта (Nodex experience)
2. **Canvas vs DOM sprite:** начнём с DOM sprite (проще, дешевле ассеты), перейдём на Canvas если будет упираться в perf
3. **Sprite sheets** через CSS `background-position` анимацию + `steps()` timing function
4. **State в service worker** — single source of truth, content script только рендерит
5. **requestAnimationFrame** для движения, НЕ setInterval
6. **transform: translate3d** для GPU acceleration, никаких top/left в hot path

---

## 📅 Roadmap по фазам

### Phase 0: Research & Setup (1 неделя)
*Цель: понять ландшафт, подготовить инфраструктуру*

- [ ] Установить и протестировать ВСЕХ конкурентов (Shimeji-ee, eSheep, Pet Tab, Tabby Cat, Desktop Goose, oneko.js)
- [ ] Записать что бесит в каждом — это наш список "что не делать"
- [ ] Сохранить скриншоты для будущего README ("compared to...")
- [ ] Создать репо `pet-extension` (или придумать имя получше — см. ниже)
- [ ] Настроить проект: Vite + TypeScript + Chrome MV3 boilerplate
- [ ] Настроить ESLint + Prettier (как в Nodex)
- [ ] Создать `CLAUDE.md` с контекстом проекта для Cursor AI
- [ ] Создать `docs/` папку с архитектурными заметками
- [ ] Набросать mood board: Stardew Valley, Pokemon Gen 3, Hypixel pets, Cult of the Lamb

**Naming brainstorm:**
- Pawcket (paws + pocket) 🐾
- Pixelpets
- Tabby (уже занято)
- Companion
- Bits (like "have a bit of a pet") 
- **Pocketry** — если нравится вайб pottery/poetry

**Deliverable:** пустой репо с настроенным build, hello world content script работает.

---

### Phase 1: MVP — First Pet (3-4 недели)
*Цель: один кот, базовый интерактив, deployable на CWS*

#### 1.1 Asset pipeline (неделя 1)
- [ ] Определиться со стилем: 16x16 или 32x32 пиксельные спрайты?
  - **Рекомендация:** 32x32 — лучше читается на больших мониторах
- [ ] Найти pixel artist или использовать свободные ассеты из itch.io для прототипа
  - **Бесплатные источники:** itch.io/game-assets (есть куча CC0 cat sprites), OpenGameArt
  - **Платные:** artstation, собственный на fiverr ($50-100 за один pet полный set)
- [ ] Нужные анимации для кота MVP:
  - idle (breathing, 4 frames)
  - walk (8 frames, 4 направления или 2 + mirror)
  - run (8 frames)
  - eat (8 frames)
  - sleep (4 frames looped)
  - happy reaction (heart particles)

#### 1.2 Core engine (неделя 1-2)
- [ ] Content script с Shadow DOM container
- [ ] Pet renderer class (sprite sheet + CSS animation)
- [ ] Position persistence через chrome.storage.local
- [ ] Smooth transition между страницами (fade out → fade in в том же месте)
- [ ] Mouse tracking с throttle (60fps хватит)

#### 1.3 Behaviors (неделя 2-3)
- [ ] **Idle:** стоит на месте, периодически моргает, чешется
- [ ] **Wander:** рандомно ходит по экрану (easing motion)
- [ ] **Follow cursor:** идёт к курсору с задержкой (200-500ms), останавливается когда близко
- [ ] **Edge awareness:** не заходит за границы viewport
- [ ] **Click interactions:**
  - Левый клик: питомец реагирует (happy animation + heart)
  - Правый клик на пустое место: контекстное меню "Накормить тут"
  - Правый клик на питомца: меню "Поспать / Играть / Скрыть"

#### 1.4 Feeding system (неделя 3)
- [ ] "Корм" как draggable emoji или pixel food sprite
- [ ] Pet detects food, рассчитывает путь, идёт и ест
- [ ] Eat animation → food disappears → happiness++
- [ ] Visible hunger indicator (тонкая, не назойливая)

#### 1.5 Polish & edge cases (неделя 4)
- [ ] Работает на YouTube, Twitter, Gmail, GitHub, Reddit (топ-10 сайтов протестировать вручную)
- [ ] Не ломается на сайтах с агрессивным CSP (GitHub, Google)
- [ ] Performance: <5% CPU при idle, <10% при walking
- [ ] Memory leak check (несколько часов с открытыми вкладками)
- [ ] Accessibility: можно выключить одним кликом, есть hotkey

#### 1.6 Chrome Web Store submission (конец недели 4)
- [ ] Privacy policy (простой GitHub Pages)
- [ ] Promo images (5 штук, 1280x800)
- [ ] Screenshots на популярных сайтах
- [ ] Demo video (30 сек, loom/screen recording)
- [ ] Description с ключевыми словами: "pet, cat, companion, cursor, fun"
- [ ] Submit → ждать одобрения (обычно 2-5 дней)

**Deliverable:** Живой extension в CWS, один кот, feeding работает, позиция сохраняется.

---

### Phase 2: Growth & Launch (2-3 недели)
*Цель: получить первых 1000 юзеров*

#### 2.1 Landing page (неделя 1)
- [ ] Купить домен (.app или .xyz — дешёво)
- [ ] Next.js или просто Vite landing
- [ ] Hero: animated cat GIF на любой странице
- [ ] Features grid (4-6 фич с GIF'ами)
- [ ] CTA: "Add to Chrome" с большой кнопкой
- [ ] Changelog page
- [ ] Разместить на Vercel

#### 2.2 Launch strategy (неделя 2)
Запускать ПОСЛЕДОВАТЕЛЬНО, не всё сразу:

**День 1 — Reddit r/chrome_extensions:**
- Честный пост: "I built a pixel pet extension that actually follows your cursor"
- GIF в посте, ссылка в комментариях

**День 3 — Product Hunt:**
- Подготовить hunters заранее
- Launch в 00:01 PST
- Весь день отвечать в комментах

**День 7 — Hacker News Show HN:**
- Title: "Show HN: Pixel pets that live on your browser tabs"
- Постить ВТОРНИК 10AM EST
- Блогпост о техническом челлендже (см. ниже) рядом

**День 10 — Technical blog post:**
- "How I made a pet survive Chrome's Trusted Types CSP" (или другой interesting technical bit)
- dev.to + personal blog + Medium
- Tweet thread (X) с GIFs

**День 14 — TikTok/Instagram Reels:**
- "POV: you have a pixel cat living in your browser"
- Короткие loopable GIF-видео

#### 2.3 User feedback loop (постоянно)
- [ ] Discord server (простой, один канал для фидбека)
- [ ] Typeform для фидбека встроенный в popup
- [ ] Weekly changelog в Discord

**Deliverable:** 1000+ install'ов, 4+ звёзд, активный Discord.

---

### Phase 3: More Pets & Personality (3-4 недели)
*Цель: расширить контент, увеличить retention*

- [ ] **Собака** — более игривая, бегает быстрее, приносит палочки
- [ ] **Гусь** — chaotic evil, иногда ворует курсор, рандомно хонкает (silent honk = screen shake)
- [ ] Система **personality traits:**
  - Shy (редко выходит, но супер милый когда выходит)
  - Energetic (много бегает)
  - Lazy (много спит)
  - Playful (часто хочет играть)
- [ ] Выбор питомца при установке
- [ ] Настройки внешнего вида (окрас кота: оранжевый, чёрный, белый, calico)

---

### Phase 4: Gamification & Retention (4-6 недель)
*Цель: дать людям reasons to come back*

- [ ] **Stats system:** hunger / happiness / energy / friendship
- [ ] **Aging/Evolution:** pet растёт со временем (kitten → cat → wise cat)
- [ ] **Achievements:** "Накормил 100 раз", "Провёл неделю вместе", "Увидел гуся" (easter egg)
- [ ] **Daily check-in rewards:** новые items, outfits
- [ ] **Inventory:** скины, еда, игрушки
- [ ] **Mini interactions:**
  - Кидать мячик (pet chases)
  - Лазерная указка (только для кота, собаку не возбуждает)
  - Расчёсывать (click & hold)
- [ ] **Pet sounds** (subtle, mute-able): purr, bark, honk

---

### Phase 5: Multi-pet & Social (опционально, post-launch)
*Цель: сделать viral-loop*

- [ ] Несколько питомцев одновременно (они взаимодействуют друг с другом)
- [ ] Pet interactions: кот и собака сначала дерутся, потом дружат
- [ ] **Cross-device sync** через chrome.storage.sync
- [ ] **Friends' pets:** видеть pet друга на своём экране (WebRTC? опционально и дорого)
- [ ] **Pet cards** для шеринга: "Meet my cat Пушок, level 12"

---

### Phase 6: Monetization (когда будет 10k+ users)

**НЕ РАНЬШЕ** чем наберётся аудитория — иначе убьёшь growth.

**Freemium модель:**
- Free: 1 pet, базовые анимации, ограниченные скины
- **Paw Pass ($3/мес или $20/год):**
  - Все pets unlocked
  - Все скины
  - Custom pet (upload own sprite)
  - Кастомные звуки
  - Priority support

**Альтернатива: One-time purchases ($2-5)**
- Per pet или per pack
- Проще для юзеров, но меньше LTV

---

## 🧩 Технические челленджы (ранжированы по сложности)

### 🔴 Hard
1. **Persistence между страницами** — pet должен "не умирать" при навигации. Решение: state в service worker, content script восстанавливает позицию при инжекте.
2. **Многовкладочный sync** — если открыто 3 вкладки, должен быть ОДИН pet, не три. Решение: service worker решает в какой вкладке pet сейчас "живёт" (активная вкладка), остальные не рендерят.
3. **Z-index войны** — некоторые сайты юзают `z-index: 2147483647`. Решение: свой контейнер на `2147483646` + fallback с периодическим re-check.
4. **CSP на strict сайтах** — некоторые сайты блокируют inline styles. Решение: external CSS файл через web_accessible_resources.

### 🟡 Medium
5. **Performance на слабых машинах** — pixel animation должна летать. Решение: Canvas fallback для <60fps scenarios.
6. **Fullscreen apps** — YouTube fullscreen, Figma fullscreen. Pet должен либо скрываться, либо работать поверх.
7. **Iframe issues** — сайты с кучей iframes (Notion). Решение: инжектить только в top frame.

### 🟢 Easy
8. **Sprite loading** — preload все спрайты в service worker.
9. **Dark/light mode detection** — pet адаптирует цвета.

---

## 📋 Immediate next steps (эта неделя)

Поскольку у тебя сейчас Nodex, учёба, и wrap-up семестра, не распыляйся. **Делай только это на этой неделе:**

1. **День 1-2:** Установи всех конкурентов, напиши 1-страничный документ "что бесит в каждом" — это будет топливо
2. **День 3:** Создай репо, настрой boilerplate (можно скопировать структуру с Nodex)
3. **День 4:** Найди хороший cat sprite sheet на itch.io (бесплатный для прототипа, заменим потом)
4. **День 5-7:** Hello world — кот рендерится на любом сайте и ходит по рандомной траектории

**Не трогай ничего другого** пока не получишь работающий Hello World. Feeding, settings, landing — всё потом.

---

## 💭 Риски и что может пойти не так

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| CWS отклонит из-за broad permissions | Средняя | Минимизировать permissions, писать чёткий purpose |
| Perf issues на слабых ноутбуках | Высокая | Performance budget с первого дня, канвас fallback |
| Конкурент выпустит то же самое | Средняя | Speed matters — быстрее ship, чем perfect |
| Ты устанешь / забросишь | **Высокая** | Маленькие deliverables каждую неделю, public commitment в Discord |
| Art будет дорогим | Средняя | Начни с CC0 assets, потом найми только когда будут users |
| Юзеры запросят pet для Firefox/Safari | Низкая в начале | Игнорируй пока не будет 10k+ Chrome users |

---

## 🎓 Почему этот проект — killer для резюме

Учитывая что ты уже в интерншип-пайплайне на fall 2026:

1. **Доказывает product thinking** — не просто код, но launch, growth, retention
2. **Metrics you can cite:** "Shipped extension with 5k+ WAU", numbers > всего остального
3. **Технические challenges:** multi-tab state sync, Shadow DOM, performance optimization — это реальные SWE проблемы
4. **Complement к Nodex:** оба Chrome extensions, но разные проблемы. Показывает depth в области.
5. **Storytelling:** "Я увидел пробел в рынке, построил, запустил, получил users" — это то что FAANG recruiters любят

**На интервью это будет главный talking point**, особенно для Meta University / Google STEP где ищут builders, а не leetcoders.

---

## ✅ Definition of Done для v1.0

- [ ] Extension в Chrome Web Store, одобрен
- [ ] 500+ active users
- [ ] 4.0+ звёзд (минимум 20 reviews)
- [ ] Один технический блогпост с 1000+ views
- [ ] Показан на HN или Product Hunt
- [ ] Работает на топ-20 сайтах без edge cases
- [ ] CPU < 5% idle, < 10% active
- [ ] Privacy policy, ToS, landing page живые

---

*Last updated: April 22, 2026*
*Owner: Vladimir*
*Status: Planning*
