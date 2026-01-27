# RODOPI-DENT
Dental clinic website with appointment booking system - GitHub Pages deployment

## 🦷 Родопи Дент - Зъболекарска Практика

PWA уеб приложение за зъболекарска практика с онлайн запазване на часове.

### Функционалности

- 📅 **Онлайн запазване на часове** - пациентите могат да запазват часове директно от сайта
- 📆 **Google Calendar интеграция** - пълен календар с изгледи: ден, седмица, месец
- 💬 **Telegram уведомления** - известия за нови записи с бутони за потвърждение
- 📱 **SMS потвърждения** - автоматични SMS съобщения към пациенти
- 💰 **Финансов модул** - следене на приходи и разходи
- 🔒 **Google OAuth** - сигурен вход за администраторски панел

### Технологии

- **Frontend**: Vanilla JavaScript PWA
- **Backend**: n8n workflow автоматизация
- **Database**: Google Sheets (backup) + Google Calendar (primary)
- **Hosting**: GitHub Pages

---

## ⚙️ Конфигурация

### 1. Google Calendar в n8n

За да работи Google Calendar интеграцията, трябва да конфигурирате Google Calendar OAuth2 credentials в n8n:

1. **Отворете n8n** → Credentials → Add Credential
2. **Изберете** "Google Calendar OAuth2 API"
3. **Въведете**:
   - Client ID: От Google Cloud Console
   - Client Secret: От Google Cloud Console
4. **Свържете акаунта** `rodopi.dent@gmail.com`
5. **Импортирайте workflows**:
   - `n8n-workflows/11-calendar-events.json`
   - `n8n-workflows/12-calendar-create.json`
   - `n8n-workflows/13-calendar-update.json`
   - `n8n-workflows/14-calendar-delete.json`
6. **Актуализирайте credentials** във всеки workflow

### 2. Telegram Bot (Опционално)

Workflow 09 изисква ръчна конфигурация на inline keyboard бутони:

1. Отворете **09-telegram-notify-booking.json** в n8n
2. Редактирайте **Notify Doctor Telegram** нода
3. Добавете **Reply Markup** → **Inline Keyboard**:
   - Ред 1: `30м | confirm_30_{{ $json.id }}`, `45м | confirm_45_{{ $json.id }}`
   - Ред 2: `60м | confirm_60_{{ $json.id }}`, `90м | confirm_90_{{ $json.id }}`
   - Ред 3: `❌ Откажи | cancel_{{ $json.id }}`

---

## 🔗 Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/calendar-events` | GET | Извличане на събития от Google Calendar |
| `/calendar-create` | POST | Създаване на ново събитие |
| `/calendar-update` | POST | Редактиране на събитие |
| `/calendar-delete` | POST | Изтриване на събитие |

---

## 📁 Структура

```
├── css/
│   └── main.css          # Стилове включително calendar view
├── js/
│   ├── api.js            # API клиент
│   ├── app.js            # Основно приложение
│   ├── calendar.js       # Google Calendar модул
│   ├── config.js         # Конфигурация
│   └── ...
├── n8n-workflows/        # n8n workflow JSON файлове
│   ├── 11-calendar-events.json
│   ├── 12-calendar-create.json
│   ├── 13-calendar-update.json
│   └── 14-calendar-delete.json
└── index.html            # PWA входна точка
```

---

## 🚀 Деплоймент

Сайтът се хоства на GitHub Pages: https://georgi-piskov.github.io/RODOPI-DENT/
