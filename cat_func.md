Вот FSM со всеми состояниями — можешь кликать на любой блок чтобы сразу уточнить детали.

Теперь разберу каждое состояние подробно:

---

## Все состояния и что кот делает

### 🟢 Core движение (Teal)

**Idle** — стартовое, к нему всё возвращается.
- Анимации: бlink каждые 2–4s, stretch раз в 30s, breathing (лёгкое масштабирование ±2%)
- Таймер: через ~8s случайный выбор → Wander или Sit

**Wander** — случайная прогулка по странице.
- Выбирает random target point в пределах viewport (с отступом 60px от краёв)
- Движется с ease-in-out, скорость 80–120px/s
- Проверяет края каждый frame → если слишком близко, пересчитывает точку
- Возврат в Idle после достижения точки

**Follow cursor** — идёт к курсору с задержкой.
- Throttle на mousemove: ~60fps
- 200–500ms lag (у shy-котов 500ms, у playful — 200ms)
- Останавливается если расстояние < 40px
- Небольшой "overshooting" эффект для живости

**Sit** — садится если долго не двигался.
- Trigger: 5s without movement
- Анимация sit-down (складывает лапы)
- Из Sit можно перейти в Sleep (ещё 30s)

### 🟣 Recovery (Purple)

**Sleep** — когда energy = 0.
- Trigger: energy stat упал до нуля (долго не кормил)
- Анимация: свёртывается, zzz-particles
- Energy восстанавливается постепенно пока спит (~1 unit/min)
- Просыпается сам когда energy = full, или от клика

### 🟠 Interactions (Amber)

**React (happy)** — ответ на левый клик.
- Мгновенный: heart particle burst (3–5 сердечек разлетаются)
- Кот подпрыгивает и оборачивается к курсору
- Длительность: 800ms → возврат в Idle
- Happiness++ при каждом вызове

**Eat** — кот видит еду и идёт к ней.
- Trigger: food item появился в пределах viewport
- Кот поворачивается к еде, идёт туда (pathfinding простой: прямая линия)
- При достижении: eat animation (8 frames), food disappears
- Happiness +15, hunger -40
- Возврат в Idle

**Play** — активный режим с объектом.
- Trigger: правый клик → меню → "Play"
- Объект (мячик или laser dot) появляется на экране
- Кот гоняется за объектом (run state, быстрее чем Wander)
- Длительность: 30–60s или до правого клика "Stop"
- Energy -- быстро, happiness ++ быстро

### 🔴 Edge / Special (Coral)

**Edge bump** — кот врезался в границу viewport.
- Trigger: позиция кота достигла края (с отступом 20px)
- Анимация: небольшой shake, "ой" expression
- Быстро поворачивается на 180° и продолжает Wander в другом направлении

**Groom** — кот чешется пока ты держишь клик.
- Trigger: mousedown на кота + держать 500ms+
- Анимация: кот жмурится, трётся о невидимую руку
- Happiness ++ пока держишь
- Отпустил → возврат в Idle

**Scared** — резкое движение курсора.
- Trigger: скорость курсора > threshold (например 500px/s)
- Кот шарахается в сторону (быстрый dash в противоположном направлении)
- "!!" expression над головой
- 2s pause → возврат в Idle

---

## Функции которые нужно написать

**Renderer**
- `PetRenderer.init(container)` — создаёт Shadow DOM, вставляет sprite
- `PetRenderer.setState(state)` — меняет CSS-класс для анимации
- `PetRenderer.moveTo(x, y, duration)` — smooth transition через `transform: translate3d`
- `PetRenderer.playParticle(type)` — hearts, zzz, exclamation

**Behavior FSM**
- `BehaviorFSM.transition(newState)` — всё роутится через него, логирует переходы
- `BehaviorFSM.tick()` — вызывается каждый frame через rAF
- `BehaviorFSM.handleMouseMove(x, y, velocity)` — обрабатывает курсор
- `BehaviorFSM.handleClick(type, target)` — left/right, на кота/на область
- `BehaviorFSM.handleFoodPlaced(x, y)` — кот "видит" еду

**State (в service worker)**
- `PetState.get()` / `PetState.save()` — через `chrome.storage.local`
- `PetState.tick(deltaMs)` — каждые 5 минут уменьшает hunger/energy
- `PetState.broadcast()` — рассылает состояние всем вкладкам

**Sprite system**
- Один sprite sheet, CSS `background-position` + `steps()` для каждого state
- `SpriteMap` — объект: `{ idle: {x,y,frames,fps}, walk: {…}, … }`

---

## Приоритет реализации (в порядке "сначала это")

1. Idle + Wander + Edge bump → это Hello World
2. Follow cursor → самое эффектное, сразу показывает что расширение живое
3. React (happy) → feedback на клик, обязательно для первого впечатления
4. Eat + Food system → это твой главный "wow" момент для CWS скриншотов
5. Sleep + Stats → retention механика
6. Sit + Groom + Scared → polish, Phase 2