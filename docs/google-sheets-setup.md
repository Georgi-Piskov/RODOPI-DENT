# Google Sheets Setup - Родопи Дент

## Sheet ID
`1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g`

---

## Sheet 1: Procedures (Процедури)

| Column | Name | Type | Description |
|--------|------|------|-------------|
| A | NHIF_Code | Text | НЗОК код (D01, D02, etc.) |
| B | KSMP_Code | Text | КСМП код (51101, 51102, etc.) |
| C | Description | Text | Описание на процедурата |
| D | Price_EUR | Number | Цена в EUR |
| E | Category | Text | Категория |

### Примерни данни (от ценоразписа):
```
NHIF_Code | KSMP_Code | Description | Price_EUR | Category
D01 | 51101 | Преглед на зъболекар | 10.00 | Профилактика
D02 | 51102 | Консултация със зъболекар | 10.00 | Профилактика
D04 | 51104 | Почистване на зъбен камък | 10.00 | Профилактика
D05 | 51105 | Почистване на зъбна плака | 5.00 | Профилактика
D13 | 51113 | Фотополимерна пломба | 35.00 | Пломби
D14 | 51114 | Химична пломба амалгама | 20.00 | Пломби
D19 | 51119 | Екстракция на постоянен зъб | 20.00 | Хирургия
D20 | 51120 | Екстракция на млечен зъб | 10.00 | Хирургия
D21 | 51121 | Хирургическа екстракция | 50.00 | Хирургия
D32 | 51132 | Цена на коронка | 200.00 | Протетика
D43 | 51143 | Частична акрилова протеза | 250.00 | Протетика
D45 | 51145 | Цяла акрилова протеза | 350.00 | Протетика
```

---

## Sheet 2: Appointments (Записани часове)

| Column | Name | Type | Description |
|--------|------|------|-------------|
| A | ID | Text | Уникален идентификатор (UUID) |
| B | Patient_Name | Text | Име на пациент |
| C | Patient_Phone | Text | Телефон (+359...) |
| D | Date | Date | Дата (YYYY-MM-DD) |
| E | Start_Time | Text | Начален час (HH:MM) |
| F | Duration_Minutes | Number | Продължителност в минути |
| G | Status | Text | pending/confirmed/completed/cancelled/no-show |
| H | Notes | Text | Бележки |
| I | Created_At | DateTime | Дата на създаване |
| J | Updated_At | DateTime | Дата на последна промяна |
| K | Google_Event_ID | Text | ID от Google Calendar |

### Примерен header ред:
```
ID | Patient_Name | Patient_Phone | Date | Start_Time | Duration_Minutes | Status | Notes | Created_At | Updated_At | Google_Event_ID
```

---

## Sheet 3: Finance (Финанси)

| Column | Name | Type | Description |
|--------|------|------|-------------|
| A | ID | Text | Уникален идентификатор |
| B | Date | Date | Дата на транзакцията |
| C | Type | Text | income/expense |
| D | Amount_EUR | Number | Сума в EUR |
| E | Procedure_Code | Text | КСМП код (ако е приложимо) |
| F | Patient_Name | Text | Име на пациент |
| G | Appointment_ID | Text | Свързан час (ако има) |
| H | Notes | Text | Бележки |
| I | Created_At | DateTime | Дата на създаване |

### Примерен header ред:
```
ID | Date | Type | Amount_EUR | Procedure_Code | Patient_Name | Appointment_ID | Notes | Created_At
```

---

## Sheet 4: Settings (Настройки)

| Column | Name | Type | Description |
|--------|------|------|-------------|
| A | Setting_Key | Text | Ключ на настройката |
| B | Setting_Value | Text | Стойност |
| C | Description | Text | Описание |

### Начални настройки:
```
Setting_Key | Setting_Value | Description
clinic_name | Родопи Дент | Име на клиниката
clinic_phone | | Телефон за контакт
clinic_address | | Адрес на клиниката
doctor_name | | Име на лекаря
morning_start | 09:00 | Начало сутрин
morning_end | 12:00 | Край сутрин
afternoon_start | 13:30 | Начало следобед
afternoon_end | 17:00 | Край следобед
default_duration | 60 | Продължителност по подразбиране (мин)
allow_online_booking | true | Позволяване на онлайн записване
require_confirmation | true | Изискване на потвърждение
sms_enabled | true | SMS нотификации активни
sms_confirmation | true | SMS при потвърждение
sms_reminder | true | SMS напомняне
reminder_hours | 24 | Часове преди за напомняне
```

---

## Инструкции за създаване:

1. Отворете Google Sheets: https://docs.google.com/spreadsheets/d/1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g

2. Създайте 4 sheets с имена:
   - `Procedures`
   - `Appointments`
   - `Finance`
   - `Settings`

3. Добавете header редовете (първи ред) за всеки sheet

4. За Procedures - попълнете данните от ценоразписа

5. За Settings - попълнете началните настройки

---

## Google Sheets API достъп за n8n:

За n8n трябва да:
1. Споделите sheet-а с вашия service account email
2. Или използвате OAuth2 credentials

В n8n използвайте:
- **Google Sheets node** с операция "Append Row" за добавяне
- **Google Sheets node** с операция "Read Rows" за четене
- **Google Sheets node** с операция "Update Row" за промяна
