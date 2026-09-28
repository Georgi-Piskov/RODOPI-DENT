# n8n Workflows за Родопи Дент

## 📋 Списък с workflows

| Файл | Endpoint | Метод | Описание |
|------|----------|-------|----------|
| `01-slots-webhook.json` | `/webhook/slots-webhook` | GET | ⚠️ DEPRECATED - използвай 15 |
| `02-booking-webhook.json` | `/webhook/booking-webhook` | POST | ⚠️ DEPRECATED - използвай 16 |
| `03-appointments-webhook.json` | `/webhook/appointments-webhook` | GET | Връща списък записи |
| `04-confirm-webhook.json` | `/webhook/confirm-webhook` | POST | Потвърждава с продължителност + SMS |
| `05-settings-webhook.json` | `/webhook/settings-webhook` | GET/POST | Настройки на системата |
| `06a-finance-get.json` | `/webhook/finance-webhook` | GET | Чете финансови записи |
| `06b-finance-add.json` | `/webhook/finance-add` | POST | Добавя финансов запис |
| `07-daily-backup.json` | - | Schedule | Ежедневен backup в 23:00 |
| `08-expire-pending.json` | - | Schedule 30м | Изтича pending след 2 часа |
| `09-telegram-notify-booking.json` | `/webhook/booking-webhook` | POST | ⚠️ DEPRECATED - използвай 16 |
| `10-telegram-callback.json` | - | Telegram Trigger | Обработва бутони от Telegram |
| `11-calendar-events.json` | `/webhook/calendar-events` | GET | 📅 Календар - чете събития |
| `12-calendar-create.json` | `/webhook/calendar-create` | POST | 📅 Календар - създава събитие |
| `13-calendar-update.json` | `/webhook/calendar-update` | PUT | 📅 Календар - обновява събитие |
| `14-calendar-delete.json` | `/webhook/calendar-delete` | DELETE | 📅 Календар - изтрива събитие |
| `15-public-slots.json` | `/webhook/public-slots` | GET | ✅ **АКТИВЕН** - свободни часове от Calendar |
| `16-public-booking.json` | `/webhook/public-booking` | POST | ✅ **АКТИВЕН** - резервация в Calendar + Telegram |

---

## 🚀 Инструкции за импортиране

### 1. Отвори n8n
Отиди на: https://n8n.simeontsvetanovn8nworkflows.site

### 2. Импортирай всеки workflow

1. Натисни **+ New Workflow**
2. Натисни **⋯** → **Import from File**
3. Избери JSON файл от тази папка
4. Натисни **Save**
5. **Активирай** workflow-а (toggle вдясно)

### 3. Настрой credentials

Трябва да свържеш:

#### Google Calendar (ЗАДЪЛЖИТЕЛНО!)
1. Settings → Credentials → Add Credential
2. Избери "Google Calendar OAuth2"
3. Свържи с `rodopi.dent@gmail.com`

#### Google Sheets
1. Settings → Credentials → Add Credential
2. Избери "Google Sheets OAuth2"
3. Следвай инструкциите за свързване

#### Google Drive (за backup)
1. Settings → Credentials → Add Credential  
2. Избери "Google Drive OAuth2"
3. Следвай инструкциите

#### Twilio (за SMS)
1. Settings → Credentials → Add Credential
2. Избери "Twilio API"
3. Въведи Account SID, Auth Token и Phone Number

---

## 📡 API Reference

### GET /webhook/slots-webhook
Връща свободни часове за дата. **Автоматично филтрира заетите слотове, включително продължителността на всяка резервация.**

**Query параметри:**
- `date` (required): Дата във формат YYYY-MM-DD

**Пример:**
```
GET /webhook/slots-webhook?date=2026-01-27
```

**Отговор:**
```json
{
  "date": "2026-01-27",
  "slots": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
  "totalSlots": 13,
  "bookedCount": 2,
  "bookedSlots": [
    { "startTime": "09:30", "duration": 60, "patientName": "Иван" }
  ]
}
```

---

### POST /webhook/booking-webhook
Създава нова резервация. **Проверява за конфликти преди записване - не позволява дублиране!**

**Body:**
```json
{
  "patientName": "Иван Петров",
  "patientPhone": "0888123456",
  "date": "2026-01-27",
  "startTime": "09:00",
  "duration": 30,
  "reason": "Преглед"
}
```

**Успешен отговор (200):**
```json
{
  "success": true,
  "message": "Часът е успешно запазен!",
  "appointmentId": "apt_abc123",
  "date": "2026-01-27",
  "time": "09:00"
}
```

**Конфликт (409):**
```json
{
  "success": false,
  "error": "Този час е вече зает (конфликт с 09:00)"
}
```

---

### GET /webhook/appointments-webhook
Връща списък с записи.

**Query параметри:**
- `date`: Филтър по дата
- `status`: Филтър по статус (pending/confirmed/completed/cancelled)
- `startDate` + `endDate`: Филтър по период

**Пример:**
```
GET /webhook/appointments-webhook?date=2026-01-27
```

---

### POST /webhook/confirm-webhook
Обновява статус на запис.

**Body:**
```json
{
  "appointmentId": "apt_abc123",
  "status": "confirmed"
}
```

---

### GET/POST /webhook/settings-webhook

**GET** - Връща всички настройки
**POST** - Обновява настройки

---

### GET/POST /webhook/finance-webhook

**GET Query параметри:**
- `startDate` + `endDate`: Период
- `type`: official/custom

**POST Body:**
```json
{
  "date": "2026-01-27",
  "type": "official",
  "amount": 45.00,
  "description": "Преглед",
  "paymentMethod": "cash"
}
```

---

## ⚠️ Важни бележки

1. **Google Sheets ID** е хардкоднат във всеки workflow:
   `1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g`

2. **CORS** е настроен да позволява всички origins (`*`)

3. **SMS изпращането** ще работи само след настройка на Twilio credentials

4. **Backup workflow** изисква папка в Google Drive - трябва да въведеш Folder ID

---

## Patients sheet: upsert + recovery (fix, 2026-09)

**Problem:** `22-patients-upsert` used IF nodes in the old v1 condition format on IF v2,
which n8n evaluates as an empty filter (always true). Every request went to
"Respond Invalid", so nothing was written to `Patients` after the one-off backfill
(all rows have `createdAt = 2026-02-18`). In addition, existing patients were never
updated, `13-calendar-update` did not sync patients at all, and request bodies were
built by string interpolation (quotes in a name broke the JSON).

**Fixed workflows** (re-import all of them, then select the Google Sheets / Calendar credentials):

| File | Change |
|------|--------|
| `22-patients-upsert.json` | Real upsert: same name + phone → skip; same name with new/missing phone → update row; same phone + other name → new row (family); name-only rows allowed |
| `12-calendar-create.json` | Saves patient before responding (blocks skipped), safe JSON body, returns `patientSaved` |
| `13-calendar-update.json` | Now also saves the patient (phone from form or event description) |
| `16-public-booking.json` | Safe JSON body; a Patients-sheet error never blocks the booking |
| `23-patients-backfill.json` | Recovery from Google Calendar with a dry run (see below) |

**Recovery (`23-patients-backfill.json`):**
1. Duplicate the `Patients` tab in Google Sheets as a backup.
2. Import the workflow, set credentials, click *Execute workflow*.
   `DRY_RUN = true` (top of the "Plan Changes" node) only shows a report: who will be added and whose phone will change.
3. Review the report, set `DRY_RUN = false`, execute again.
