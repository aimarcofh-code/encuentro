import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const workbook = XLSX.readFile(path.join(projectRoot, 'Lista de personal ok.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
jsonData.shift(); // Header

function getGender(nameRow) {
    if (!nameRow) return 'M';
    const parts = nameRow.trim().split(/\s+/);
    let firstName = parts.length > 2 ? parts[2].toUpperCase() : (parts[1] ? parts[1].toUpperCase() : parts[0].toUpperCase());
    firstName = firstName.replace(/[^A-Z]/g, '');

    // Minimal Base Logic
    if (firstName.endsWith('A')) return 'F';
    return 'M?'; // Mark as uncertain check
}

const table = [];
jsonData.forEach(row => {
    const name = row[2];
    if (name) {
        const parts = name.trim().split(/\s+/);
        const firstName = parts.length > 2 ? parts[2].toUpperCase() : (parts[1] ? parts[1].toUpperCase() : parts[0].toUpperCase());
        const gender = getGender(name);
        if (gender === 'M?') {
            table.push({ name, firstName, gender });
        }
    }
});

console.table(table);
