import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load matches
import fs from 'fs';
const gamesPath = path.join(projectRoot, 'public', 'data', 'games.json');
const gamesData = JSON.parse(fs.readFileSync(gamesPath, 'utf-8'));

const wb = XLSX.utils.book_new();

// Create a sheet for each sport
gamesData.forEach(sportGroup => {
    // Transform data for Excel
    // ID | Round | Team A | Score A | Score B | Team B | Status
    const rows = sportGroup.matches.map(m => ({
        ID: m.id,
        Ronda: m.round,
        EquipoA: m.teamA,
        ScoreA: m.scoreA,
        ScoreB: m.scoreB,
        EquipoB: m.teamB,
        Estado: m.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
        { wch: 5 }, // ID
        { wch: 8 }, // Round
        { wch: 20 }, // Team A
        { wch: 8 }, // Score A
        { wch: 8 }, // Score B
        { wch: 20 }, // Team B
        { wch: 15 } // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, sportGroup.sport);
});

const excelPath = path.join(projectRoot, 'resultados.xlsx');
XLSX.writeFile(wb, excelPath);

console.log(`Created Excel template at: ${excelPath}`);
