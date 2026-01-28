/**
 * Google Apps Script за настройка на Родопи Дент базата данни
 * 
 * ИНСТРУКЦИИ:
 * 1. Отвори Google Sheet: https://docs.google.com/spreadsheets/d/1hv4XAfHhScA40Bm1kQ3I-Ih4SJuCBpOJxTOYDNb167g
 * 2. Extensions -> Apps Script
 * 3. Изтрий всичко и постави този код
 * 4. Запази (Ctrl+S)
 * 5. Изпълни функцията: setupDatabase()
 * 6. Разреши достъп когато поиска
 */

/**
 * Главна функция - създава всички листове и структура
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Създай листовете
  createAppointmentsSheet(ss);
  createProceduresSheet(ss);
  createFinanceSheet(ss);
  createSettingsSheet(ss);
  createNHIFPricesSheet(ss);
  
  // Изтрий празния "Sheet1" ако съществува
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  SpreadsheetApp.getUi().alert('✅ Базата данни е настроена успешно!');
}

/**
 * Appointments - Записи за часове
 */
function createAppointmentsSheet(ss) {
  let sheet = ss.getSheetByName('Appointments');
  
  if (!sheet) {
    sheet = ss.insertSheet('Appointments');
  } else {
    sheet.clear();
  }
  
  // Заглавен ред
  const headers = [
    'id',
    'patientName',
    'patientPhone', 
    'date',
    'startTime',
    'duration',
    'reason',
    'status',
    'createdAt',
    'updatedAt'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Форматиране
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#2563eb')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 120);
  
  // Валидация за status
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['pending', 'confirmed', 'completed', 'cancelled'])
    .build();
  sheet.getRange('H2:H1000').setDataValidation(statusRule);
  
  // Формат за дата
  sheet.getRange('D2:D1000').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('E2:E1000').setNumberFormat('hh:mm');
  sheet.getRange('I2:J1000').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

/**
 * Procedures - Процедури
 */
function createProceduresSheet(ss) {
  let sheet = ss.getSheetByName('Procedures');
  
  if (!sheet) {
    sheet = ss.insertSheet('Procedures');
  } else {
    sheet.clear();
  }
  
  const headers = [
    'id',
    'name',
    'category',
    'duration',
    'price',
    'active'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#22c55e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 120);
  sheet.setColumnWidth(2, 250); // name column wider
  
  // Валидация за active
  const activeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'])
    .build();
  sheet.getRange('F2:F1000').setDataValidation(activeRule);
  
  // Добави примерни процедури
  const sampleProcedures = [
    ['proc_1', 'Преглед', 'Общи', 30, 40, 'TRUE'],
    ['proc_2', 'Почистване на зъбен камък', 'Профилактика', 60, 80, 'TRUE'],
    ['proc_3', 'Пломба', 'Лечение', 60, 100, 'TRUE'],
    ['proc_4', 'Екстракция', 'Хирургия', 30, 60, 'TRUE'],
    ['proc_5', 'Избелване', 'Естетика', 90, 250, 'TRUE']
  ];
  
  sheet.getRange(2, 1, sampleProcedures.length, headers.length).setValues(sampleProcedures);
}

/**
 * Finance - Финанси (всички суми в EUR)
 */
function createFinanceSheet(ss) {
  let sheet = ss.getSheetByName('Finance');
  
  if (!sheet) {
    sheet = ss.insertSheet('Finance');
  } else {
    sheet.clear();
  }
  
  const headers = [
    'id',
    'date',
    'type',           // income, expense
    'amount',         // в EUR (положително за приходи, отрицателно за разходи)
    'description',
    'paymentMethod',  // cash, bank
    'category',       // nhif, private, materials, lab, utilities, other
    'patientName',    // име на пациент (ако е приход)
    'nhifCode',       // НЗОК код ако е НЗОК услуга
    'eventId',        // Google Calendar event ID
    'createdAt'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#f59e0b')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  // Ширини на колони
  sheet.setColumnWidth(1, 150); // id
  sheet.setColumnWidth(2, 100); // date
  sheet.setColumnWidth(3, 80);  // type
  sheet.setColumnWidth(4, 100); // amount
  sheet.setColumnWidth(5, 300); // description
  sheet.setColumnWidth(6, 80);  // paymentMethod
  sheet.setColumnWidth(7, 100); // category
  sheet.setColumnWidth(8, 150); // patientName
  sheet.setColumnWidth(9, 80);  // nhifCode
  sheet.setColumnWidth(10, 200); // eventId
  sheet.setColumnWidth(11, 150); // createdAt
  
  // Валидация за type
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['income', 'expense'])
    .build();
  sheet.getRange('C2:C1000').setDataValidation(typeRule);
  
  // Валидация за paymentMethod
  const paymentRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['cash', 'bank'])
    .build();
  sheet.getRange('F2:F1000').setDataValidation(paymentRule);
  
  // Валидация за category
  const categoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['nhif', 'private', 'materials', 'lab', 'utilities', 'rent', 'salary', 'other'])
    .build();
  sheet.getRange('G2:G1000').setDataValidation(categoryRule);
  
  // Формат за дата и сума в EUR
  sheet.getRange('B2:B1000').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('D2:D1000').setNumberFormat('#,##0.00 "€"');
  sheet.getRange('K2:K1000').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

/**
 * Settings - Настройки
 */
function createSettingsSheet(ss) {
  let sheet = ss.getSheetByName('Settings');
  
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
  } else {
    sheet.clear();
  }
  
  const headers = ['key', 'value'];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#8b5cf6')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 400);
  
  // Добави настройки по подразбиране
  const defaultSettings = [
    ['clinicName', 'Родопи Дент'],
    ['clinicAddress', 'гр. Смолян, ул. "Родопи" 1'],
    ['clinicPhone', '0888 123 456'],
    ['clinicEmail', 'info@rodopident.bg'],
    ['workingHours', '{"morning":{"start":"09:00","end":"12:00"},"afternoon":{"start":"13:30","end":"17:00"}}'],
    ['workingDays', '[1,2,3,4,5]'],
    ['defaultDuration', '60'],
    ['smsEnabled', 'true'],
    ['twilioPhone', '']
  ];
  
  sheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
}

