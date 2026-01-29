/**
 * Google Apps Script за импортиране на НЗОК цени
 * 
 * ИНСТРУКЦИИ:
 * 1. Отвори Google Sheet базата данни
 * 2. Extensions -> Apps Script
 * 3. Добави този код като нов файл или добави функцията към съществуващия
 * 4. Изпълни функцията: importNHIFPrices()
 */

/**
 * Импортира реалните НЗОК цени в листа NHIF_Prices
 * Всички цени са в ЕВРО
 */
function importNHIFPrices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('NHIF_Prices');
  
  if (!sheet) {
    sheet = ss.insertSheet('NHIF_Prices');
  }
  
  // Изчисти старите данни
  sheet.clear();
  
  // НЗОК Ценоразпис - официални цени в ЕВРО (актуализирано 2026)
  // Колони: id, code, name, priceUnder18, priceOver18, patientPayUnder18, patientPayOver18, category
  const nhifPrices = [
    // === ПАКЕТ ДО 18 ГОДИНИ ===
    // Прегледи
    ['nhif_101_u18', '101', 'Обстоен преглед със снемане на орален статус (до 18г.)', 16.76, 0, 0, 0, 'Преглед'],
    
    // Обтурации (пломби)
    ['nhif_301_u18', '301', 'Обтурация с химичен композит (до 18г.)', 45.67, 0, 0, 0, 'Лечение'],
    
    // Екстракции
    ['nhif_508', '508', 'Екстракция на временен зъб с анестезия', 18.35, 0, 0, 0, 'Хирургия'],
    ['nhif_509_u18', '509', 'Екстракция на постоянен зъб с анестезия (до 18г.)', 45.67, 0, 0, 0, 'Хирургия'],
    
    // Ендодонтия
    ['nhif_332', '332', 'Лечение на пулпит или периодонтит на временен зъб', 24.58, 0, 0, 0, 'Ендодонтия'],
    ['nhif_333', '333', 'Лечение на пулпит или периодонтит на постоянен зъб', 79.27, 0, 0, 0, 'Ендодонтия'],
    
    // === ПАКЕТ НАД 18 ГОДИНИ ===
    // Прегледи
    ['nhif_101_o18', '101', 'Обстоен преглед със снемане на орален статус (над 18г.)', 0, 16.76, 0, 0, 'Преглед'],
    
    // Обтурации (пломби)
    ['nhif_301_o18', '301', 'Обтурация с химичен композит (над 18г.)', 0, 43.63, 0, 0, 'Лечение'],
    
    // Екстракции
    ['nhif_509_o18', '509', 'Екстракция на постоянен зъб с анестезия (над 18г.)', 0, 43.63, 0, 0, 'Хирургия'],
    
    // Протези (само над 18г.)
    ['nhif_832', '832', 'Горна цяла протеза', 0, 146.88, 0, 0, 'Протетика'],
    ['nhif_833', '833', 'Долна цяла протеза', 0, 146.88, 0, 0, 'Протетика']
  ];
  
  // Headers
  const headers = [
    'id',
    'code', 
    'name',
    'priceUnder18',
    'priceOver18', 
    'patientPayUnder18',
    'patientPayOver18',
    'category'
  ];
  
  // Запиши заглавния ред
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Форматиране на заглавния ред
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#ec4899')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  // Добави данните
  sheet.getRange(2, 1, nhifPrices.length, headers.length).setValues(nhifPrices);
  
  // Форматиране на цените в EUR
  sheet.getRange('D2:G1000').setNumberFormat('#,##0.00 "€"');
  
  // Разшири колоните
  sheet.setColumnWidth(1, 80);  // id
  sheet.setColumnWidth(2, 50);  // code
  sheet.setColumnWidth(3, 400); // name
  sheet.setColumnWidth(4, 100); // priceUnder18
  sheet.setColumnWidth(5, 100); // priceOver18
  sheet.setColumnWidth(6, 120); // patientPayUnder18
  sheet.setColumnWidth(7, 120); // patientPayOver18
  sheet.setColumnWidth(8, 100); // category
  
  sheet.setFrozenRows(1);
  
  SpreadsheetApp.getUi().alert('✅ Импортирани са ' + nhifPrices.length + ' НЗОК процедури в ЕВРО!');
}

/**
 * Добавя бутон в менюто за импортиране
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🦷 Родопи Дент')
    .addItem('Настрой базата данни', 'setupDatabase')
    .addItem('Импортирай НЗОК цени', 'importNHIFPrices')
    .addItem('Обнови Finances структура', 'updateFinancesStructure')
    .addSeparator()
    .addItem('Добави тестови записи', 'addTestAppointments')
    .addToUi();
}

/**
 * Обновява структурата на листа Finances с новите колони
 */
function updateFinancesStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Finances');
  
  if (!sheet) {
    sheet = ss.insertSheet('Finances');
  }
  
  // Нови заглавия с допълнителни колони
  const newHeaders = [
    'id',
    'date',
    'type',           // income / expense
    'patientName',    // НОВО - име на пациент
    'category',       // nhif / patient_extra / private / materials / etc.
    'procedureCode',  // НОВО - код на процедура (101, 301, etc.)
    'procedureName',  // НОВО - име на процедура
    'nhifAmount',     // НОВО - сума от НЗОК
    'patientAmount',  // НОВО - доплащане от пациент
    'amount',         // обща сума
    'description',
    'paymentMethod',
    'createdAt'
  ];
  
  // Провери дали вече има данни
  const lastRow = sheet.getLastRow();
  
  if (lastRow === 0) {
    // Празен лист - добави заглавия
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  } else {
    // Има данни - добави само заглавията на първия ред
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Провери кои колони липсват и ги добави
    newHeaders.forEach((header, index) => {
      if (existingHeaders.indexOf(header) === -1) {
        // Добави липсващата колона в края
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue(header);
      }
    });
  }
  
  // Форматиране
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground('#22c55e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  SpreadsheetApp.getUi().alert('✅ Структурата на Finances е обновена! Нови колони: patientName, procedureCode, procedureName, nhifAmount, patientAmount');
}

function setupDatabase() {
  // празна функция за съвместимост
  SpreadsheetApp.getUi().alert('Използвай "Импортирай НЗОК цени" и "Обнови Finances структура"');
}

function addTestAppointments() {
  // празна функция за съвместимост
  SpreadsheetApp.getUi().alert('Функцията не е налична');
}
