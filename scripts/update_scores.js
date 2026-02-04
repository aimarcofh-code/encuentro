import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const excelPath = path.join(projectRoot, 'resultados.xlsx');
const jsonPath = path.join(projectRoot, 'public', 'data', 'games.json');

if (!fs.existsSync(excelPath)) {
    console.error(`Excel file not found at ${excelPath}`);
    process.exit(1);
}

const wb = XLSX.readFile(excelPath);
const allGames = [];

wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    // Read raw data
    const rows = XLSX.utils.sheet_to_json(ws);

    // Transform back to JSON structure
    // ID | Round | Team A | Score A | Score B | Team B | Status
    // Excel Keys match the Headers we set: 'ID', 'Ronda', 'EquipoA', ...

    const matches = rows.map(row => ({
        id: row['ID'],
        round: row['Ronda'],
        sport: sheetName,
        teamA: row['EquipoA'],
        teamB: row['EquipoB'],
        scoreA: row['ScoreA'] || 0,
        scoreB: row['ScoreB'] || 0,
        status: row['Estado'] || 'SCHEDULED'
    }));

    allGames.push({
        sport: sheetName,
        matches: matches
    });
});

fs.writeFileSync(jsonPath, JSON.stringify(allGames, null, 2));

console.log(`Updated games.json from Excel. Processed ${allGames.length} sports.`);
