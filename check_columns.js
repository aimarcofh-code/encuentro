import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workbook = XLSX.readFile(path.join(__dirname, 'Lista de personal ok.xlsx'));
console.log("Sheets:", workbook.SheetNames);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
// Get headers (first row)
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Headers:", jsonData[0]);
console.log("First 20 Rows:");
for (let i = 1; i <= 20; i++) {
    if (jsonData[i]) console.log(jsonData[i]);
}
