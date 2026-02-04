import XLSX from 'xlsx';
import fs from 'fs';

// Read the Excel file
const workbook = XLSX.readFile('resultados.xlsx');

// Get all sheet names
const sheetNames = workbook.SheetNames;
console.log('Available sheets:', sheetNames);

// Parse each sheet
sheetNames.forEach(sheetName => {
    console.log(`\n=== ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('First 10 rows:');
    data.slice(0, 10).forEach((row, idx) => {
        console.log(`Row ${idx}:`, row);
    });
});
