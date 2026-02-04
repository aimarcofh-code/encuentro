import XLSX from 'xlsx';
import fs from 'fs';

// Helper to convert Excel date number to readable date
function excelDateToJSDate(excelDate) {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date;
}

// Helper to convert Excel time to HH:MM format
function excelTimeToString(excelTime) {
    const totalMinutes = Math.round(excelTime * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Read the Excel file
const workbook = XLSX.readFile('agenda.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Sample row:', data[0]);
console.log('All keys:', Object.keys(data[0]));

// Group by date
const agendaByDate = {};

data.forEach(row => {
    const excelDate = row.fecha || row.Fecha;
    const excelTime = row.hora || row.Hora;
    const title = row.actividad || row.Actividad;
    const description = row.descripcion || row.Descripcion || row['descripción'] || row['Descripción'] || '';
    const location = row.lugar || row.Lugar || row.ubicacion || row.Ubicacion || row['ubicación'] || row['Ubicación'] || '';

    if (!excelDate || excelTime === undefined || !title) {
        console.log('Skipping incomplete row');
        return;
    }

    // Convert Excel date to readable format
    const jsDate = excelDateToJSDate(excelDate);
    const dateKey = jsDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayName = jsDate.toLocaleDateString('es-ES', { weekday: 'long' });
    const dateStr = jsDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    // Convert Excel time to HH:MM
    const timeStr = excelTimeToString(excelTime);

    if (!agendaByDate[dateKey]) {
        agendaByDate[dateKey] = {
            day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
            date: dateStr,
            dateISO: dateKey,
            events: []
        };
    }

    agendaByDate[dateKey].events.push({
        time: timeStr,
        title: title,
        description: description,
        location: location || 'Por confirmar'
    });
});

// Convert to array and sort by date
const agenda = Object.values(agendaByDate).sort((a, b) =>
    a.dateISO.localeCompare(b.dateISO)
);

// Write to JSON
fs.writeFileSync(
    'public/data/agenda.json',
    JSON.stringify(agenda, null, 2)
);

console.log('\n✅ Agenda converted successfully!');
console.log(`   Total days: ${agenda.length}`);
agenda.forEach(day => {
    console.log(`   - ${day.day}, ${day.date}: ${day.events.length} events`);
    day.events.forEach(event => {
        console.log(`     • ${event.time} - ${event.title}`);
    });
});
