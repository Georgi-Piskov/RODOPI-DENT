/**
 * Google Apps Script - Родопи Дент Setup
 * 
 * ИНСТРУКЦИИ:
 * 1. Отворете Google Sheets: https://docs.google.com/spreadsheets/d/1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g
 * 2. Extensions → Apps Script
 * 3. Копирайте този код
 * 4. Запазете и стартирайте функцията setupAllSheets()
 * 5. При първо стартиране - дайте permissions
 */

function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create sheets
  setupProceduresSheet(ss);
  setupAppointmentsSheet(ss);
  setupFinanceSheet(ss);
  setupSettingsSheet(ss);
  
  // Delete default Sheet1 if exists
  try {
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);
  } catch(e) {}
  
  SpreadsheetApp.getUi().alert('✅ Всички листове са създадени успешно!');
}

function setupProceduresSheet(ss) {
  let sheet = ss.getSheetByName('Procedures');
  if (!sheet) {
    sheet = ss.insertSheet('Procedures');
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = ['NHIF_Code', 'KSMP_Code', 'Description', 'Price_EUR', 'Category'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4285f4');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  
  // Sample data from NHIF price list
  const data = [
    ['D01', '51101', 'Преглед на зъболекар', 10.00, 'Профилактика'],
    ['D02', '51102', 'Консултация със зъболекар', 10.00, 'Профилактика'],
    ['D04', '51104', 'Почистване на зъбен камък', 10.00, 'Профилактика'],
    ['D05', '51105', 'Почистване на зъбна плака', 5.00, 'Профилактика'],
    ['D06', '51106', 'Профилактика с флуор - деца', 5.00, 'Профилактика'],
    ['D07', '51107', 'Обтурация зъб млечен', 20.00, 'Пломби'],
    ['D13', '51113', 'Фотополимерна пломба', 35.00, 'Пломби'],
    ['D14', '51114', 'Химична пломба амалгама', 20.00, 'Пломби'],
    ['D15', '51115', 'Временна пломба', 10.00, 'Пломби'],
    ['D16', '51116', 'Лечение на пулпит', 30.00, 'Ендодонтия'],
    ['D17', '51117', 'Лечение на периодонтит', 40.00, 'Ендодонтия'],
    ['D18', '51118', 'Ендодонтско лечение', 60.00, 'Ендодонтия'],
    ['D19', '51119', 'Екстракция на постоянен зъб', 20.00, 'Хирургия'],
    ['D20', '51120', 'Екстракция на млечен зъб', 10.00, 'Хирургия'],
    ['D21', '51121', 'Хирургическа екстракция', 50.00, 'Хирургия'],
    ['D22', '51122', 'Оперативно отстраняване на зъб', 80.00, 'Хирургия'],
    ['D32', '51132', 'Металокерамична коронка', 200.00, 'Протетика'],
    ['D33', '51133', 'Циркониева коронка', 350.00, 'Протетика'],
    ['D34', '51134', 'Металокерамичен мост (за зъб)', 200.00, 'Протетика'],
    ['D43', '51143', 'Частична акрилова протеза', 250.00, 'Протетика'],
    ['D44', '51144', 'Частична скелетна протеза', 450.00, 'Протетика'],
    ['D45', '51145', 'Цяла акрилова протеза', 350.00, 'Протетика'],
    ['D50', '51150', 'Почистване пародонтални джобове', 15.00, 'Пародонтология'],
    ['D51', '51151', 'Шиниране на зъби', 80.00, 'Пародонтология'],
    ['', '', 'Избелване на зъби', 150.00, 'Естетика'],
    ['', '', 'Фасета/Венир', 300.00, 'Естетика'],
    ['', '', 'Рентгенова снимка', 10.00, 'Диагностика'],
    ['', '', 'Панорамна рентгенография', 30.00, 'Диагностика']
  ];
  
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  
  // Format
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 120);
  
  // Number format for price
  sheet.getRange(2, 4, data.length, 1).setNumberFormat('#,##0.00');
  
  sheet.setFrozenRows(1);
}

function setupAppointmentsSheet(ss) {
  let sheet = ss.getSheetByName('Appointments');
  if (!sheet) {
    sheet = ss.insertSheet('Appointments');
  } else {
    sheet.clear();
  }
  
  const headers = ['ID', 'Patient_Name', 'Patient_Phone', 'Date', 'Start_Time', 
                   'Duration_Minutes', 'Status', 'Notes', 'Created_At', 'Updated_At', 'Google_Event_ID'];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#34a853');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  
  // Format columns
  sheet.setColumnWidth(1, 150);  // ID
  sheet.setColumnWidth(2, 200);  // Patient_Name
  sheet.setColumnWidth(3, 150);  // Patient_Phone
  sheet.setColumnWidth(4, 120);  // Date
  sheet.setColumnWidth(5, 100);  // Start_Time
  sheet.setColumnWidth(6, 140);  // Duration_Minutes
  sheet.setColumnWidth(7, 100);  // Status
  sheet.setColumnWidth(8, 250);  // Notes
  sheet.setColumnWidth(9, 180);  // Created_At
  sheet.setColumnWidth(10, 180); // Updated_At
  sheet.setColumnWidth(11, 200); // Google_Event_ID
  
  // Data validation for Status
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['pending', 'confirmed', 'completed', 'cancelled', 'no-show'])
    .build();
  sheet.getRange('G2:G1000').setDataValidation(statusRule);
  
  sheet.setFrozenRows(1);
}