/**
 * NHIF_Prices - НЗОК Ценоразпис
 */
function createNHIFPricesSheet(ss) {
  let sheet = ss.getSheetByName('NHIF_Prices');
  
  if (!sheet) {
    sheet = ss.insertSheet('NHIF_Prices');
  } else {
    sheet.clear();
  }
  
  const headers = [
    'id',
    'code',
    'name',
    'price',
    'category'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#ec4899')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 120);
  sheet.setColumnWidth(3, 300); // name column wider
  
  // Формат за цена
  sheet.getRange('D2:D1000').setNumberFormat('#,##0.00 "лв."');
  
  // Примерни НЗОК процедури (ще бъдат заменени с реалните)
  const sampleNHIF = [
    ['nhif_1', '101', 'Преглед първичен', 20.00, 'Възрастни'],
    ['nhif_2', '102', 'Преглед вторичен', 15.00, 'Възрастни'],
    ['nhif_3', '201', 'Детски преглед', 18.00, 'Детска'],
    ['nhif_4', '301', 'Екстракция на зъб', 35.00, 'Хирургия'],
    ['nhif_5', '401', 'Пломба амалгамова', 45.00, 'Лечение']
  ];
  
  sheet.getRange(2, 1, sampleNHIF.length, headers.length).setValues(sampleNHIF);
  
  // Добави бележка
  sheet.getRange('A1').setNote('Този лист ще бъде попълнен с реални НЗОК цени от предоставен файл');
}

/**
 * Меню за лесен достъп
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🦷 Родопи Дент')
    .addItem('Настрой базата данни', 'setupDatabase')
    .addSeparator()
    .addItem('Добави тестови записи', 'addTestAppointments')
    .addToUi();
}

/**
 * Добавя тестови записи за демонстрация
 */
function addTestAppointments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Appointments');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Първо изпълнете "Настрой базата данни"');
    return;
  }
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const formatDate = (d) => Utilities.formatDate(d, 'Europe/Sofia', 'yyyy-MM-dd');
  const now = Utilities.formatDate(new Date(), 'Europe/Sofia', 'yyyy-MM-dd HH:mm:ss');
  
  const testData = [
    [generateId(), 'Иван Петров', '0888111222', formatDate(today), '09:00', 60, 'Преглед', 'confirmed', now, now],
    [generateId(), 'Мария Георгиева', '0877333444', formatDate(today), '10:00', 60, 'Почистване', 'pending', now, now],
    [generateId(), 'Петър Димитров', '0899555666', formatDate(today), '14:00', 60, 'Пломба', 'confirmed', now, now],
    [generateId(), 'Елена Стоянова', '0888777888', formatDate(tomorrow), '09:30', 60, 'Екстракция', 'pending', now, now],
    [generateId(), 'Георги Николов', '0877999000', formatDate(tomorrow), '11:00', 90, 'Избелване', 'pending', now, now]
  ];
  
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, testData.length, testData[0].length).setValues(testData);
  
  SpreadsheetApp.getUi().alert('✅ Добавени са 5 тестови записа!');
}

/**
 * Генерира уникален ID
 */
function generateId() {
  return 'apt_' + Utilities.getUuid().substring(0, 8);
}
