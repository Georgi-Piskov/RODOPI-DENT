# System Instructions: Rodopi Dent PWA Project

**IMPORTANT:** Always read this file before working on the Rodopi Dent project. This file contains project-specific requirements, architecture decisions, and implementation guidelines.

---

## Project Overview

**Rodopi Dent** is a Progressive Web Application (PWA) for a dental clinic with two distinct interfaces:
1. **Public Patient Portal** - Appointment booking system
2. **Admin Portal** - Practice management (calendar, finances, settings)

**Deployment:** GitHub Pages (static hosting)  
**Backend:** n8n workflows (webhooks)  
**Data Storage:** Google Sheets  
**Calendar:** Google Calendar API  
**SMS:** Twilio (native n8n node)  

---

## 1. Technical Stack & Architecture

### Frontend
- **Pure HTML/CSS/JavaScript** (no framework - keep it simple and fast)
- **ES6 modules** for code organization
- **PWA** with service worker (Workbox library)
- **Hash-based routing** (`#/`, `#/booking`, `#/admin`, `#/admin/calendar`, etc.)
- **Mobile-first responsive design**

### Backend (n8n Workflows)
- **Webhook 1:** Public booking (validate, create pending appointment, SMS queue)
- **Webhook 2:** Admin authentication (Google OAuth2 validation)
- **Webhook 3:** Admin calendar operations (CRUD appointments)
- **Webhook 4:** Appointment confirmation/cancellation (with SMS triggers)
- **Webhook 5:** Finance operations (revenue/expense tracking)
- **Webhook 6:** Settings management (work hours, special dates)
- **Webhook 7:** SMS sending (Twilio node integration)

### Data Storage (Google Sheets)

#### Sheet 1: "Procedures"
| Column | Description |
|--------|-------------|
| A: NHIF_Code | Код НЗОК (e.g., "101", "301") |
| B: KSMP_Code | Код КСМП (e.g., "97017-00") |
| C: Description | Описание на български (e.g., "Обстоен преглед със снемане на орален статус") |
| D: Price_EUR | Цена в евро (само евро, без лева) |
| E: Category | Категория за групиране (e.g., "Прегледи", "Обтурации", "Екстракции") |

#### Sheet 2: "Appointments"
| Column | Description |
|--------|-------------|
| A: ID | Unique appointment ID (UUID) |
| B: Patient_Name | Име на пациент |
| C: Patient_Phone | Телефон (+359 format, required) |
| D: Date | Дата (YYYY-MM-DD) |
| E: Start_Time | Начален час (HH:MM format, 24h) |
| F: Duration_Minutes | Продължителност (30, 60, 90, 120, 180 минути) |
| G: Status | "pending" / "confirmed" / "cancelled" / "completed" |
| H: Reason | Причина за визита (optional, от пациент) |
| I: Google_Cal_Event_ID | ID на event от Google Calendar |
| J: Created_At | Timestamp на създаване |
| K: Confirmed_At | Timestamp на потвърждение |
| L: SMS_Sent | Boolean - изпратено ли е SMS |

#### Sheet 3: "Finance"
| Column | Description |
|--------|-------------|
| A: Transaction_ID | Unique ID |
| B: Date | Дата на транзакция |
| C: Appointment_ID | Link към appointment (може да е празно за custom) |
| D: Type | "official" (от ЗК) / "custom" (доплащане) |
| E: Procedure_Code | Код от Procedures sheet (за official) |
| F: Amount_EUR | Сума в евро |
| G: Description | Описание (за custom payments) |
| H: Payment_Method | "cash" / "card" / "bank_transfer" |
| I: Notes | Бележки |

#### Sheet 4: "Settings"
| Column | Description |
|--------|-------------|
| A: Setting_Key | Ключ (e.g., "work_hours_morning_start") |
| B: Setting_Value | Стойност (e.g., "09:00") |
| C: Description | Описание на настройката |

**Default Settings:**
- `work_hours_morning_start`: 09:00
- `work_hours_morning_end`: 12:00
- `work_hours_afternoon_start`: 13:30
- `work_hours_afternoon_end`: 17:00
- `default_slot_duration`: 60 (minutes)
- `working_days`: "1,2,3,4,5" (Mon-Fri, ISO week days)
- `special_dates`: JSON array of {date: "YYYY-MM-DD", type: "open"/"closed"}

---

## 2. Feature Specifications

