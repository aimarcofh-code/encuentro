import XLSX from 'xlsx';
import fs from 'fs';

// Read the Excel file
const workbook = XLSX.readFile('resultados.xlsx');

const categories = {
    'Futsal Varones': 'futsalVarones',
    'Futsal Mujeres': 'futsalMujeres',
    'Voleibol Mixto': 'voleibolMixto'
};

const result = {};

Object.keys(categories).forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Replace "Central" with "Nacional"
    const matches = data.map(row => ({
        id: row.ID,
        round: row.Ronda,
        teamA: row.EquipoA === 'Central' ? 'Nacional' : row.EquipoA,
        scoreA: row.ScoreA,
        scoreB: row.ScoreB,
        teamB: row.EquipoB === 'Central' ? 'Nacional' : row.EquipoB,
        status: row.Estado
    }));

    result[categories[sheetName]] = matches;
});

// Write to JSON file
fs.writeFileSync(
    'public/data/matches.json',
    JSON.stringify(result, null, 2)
);

console.log('✅ Matches data converted successfully!');
console.log(`   - Futsal Varones: ${result.futsalVarones.length} matches`);
console.log(`   - Futsal Mujeres: ${result.futsalMujeres.length} matches`);
console.log(`   - Voleibol Mixto: ${result.voleibolMixto.length} matches`);
