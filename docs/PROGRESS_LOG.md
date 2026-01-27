# 📋 Дневник на разработката - Родопи Дент

## 🗓️ Сесия: 27 Януари 2026

### ✅ Завършени задачи

---

## 1. Google Calendar интеграция

**Цел:** Google Calendar да е основен източник на данни (Google Sheets остава като backup)

### Създадени n8n workflows:

| Workflow | Файл | Описание |
|----------|------|----------|
| 11 | `n8n-workflows/11-calendar-events.json` | GET събития от календара |
| 12 | `n8n-workflows/12-calendar-create.json` | CREATE ново събитие |
| 13 | `n8n-workflows/13-calendar-update.json` | UPDATE съществуващо събитие |
| 14 | `n8n-workflows/14-calendar-delete.json` | DELETE събитие |

**Calendar ID:** `rodopi.dent@gmail.com`

### Endpoints:
- `GET /webhook/calendar-events?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `POST /webhook/calendar-create`
- `PUT /webhook/calendar-update`
- `DELETE /webhook/calendar-delete?eventId=xxx`

---

## 2. Календар UI модул

### Създадени/модифицирани файлове:

**js/calendar.js** - Нов модул за календарен изглед:
- `renderDayView()` - Дневен изглед
- `renderWeekView()` - Седмичен изглед  
- `renderMonthView()` - Месечен изглед
- `calculateEventLayout()` - Алгоритъм за side-by-side показване на припокриващи се събития
- `getToday()` - Връща днешна дата в локално време

**js/api.js** - Добавени функции:
- `getCalendarEvents(start, end)`
- `createCalendarEvent(event)`
- `updateCalendarEvent(event)`
- `deleteCalendarEvent(eventId)`

**js/config.js** - Добавени endpoints:
```javascript
CALENDAR_EVENTS: `${WEBHOOK_BASE}/calendar-events`,
CALENDAR_CREATE: `${WEBHOOK_BASE}/calendar-create`,
CALENDAR_UPDATE: `${WEBHOOK_BASE}/calendar-update`,
CALENDAR_DELETE: `${WEBHOOK_BASE}/calendar-delete`
```

**css/main.css** - Добавени стилове за:
- Time grid (времева мрежа)
- Week header с weekend стилове
- Event cards с цветово кодиране по статус
- Overlap handling (side-by-side събития)

---

## 3. Фиксове на проблеми

### Проблем 1: "Днес" не се разпознава правилно
**Причина:** `Utils.formatDate()` използваше `toISOString()` което конвертира към UTC
**Решение:** Променено да използва локални date компоненти:
```javascript
// Преди (грешно - UTC)
return d.toISOString().split('T')[0];

// След (правилно - локално време)
const year = d.getFullYear();
const month = String(d.getMonth() + 1).padStart(2, '0');
const day = String(d.getDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
```

### Проблем 2: Събития се припокриват (stacked on top)
**Причина:** Липсваше алгоритъм за layout на припокриващи се събития
**Решение:** Добавен `calculateEventLayout()`:
- Сортира събития по начален час
- Групира припокриващи се събития
- Присвоява колони на всяко събитие
- Изчислява `width` и `left` в проценти за side-by-side показване

### Проблем 3: Работни часове твърде ограничени
**Решение:** Разширени от 9:00-18:00 на **7:00-19:00**

---

## 4. Навигация и рутиране

- Добавен route `/admin/calendar` в `js/app.js`
- Добавен линк в навигацията на admin панела
- Календарът е достъпен от таблото

---

## ⏳ Чакащи ръчни действия

### 1. Google Calendar OAuth в n8n
```
1. Отвори n8n → Credentials
2. Създай нов: Google Calendar OAuth2 API
3. Свържи rodopi.dent@gmail.com акаунт
4. Провери redirect URI в Google Cloud Console:
   https://n8n.simeontsvetanovn8nworkflows.site/rest/oauth2-credential/callback
```

### 2. Telegram бутони (Workflow 09)
Ръчно добави inline keyboard в Telegram node:
```
Row 1: [30м] [45м]     callback: confirm_30_{{$json.id}}, confirm_45_{{$json.id}}
Row 2: [60м] [90м]     callback: confirm_60_{{$json.id}}, confirm_90_{{$json.id}}
Row 3: [❌ Откажи]     callback: cancel_{{$json.id}}
```

---

## 🏗️ Архитектура на системата

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   PWA Frontend  │────▶│   n8n Webhooks  │────▶│ Google Calendar  │
│  (GitHub Pages) │     │  (Self-hosted)  │     │    (Primary)     │
└─────────────────┘     └────────┬────────┘     └──────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐     ┌──────────────────┐
                        │  Telegram Bot   │     │  Google Sheets   │
                        │  (Notifications)│     │    (Backup)      │
                        └─────────────────┘     └──────────────────┘
```

---

## 📁 Структура на проекта

```
RODOPI DENT-system/
├── index.html              # Основен HTML
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── css/
│   └── main.css           # Всички стилове
├── js/
│   ├── app.js             # Главен модул, рутиране
│   ├── api.js             # API заявки
│   ├── config.js          # Конфигурация
│   ├── utils.js           # Помощни функции
│   ├── calendar.js        # 📅 Календар модул (НОВ)
│   └── components/        # UI компоненти
├── n8n-workflows/
│   ├── 01-*.json ... 10-*.json  # Основни workflows
│   ├── 11-calendar-events.json  # Calendar GET
│   ├── 12-calendar-create.json  # Calendar CREATE
│   ├── 13-calendar-update.json  # Calendar UPDATE
│   └── 14-calendar-delete.json  # Calendar DELETE
└── docs/
    ├── google-sheets-setup.js   # Apps Script за setup
    ├── import-nhif-prices.js    # НЗОК ценоразпис
    ├── telegram-bot-setup.md    # Telegram инструкции
    └── PROGRESS_LOG.md          # Този файл
```

---

## 🔗 Важни линкове

| Ресурс | URL |
|--------|-----|
| PWA | https://simontsv.github.io/rodopi-dent/ |
| n8n | https://n8n.simeontsvetanovn8nworkflows.site |
| Google Sheets | ID: 1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g |
| GitHub Repo | github.com/simontsv/rodopi-dent |

---

## 📝 Бележки за следваща сесия

1. Тествай календара след OAuth конфигурация
2. Провери дали днес (27-ми) е подчертан правилно
3. Провери дали събития се показват side-by-side
4. Добави Telegram бутони ръчно
5. Тествай пълния flow: PWA → n8n → Calendar → Telegram

---

*Последна актуализация: 27 Януари 2026*