### 2.1 Public Patient Booking

**Requirements:**
- Anonymous booking (no registration needed)
- **Required fields:** Patient name, phone number (+359 validation)
- **Optional field:** Reason for visit
- **Date selection:** Only allowed dates (working days + special open dates, excluding holidays/closed dates)
- **Time slot selection:** Visual display of available 1-hour slots (9-12, 13:30-17 minus booked)
- **Status:** All new bookings start as "pending" (requires admin confirmation)
- **User feedback:** "Вашата заявка е приета. Ще Ви се обадим за потвърждение на часа."
- **SMS queue:** Create pending SMS (sent after admin confirms)

**Cancellation by Patient:**
- Cancellation link sent via SMS after confirmation
- Can only cancel **until the day before** (not same day)
- Cancellation creates status "cancelled" and frees up time slot
- Sends cancellation SMS notification

**UI/UX:**
- Mobile-first design
- Large touch targets for date/time selection
- Clear visual distinction between available/booked slots
- Loading states for all async operations
- Error messages in Bulgarian

### 2.2 Admin Authentication

**Method:** Google OAuth2 (admin must have Google account)

**Flow:**
1. Login page with "Sign in with Google" button
2. OAuth2 flow via n8n webhook validation
3. Store JWT token in `localStorage`
4. Redirect to admin dashboard

**PWA Install Prompt:**
- Only shown after successful admin authentication
- Capture `beforeinstallprompt` event
- Show custom "Инсталирай приложението" button in admin panel
- Call `deferredPrompt.prompt()` when user clicks

**Security:**
- All admin API calls must include JWT token in headers
- n8n validates token on every request
- Token expiration: 7 days (refresh mechanism)
- Logout clears `localStorage` and redirects to public page

### 2.3 Admin Calendar Management

**Weekly/Daily View:**
- Toggle between week view and day view
- Time grid: 9:00-12:00, 13:30-17:00 (30-min increments)
- Color coding:
  - 🟡 Yellow: Pending (needs confirmation)
  - 🟢 Green: Confirmed
  - 🔴 Red: Cancelled
  - ⚪ Gray: Completed (past appointments)

**Appointment Actions (click on appointment):**
- **Confirm** → Changes status to "confirmed", triggers SMS to patient
- **Cancel** → Changes status to "cancelled", frees slot, triggers cancellation SMS
- **Change Duration** → Dropdown (30min / 1h / 1.5h / 2h / 3h), re-validates slot availability
- **Add Revenue** → Opens revenue entry modal (see Finance section)
- **Edit Details** → Modify patient name, phone, reason
- **Drag to Reschedule** → Drag-and-drop to different time slot (validates availability)

**Quick Add Appointment:**
- Click on empty slot → Quick add modal
- Auto-complete for returning patients (search by name/phone)
- Default duration: 1 hour (adjustable dropdown)
- Status: Auto-confirmed (admin-created appointments skip pending state)
- Optional SMS notification toggle

**Offline Support:**
- All actions queue in IndexedDB if offline
- Visual indicator: "⚠️ Offline - Changes will sync when online"
- Background sync when connection restored

### 2.4 Admin Finance Tracking

**Revenue Entry Methods:**

**Method 1: From Appointment (Quick Entry)**
- Click appointment → "Add Revenue" button
- Smart search input with autocomplete:
  - Type to search procedures (Bulgarian description)
  - Grouped by category: "Прегледи", "Обтурации", "Екстракции", "Ендодонтия", "Протези"
  - Shows: Description, NHIF Code, Price in EUR
- Select procedure → Auto-fills amount
- Payment method dropdown (cash/card/bank)
- Optional notes field
- Save → Creates "official" type transaction in Finance sheet

**Method 2: Custom Payment (Manual Entry)**
- "Add Custom Payment" button
- Free-form fields:
  - Amount (EUR)
  - Description (free text)
  - Payment method
  - Optional appointment link
- Save → Creates "custom" type transaction

**Financial Reports:**
- **Daily Summary** - Total revenue for selected day
- **Weekly Summary** - Revenue by day (bar chart)
- **Monthly Summary** - Total + breakdown by type (official vs custom)
- **Filter Options:**
  - Date range
  - Payment method
  - Transaction type
- **Export to CSV** - Download report

**Expenses Tracking:** (Future feature - placeholder for now)

### 2.5 Admin Settings Management

