# n8n Workflows - Родопи Дент

## Списък на workflows

| # | Файл | Описание | Webhook Path |
|---|------|----------|--------------|
| 1 | `01-get-available-slots.json` | Взима свободните часове за дата | GET `/slots?date=YYYY-MM-DD` |
| 2 | `02-create-booking.json` | Създава нова заявка за час | POST `/booking` |
| 3 | `03-confirm-appointment.json` | Потвърждава час (админ) | POST `/appointment/confirm` |
| 4 | `04-get-appointments.json` | Списък с часове | GET `/appointments` |
| 5 | `05-finance-operations.json` | Финансови операции | GET/POST `/finance` |
| 6 | `06-procedures.json` | Списък с процедури | GET `/procedures` |
| 7 | `07-settings.json` | Настройки | GET/POST `/settings` |

---

## Инструкции за импортиране в n8n

### 1. Отворете n8n
Влезте във вашата n8n инсталация.

### 2. Импортирайте workflow
1. Кликнете **Workflows** → **Add workflow** → **Import from file**
2. Изберете JSON файла
3. Кликнете **Import**

### 3. Настройте credentials

#### Google Sheets
1. Отворете workflow
2. Кликнете на Google Sheets node
3. В **Credential to connect with** изберете/създайте Google Sheets credential
4. Уверете се, че Sheet ID е правилен: `1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g`

#### Twilio (за SMS)
1. Кликнете на Twilio node
2. Добавете Twilio credentials (Account SID, Auth Token)
3. Настройте **From** номер (вашия Twilio номер)

#### Google Calendar
1. Кликнете на Google Calendar node
2. Добавете Google OAuth2 credentials
3. Изберете правилния календар

### 4. Активирайте webhook
1. Кликнете на Webhook node
2. В **Webhook URLs** ще видите Production URL
3. Копирайте този URL за конфигурация на фронтенда

### 5. Активирайте workflow
Кликнете **Active** toggle в горния десен ъгъл.

---

## API Endpoints

След активиране, вашите endpoints ще бъдат:

```
https://your-n8n-instance.com/webhook/slots
https://your-n8n-instance.com/webhook/booking
https://your-n8n-instance.com/webhook/appointment/confirm
https://your-n8n-instance.com/webhook/appointments
https://your-n8n-instance.com/webhook/finance
https://your-n8n-instance.com/webhook/procedures
https://your-n8n-instance.com/webhook/settings
```

---

## Конфигурация на фронтенда

Обновете `js/config.js` с вашите n8n webhook URLs:

```javascript
const CONFIG = {
  API: {
    BASE_URL: 'https://your-n8n-instance.com/webhook',
    ENDPOINTS: {
      SLOTS: '/slots',
      BOOKING: '/booking',
      APPOINTMENTS: '/appointments',
      // ... etc
    }
  }
};
```

---

## Тестване

### Тест: Свободни часове
```bash
curl "https://your-n8n-instance.com/webhook/slots?date=2026-01-15"
```

### Тест: Създаване на час
```bash
curl -X POST "https://your-n8n-instance.com/webhook/booking" \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Тест Пациент",
    "patientPhone": "+359888123456",
    "date": "2026-01-15",
    "time": "10:00",
    "duration": 60
  }'
```

---

## Важни забележки

1. **CORS**: Всички webhooks са настроени с `Access-Control-Allow-Origin: *`. За продукция препоръчваме да ограничите до вашия домейн.

2. **Автентикация**: Текущите workflows нямат автентикация. За админ endpoints добавете проверка на JWT token.

3. **Rate Limiting**: Препоръчваме да добавите rate limiting в n8n или на ниво reverse proxy.

4. **Backup**: Редовно правете backup на Google Sheets данните.

5. **Мониторинг**: Използвайте n8n's built-in execution logs за мониторинг.