function setupFinanceSheet(ss) {
  let sheet = ss.getSheetByName('Finance');
  if (!sheet) {
    sheet = ss.insertSheet('Finance');
  } else {
    sheet.clear();
  }
  
  const headers = ['ID', 'Date', 'Type', 'Amount_EUR', 'Procedure_Code', 
                   'Patient_Name', 'Appointment_ID', 'Notes', 'Created_At'];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#fbbc04');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#000000');
  
  // Format columns
  sheet.setColumnWidth(1, 150);  // ID
  sheet.setColumnWidth(2, 120);  // Date
  sheet.setColumnWidth(3, 80);   // Type
  sheet.setColumnWidth(4, 120);  // Amount_EUR
  sheet.setColumnWidth(5, 130);  // Procedure_Code
  sheet.setColumnWidth(6, 200);  // Patient_Name
  sheet.setColumnWidth(7, 150);  // Appointment_ID
  sheet.setColumnWidth(8, 250);  // Notes
  sheet.setColumnWidth(9, 180);  // Created_At
  
  // Data validation for Type
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['income', 'expense'])
    .build();
  sheet.getRange('C2:C1000').setDataValidation(typeRule);
  
  // Number format for Amount
  sheet.getRange('D2:D1000').setNumberFormat('#,##0.00');
  
  sheet.setFrozenRows(1);
}

function setupSettingsSheet(ss) {
  let sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
  } else {
    sheet.clear();
  }
  
  const headers = ['Setting_Key', 'Setting_Value', 'Description'];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#ea4335');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
  
  // Default settings
  const settings = [
    ['clinic_name', 'Родопи Дент', 'Име на клиниката'],
    ['clinic_phone', '', 'Телефон за контакт'],
    ['clinic_address', '', 'Адрес на клиниката'],
    ['doctor_name', '', 'Име на лекаря'],
    ['morning_start', '09:00', 'Начало сутрин'],
    ['morning_end', '12:00', 'Край сутрин'],
    ['afternoon_start', '13:30', 'Начало следобед'],
    ['afternoon_end', '17:00', 'Край следобед'],
    ['default_duration', '60', 'Продължителност по подразбиране (минути)'],
    ['allow_online_booking', 'true', 'Позволяване на онлайн записване'],
    ['require_confirmation', 'true', 'Изискване на потвърждение от админ'],
    ['sms_enabled', 'true', 'SMS нотификации активни'],
    ['sms_confirmation', 'true', 'SMS при потвърждение на час'],
    ['sms_reminder', 'true', 'SMS напомняне преди час'],
    ['reminder_hours', '24', 'Часове преди часа за напомняне']
  ];
  
  sheet.getRange(2, 1, settings.length, settings[0].length).setValues(settings);
  
  // Format
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 350);
  
  sheet.setFrozenRows(1);
}