**Work Hours Configuration:**
- Morning shift: Start time, End time (default 9:00-12:00)
- Afternoon shift: Start time, End time (default 13:30-17:00)
- Break duration calculation (auto-calculated)

**Working Days:**
- Checkboxes for Mon-Fri (default all checked)
- Saturday/Sunday unchecked by default

**Special Dates Calendar:**
- Visual calendar interface (month view)
- Click date → Toggle:
  - 🟢 **Open** (work on normally closed day, e.g., Saturday)
  - 🔴 **Closed** (holiday/vacation on normally working day)
  - ⚪ **Default** (follows working_days setting)
- Saves to Settings sheet as JSON array

**Default Slot Duration:**
- Radio buttons: 30 min / 1 hour (default) / 1.5 hours
- Affects new appointment creation (can be overridden per appointment)

**Save Button:**
- Validates settings
- Updates Google Sheets
- Clears calendar cache (forces reload of available slots)
- Success toast notification

### 2.6 SMS Notifications

**Provider:** Twilio (native n8n node)

**SMS Templates:**

**1. Appointment Confirmation (after admin confirms)**
```
Здравейте, [Patient_Name]!

Вашият час при д-р [Doctor_Name] е потвърден:
📅 Дата: [Date_BG_Format]
🕐 Час: [Start_Time]

За отказ: [Cancellation_Link]

Родопи Дент
[Clinic_Phone]
```

**2. Appointment Cancellation (from admin or patient)**
```
Здравейте, [Patient_Name]!

Вашият час на [Date] от [Time] е отменен.

За нова резервация: [Booking_Link]

Родопи Дент
[Clinic_Phone]
```

**3. Appointment Reminder (1 day before - optional future feature)**
```
Здравейте, [Patient_Name]!

Утре имате час при д-р [Doctor_Name]:
🕐 Час: [Start_Time]

Родопи Дент
[Clinic_Phone]
```

**SMS Rules:**
- Only send to Bulgarian numbers (+359)
- Validate phone number format before queuing
- Retry logic in n8n (3 attempts with exponential backoff)
- Log all SMS in separate sheet for audit (optional)

---

## 3. Offline Functionality

### Service Worker Strategy (Workbox)

**Cache Strategies:**
- **App Shell** (HTML, CSS, main JS): `CacheFirst` with precaching
- **Assets** (images, icons, fonts): `CacheFirst` with long TTL
- **n8n API Calls**: `NetworkFirst` with 5-second timeout fallback to cache
- **Google Sheets Data**: `NetworkFirst` with IndexedDB cache

**Offline Queue:**
- Write operations (create/update/delete) stored in IndexedDB queue
- Background Sync API for automatic retry when online
- Visual queue indicator in admin UI: "📤 3 pending changes"
- Manual "Sync Now" button

**Offline Capabilities:**
- ✅ View existing appointments (from cache)
- ✅ View patient list (from cache)
- ✅ Create new appointments (queued)
- ✅ Modify appointments (queued)
- ✅ Add revenue entries (queued)
- ❌ Real-time availability check (requires network)
- ❌ SMS sending (requires network)

---

## 4. Development Guidelines

### Code Style
- **Language:** All code, comments, variable names in English
- **UI Text:** All user-facing text in Bulgarian (stored in i18n object)
- **File Structure:**
  ```
  /
  ├── index.html (app shell)
  ├── manifest.json (PWA manifest)
  ├── sw.js (service worker)
  ├── css/
  │   ├── main.css (global styles)
  │   ├── booking.css (public booking)
  │   └── admin.css (admin panel)
  ├── js/
  │   ├── app.js (main app logic, router)
  │   ├── api.js (n8n API client)
  │   ├── auth.js (OAuth2 + token management)
  │   ├── calendar.js (calendar UI logic)
  │   ├── finance.js (finance tracking)
  │   ├── offline.js (IndexedDB queue, sync)
  │   └── utils.js (helpers, validation)
  ├── pages/
  │   ├── booking.html (patient booking template)
  │   ├── admin-dashboard.html
  │   ├── admin-calendar.html
  │   └── admin-finance.html
  └── assets/
      ├── logo.png (clinic logo)
      └── icons/ (PWA icons)
  ```

### Naming Conventions
- **CSS Classes:** BEM methodology (e.g., `.booking-calendar__slot--available`)
- **JavaScript:** camelCase for variables/functions, PascalCase for classes
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

