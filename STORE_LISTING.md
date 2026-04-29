# Chrome Web Store — Deployment Guide

Полный пошаговый гайд по публикации Cattab в Chrome Web Store.

---

## 0. Перед публикацией — чеклист

```bash
# Проверка типов — должно быть 0 ошибок
npm run typecheck

# Линтер — должно быть 0 ошибок
npm run lint

# Собрать dist/ и упаковать в cattab-1.0.0.zip
npm run zip
```

Проверь что версия в двух местах совпадает:
- `package.json` → `"version": "1.0.0"`
- `public/manifest.json` → `"version": "1.0.0"`

---

## 1. Регистрация аккаунта разработчика

1. Открой: https://chrome.google.com/webstore/devconsole
2. Войди в Google аккаунт (лучше создать отдельный для проекта)
3. Заплати **$5 одноразово** — это регистрационный взнос, платится один раз навсегда
4. Прими Developer Agreement

---

## 2. Создание нового расширения

В Developer Dashboard нажми **"New item"** → загрузи ZIP-файл `cattab-1.0.0.zip`.

После загрузки Chrome распознает manifest и подставит базовые поля.

---

## 3. Store Listing — все поля

### Название (Name)
```
Cattab — Pixel Cat Pet
```
> Максимум 45 символов. Бренд + ключевые слова для поиска.

### Краткое описание (Short description)
```
Your pixel art cat companion that lives on every webpage. Walks, eats, plays — always with you.
```
> Максимум 132 символа. Показывается под иконкой в результатах поиска.

### Подробное описание (Detailed description)
```
Meet Cheeto — your personal pixel art cat that lives right in your browser.

🐱 Cheeto wanders across every webpage, follows your cursor, and reacts to everything you do. Left-click to get a heart reaction. Right-click to feed, play, put to sleep, or pin him anywhere on screen.

🐟 Drop food with a right-click on any page and watch him run to eat it. The hungrier he gets, the more excited he is when food appears.

✨ Features:
• Fully animated 8-direction pixel art character
• Hunger, happiness, and energy stats that change over time
• Three behavior modes: Auto, Follow, Wander
• Right-click pet menu: Sleep / Wake, Play, Pin, Hide on site
• Lives on one tab at a time — no resource waste
• Shadow DOM isolation — never breaks page layouts
• Works on almost every site (not Chrome system pages)

Cheeto remembers his stats between sessions. Keep him fed and happy!
```

### Категория (Category)
**Fun** (или "Lifestyle" — оба подходят, Fun даёт больше органики)

### Язык (Language)
**English**

---

## 4. Иконки и медиа

### Иконка расширения (Extension icon)
Уже сгенерирована: `public/assets/icons/icon128.png`
Chrome подхватит её автоматически из manifest.

### Store icon (отдельно от manifest)
Нужна **128×128 PNG** — та же `icon128.png` подходит.

### Скриншоты (Screenshots) — ОБЯЗАТЕЛЬНО
Нужно минимум **1**, рекомендуется **3–5**.
Размер: **1280×800** или **640×400** пикселей, PNG или JPEG.

**Что снять:**
1. Кот идёт по популярному сайту (GitHub или Reddit) — главный скрин
2. Кот ест рыбу (контекстное меню → "Feed cat here")
3. Попап с статами (Hunger / Happiness / Energy заполнены)
4. Правый клик на коте — меню (Sleep, Play, Pin)
5. Кот рядом с курсором (режим Follow)

**Как снять:**
- Загрузи `dist/` через `chrome://extensions` → Developer Mode → Load unpacked
- Открой любой сайт, дай коту побегать
- Используй встроенный скриншот Chrome или macOS `Cmd+Shift+4`
- Размер можно подогнать в Figma/Preview если нужно точно 1280×800

### Promotional tile (необязательно, но сильно помогает)
- Small: **440×280** PNG — баннер с котом и названием
- Large: **920×680** PNG — для Featured секции (если попадёшь)

---

## 5. Privacy

### Privacy policy URL (ОБЯЗАТЕЛЬНО)
Chrome Web Store **требует** ссылку на политику конфиденциальности если расширение работает на всех сайтах (`<all_urls>`).

**Вариант 1 — GitHub Pages (бесплатно):**
1. Создай репо `cattab-privacy` на GitHub
2. Создай файл `index.html` с текстом ниже
3. Включи GitHub Pages в Settings → Pages → Deploy from main
4. Ссылка будет: `https://[твой-github].github.io/cattab-privacy/`

**Текст политики (вставь в HTML):**
```
Cattab Privacy Policy

Cattab does not collect, transmit, or share any personal data.

All data (pet stats, site blocklist, settings) is stored locally in your browser
using chrome.storage.local and never leaves your device.

Cattab does not make any network requests. It has no servers, no analytics,
no tracking, and no third-party integrations.

The extension requires access to all pages solely to display the animated pet
on top of web content using a Shadow DOM overlay. Page content is never read,
stored, or transmitted.

Last updated: April 2026
Contact: [твой email]
```

**Вариант 2 — Notion:** создай публичную страницу, скопируй ссылку.

### Single purpose description
```
Displays an animated pixel art cat companion on web pages.
```

### Permissions justification (Chrome может попросить объяснить)

| Permission | Обоснование |
|---|---|
| `storage` | Saves pet stats (hunger, happiness, energy) and user settings locally |
| `alarms` | Ticks stats every few minutes while browser is open |
| `contextMenus` | Adds "Feed cat here" to the right-click page menu |
| `activeTab` | Identifies which tab should show the cat (single-tab rule) |
| `tabs` | Reads current tab URL to show/hide the cat based on blocklist |

---

## 6. Distribution & Visibility

- **Visibility:** Public
- **Distribution:** All regions (или убери страны где может быть проблема с маркетплейсом)
- **Maturity:** General audience

---

## 7. Pricing

**Free** — расширение бесплатное.

---

## 8. Подача на ревью

1. Нажми **Save Draft** → проверь все поля
2. Нажми **Submit for Review**
3. Ревью занимает **1–7 рабочих дней** (обычно 1–3 для новых расширений без красных флагов)
4. Придёт письмо на почту аккаунта

**Частые причины отклонения:**
- Нет privacy policy URL
- Скриншоты неправильного размера или размытые
- Описание не соответствует функциям
- Permissions не обоснованы

---

## 9. После публикации

### URL расширения
Будет вида: `https://chromewebstore.google.com/detail/cattab/[ID]`
ID выдаётся при первом сабмите и не меняется.

### Обновление версии
```bash
# 1. Поменяй версию в обоих файлах:
#    package.json → "version": "1.0.1"
#    public/manifest.json → "version": "1.0.1"

# 2. Собери и запакуй:
npm run zip

# 3. В Developer Dashboard → нажми "Upload new package" → загрузи новый ZIP
# 4. Submit for Review (обновления ревьюятся быстрее — обычно несколько часов)
```

### Метрики в Dashboard
- **Weekly Active Users (WAU)** — цель 1000 к August 2026
- **Ratings** — отвечай на отзывы, это влияет на ранжирование
- **Crashes** — Chrome показывает если контент-скрипт падает на популярных сайтах

---

## 10. Быстрый старт — команды

```bash
# Собрать и создать ZIP для загрузки:
npm run zip
# → создаёт cattab-1.0.0.zip в корне проекта

# Проверить перед публикацией:
npm run typecheck && npm run lint

# Загрузить для локального теста:
# chrome://extensions → Developer Mode → Load unpacked → выбери dist/
```
