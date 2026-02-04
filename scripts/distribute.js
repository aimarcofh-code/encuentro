import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const workbook = XLSX.readFile(path.join(projectRoot, 'Lista de personal ok.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Remove header
const headers = jsonData.shift();

// Helpers
function getGender(nameRow) {
    if (!nameRow) return 'M';
    const parts = nameRow.trim().split(/\s+/);
    // Heuristic: Check 3rd token (First Name usually)
    let firstName = parts.length > 2 ? parts[2].toUpperCase() : (parts[1] ? parts[1].toUpperCase() : parts[0].toUpperCase());

    // Clean potential junk
    firstName = firstName.replace(/[^A-Z]/g, '');

    const femaleExceptions = ["ROSARIO", "ROCIO", "CONSUELO", "AMPARO", "PILAR", "LUZ", "SOL", "RAQUEL", "RUTH", "NOEMI", "BEATRIZ", "ELIZABETH", "LIZ", "CARMEN", "INES", "VICTORIA", "BANIA", "CINDY", "ISIDORA", "CLAUDIA", "VIRGINIA", "PRISCILA", "ALEJANDRA", "ELENA", "MARISOL", "MERY", "LITZY", "ESTHER", "JUDITH", "EDITH", "LIZETH", "JANETH", "YANETH", "SARAH", "NOELIA", "ABIGAIL", "ASTRID", "INGRID", "KAREN", "HELEN", "EVELYN", "JOCELYN", "MARIBEL", "ROSIBEL", "CLARIBEL", "ANABEL", "SOLEDAD", "PIEDAD", "TRINIDAD", "MERCEDES", "DOLORES", "LOURDES", "NIEVES", "SOCORRO", "NANCY", "BETTY", "DAISY", "SALLY", "WENDY", "JENNY", "DORIS", "GLADYS"];
    const maleExceptions = ["JOSHUA", "LUCA", "NICOLAS", "ANDREA", "JEAN", "DAVID", "MIGUEL", "EDWIN", "GERMAN", "ADHEMAR", "CLEMENTE", "LIZANDRO", "EDUARDO", "ROLANDO", "DAMIAN", "ALBERTO", "JORGE", "JOSE", "LUIS", "CARLOS", "PEDRO", "JESUS", "EBER", "FRANKLIN", "OMAR", "RENE", "JAIME", "FELIPE", "VICENTE"];

    if (femaleExceptions.includes(firstName)) return 'F';
    if (maleExceptions.includes(firstName)) return 'M';

    if (firstName.endsWith('A')) return 'F';
    return 'M';
}

const people = [];

jsonData.forEach((row, index) => {
    // Row format: [n, depto, nombre, habitacion, compañero, acepción]
    // Index: 0, 1, 2, 3, 4, 5
    const name = row[2];
    if (!name) return;

    const dept = row[1] || 'General';
    const partner = row[4];
    const notes = row[5];
    const gender = getGender(name);

    people.push({
        id: index + 1,
        name: name.trim(),
        dept: dept.trim(),
        gender,
        partner,
        notes,
        assigned: false
    });
});

console.log(`Loaded ${people.length} people.`);

// Distribution Logic
const rooms = [];
let roomCounter = 101;
// Floors: 101-125 (Piso 1), 201-225 (Piso 2), 301-320 (Piso 3)
function getFloor(roomNum) {
    if (roomNum < 200) return 'Piso 1';
    if (roomNum < 300) return 'Piso 2';
    return 'Piso 3';
}

function nextRoom() {
    // Simple logic: increment. If crosses 125, jump to 201?
    // User asked for 70 rooms.
    // Let's do 101-125, 201-225, 301-320 (Total 70 rooms exactly)
    // 25 + 25 + 20 = 70.

    let current = roomCounter;

    // Logic for jumping floors
    if (roomCounter === 125) roomCounter = 201;
    else if (roomCounter === 225) roomCounter = 301;
    else roomCounter++;

    return {
        room: current.toString(),
        floor: getFloor(current),
        occupants: [],
        coordenadas: { x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100) } // Random for now
    };
}

// 1. Group Families / Special Cases
// Find people with notes about children or guests
const specialCases = people.filter(p => (p.notes && (p.notes.toLowerCase().includes('hijo') || p.notes.toLowerCase().includes('esposa') || p.notes.toLowerCase().includes('invitado'))) || p.partner);

// We need to group them.
// Simple greedy approach: If someone is special, put them in a room. Use partner to find matches?
// For now, I'll filter them out from main list?
// Or process them first.

// Let's stick to simple "Group by Dept + Gender" for the masses.
// But Families need to be together regardless of gender? Or usually separate room?
// "puedes asignarlos entre los que tienen hijos" -> Keep families together?
// If a person has "con un hijo", they need a bed for them + child? The child might not be in the list?
// "tiene un invitado más o algo como un hijo" -> imply they take up space or need specific arrangement.
// I will assign them to a room with fewer adults (e.g. 2 adults + child space?).
// Or if "invitado" is not in list, they take a slot?
// Assuming list is ONLY adults/participants.
// If "con un hijo", maybe they need a room with space?
// I'll group "Special" people together.

// Strategy:
// Buckets:
// - Special (Families/Kids)
// - Dept -> Male
// - Dept -> Female

// 2. Sort/Group Regulars
const regulars = people.filter(p => !specialCases.includes(p));

const deptGroups = {};
regulars.forEach(p => {
    if (!deptGroups[p.dept]) deptGroups[p.dept] = { M: [], F: [] };
    deptGroups[p.dept][p.gender].push(p);
});

// Process Special Cases
let currentRoom = nextRoom();
rooms.push(currentRoom);

specialCases.forEach(p => {
    if (p.assigned) return;

    // Ensure space
    if (currentRoom.occupants.length >= 3) {
        currentRoom = nextRoom();
        rooms.push(currentRoom);
    }

    currentRoom.occupants.push(p.name + (p.notes ? ` (${p.notes})` : ''));
    p.assigned = true;

    // Check partner
    // Implement complex matching later if needed.
});

// Process Depts
// Order Depts?
Object.keys(deptGroups).forEach(dept => {
    const group = deptGroups[dept];

    // Process Males
    if (group.M.length > 0) {
        // Start new room for Dept Males to keep them together?
        if (currentRoom.occupants.length > 0) {
            currentRoom = nextRoom();
            rooms.push(currentRoom);
        }

        group.M.forEach(p => {
            if (currentRoom.occupants.length >= 3) {
                currentRoom = nextRoom();
                rooms.push(currentRoom);
            }
            currentRoom.occupants.push(p.name);
            p.assigned = true;
        });
    }

    // Process Females
    if (group.F.length > 0) {
        // Start new room for Dept Females
        if (currentRoom.occupants.length > 0) {
            currentRoom = nextRoom();
            rooms.push(currentRoom);
        }

        group.F.forEach(p => {
            if (currentRoom.occupants.length >= 3) {
                currentRoom = nextRoom();
                rooms.push(currentRoom);
            }
            currentRoom.occupants.push(p.name);
            p.assigned = true;
        });
    }
});

// Write Output
const outputPath = path.join(projectRoot, 'public', 'data', 'dorms.json');
fs.writeFileSync(outputPath, JSON.stringify(rooms, null, 2));

console.log(`Distributed ${people.length} people into ${rooms.length} rooms.`);
