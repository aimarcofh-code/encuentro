import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// File paths
const inputPath = path.join(projectRoot, 'habitaciones.xlsx');
const outputPath = path.join(projectRoot, 'public', 'data', 'dorms.json');

console.log(`Reading from: ${inputPath}`);

// Read Excel
const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON (array of arrays) to manually handle headers/indices
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Helper to determine floor based on room name/number
function getFloor(roomName) {
    if (!roomName) return 'Desconocido';

    // Check if it's a number
    const roomNum = parseInt(roomName);
    if (!isNaN(roomNum)) {
        if (roomNum < 200) return 'Piso 1';
        if (roomNum < 300) return 'Piso 2';
        return 'Piso 3';
    }

    // Check for letters (A, B, C...) - Assume Cabañas or similar?
    // Let's default to "Cabaña" if it's a letter or "Piso 1" if unknown
    // Or just return the sanitized room name as floor? No.
    return 'Planta Baja';
}

// Data Processing
// Skip first 2 rows (Title/Meta row, then Header row is index 1, Data starts index 2)
// Row 0: Meta headers
// Row 1: ['N', 'Participantes', 'Regional', 'Habitacion'...]
const rows = data.slice(2);

const rooms = {};

rows.forEach((row, index) => {
    // Indices based on User Request: B, C, D -> 1, 2, 3 (0-indexed)
    const name = row[1];       // Col B: Participantes
    const regional = row[2];   // Col C: Regional
    const roomName = row[3];   // Col D: Habitacion

    if (!name || !roomName) return; // Skip empty rows

    // Clean data
    const cleanRoom = roomName.toString().trim();
    const cleanName = name.toString().trim();
    const cleanRegional = regional ? regional.toString().trim() : '';

    if (!rooms[cleanRoom]) {
        rooms[cleanRoom] = {
            room: cleanRoom,
            floor: getFloor(cleanRoom),
            occupants: [],
            // Random coordinates for visualizer (if used)
            coordenadas: { x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100) }
        };
    }

    rooms[cleanRoom].occupants.push(cleanName);
});

// Convert object to array
const roomList = Object.values(rooms);

// Sort by room name
roomList.sort((a, b) => {
    const numA = parseInt(a.room);
    const numB = parseInt(b.room);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.room.localeCompare(b.room);
});

console.log(`Found ${roomList.length} rooms.`);

// Write to file
fs.writeFileSync(outputPath, JSON.stringify(roomList, null, 2));
console.log(`Wrote data to ${outputPath}`);