### n8n Workflow Naming
- Descriptive names: "RODOPI - Public Booking Webhook"
- Prefix all workflows with "RODOPI -"
- Use clear node names in English
- Add notes to complex nodes

### Error Handling
- All async operations in try-catch blocks
- User-friendly error messages in Bulgarian
- Technical errors logged to console
- Graceful degradation (show cached data if API fails)

### Testing Checklist (before each push)
- ✅ Test public booking flow (mobile + desktop)
- ✅ Test admin authentication
- ✅ Test appointment CRUD operations
- ✅ Test offline mode (DevTools network throttling)
- ✅ Test PWA install prompt (admin only)
- ✅ Validate Google Sheets data integrity
- ✅ Check console for errors

---

## 5. n8n Workflow Implementation Notes

**Before creating any n8n workflow, check the `github_mcp_README.md` file for n8n MCP tool usage.**

### Webhook Security
- Use `authentication: headerAuth` for admin webhooks
- Validate JWT token in first node of admin workflows
- Public booking webhook: Rate limiting (max 10 requests/minute per IP)

### Google Calendar Integration
- Use native n8n Google Calendar node (OAuth2)
- Scopes needed: `calendar.events`, `calendar`
- Event properties:
  - `summary`: Patient name
  - `description`: Reason + phone
  - `start`/`end`: From appointment time + duration
  - `transparency`: "tentative" for pending, "opaque" for confirmed

### Google Sheets Integration
- Use native n8n Google Sheets node v2
- Operations:
  - `append`: New appointments, finance entries
  - `update`: Status changes, confirmations
  - `read`: Data retrieval for UI
  - `appendOrUpdate`: Upsert with key column
- Use batch operations where possible (reduce API calls)

### Twilio SMS Integration
- Use native n8n Twilio node
- Set up credentials with Account SID + Auth Token
- From number: Twilio phone number (must be verified for Bulgaria)
- Error handling: Log failed SMS to separate sheet

---

## 6. Deployment & Updates

### GitHub Pages Setup
1. Push all code to `main` branch
2. Go to repo Settings → Pages
3. Source: Deploy from `main` branch, root folder
4. Custom domain (optional): `rodopident.bg` or similar
5. Enforce HTTPS (GitHub provides SSL)

### Update Workflow
1. Develop locally
2. Test offline functionality (service worker)
3. Commit with descriptive message (in English)
4. Push to GitHub: `git push origin main`
5. Wait 1-2 minutes for GitHub Pages rebuild
6. Test live site
7. Clear service worker cache if needed

### Version Management
- Update version number in `manifest.json` on each deployment
- Service worker will auto-update on next page load

---

## 7. Future Enhancements (Phase 2)

- Appointment reminder SMS (1 day before)
- Patient profiles (returning patient data)
- Expense tracking module
- Multi-doctor support (multiple calendars)
- Advanced reporting (charts, trends)
- Backup/export all data functionality
- WhatsApp integration (in addition to SMS)

---

## 8. Important Reminders

1. **Always answer in Bulgarian when user writes in Bulgarian**
2. **Code and comments always in English**
3. **Test offline mode frequently** (service worker can cause caching issues during development)
4. **Validate phone numbers** (+359 format, 9 digits after code)
5. **All times in 24-hour format** (HH:MM)
6. **Amounts always in EUR** (no BGN in data)
7. **Status transitions:** pending → confirmed → completed (or cancelled at any point)
8. **Never hard-code n8n webhook URLs** (use environment/config file)
9. **SMS costs money** - implement rate limiting and validation
10. **Google API quotas** - batch operations, cache aggressively

---

## 9. Contact & Support Information

**Clinic Name:** Родопи Дент  
**Doctor Name:** [To be provided]  
**Clinic Phone:** [To be provided]  
**Clinic Address:** [To be provided]  
**Working Hours:** Mon-Fri, 9:00-12:00 and 13:30-17:00  

**Developer Notes:**
- Project started: January 12, 2026
- Primary developer: GitHub Copilot (Claude Sonnet 4.5)
- Repository: https://github.com/Georgi-Piskov/RODOPI-DENT

---

**END OF SYSTEM INSTRUCTIONS**

When working on this project, always refer back to this document for clarification on features, architecture, and implementation details. Follow the guidelines strictly to maintain consistency and quality.
