import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const TEAMS = ['Cochabamba', 'Chuquisaca', 'La Paz', 'Central'];
const SPORTS = [
    { name: 'Futsal Varones', id: 'futsal_m' },
    { name: 'Futsal Mujeres', id: 'futsal_f' },
    { name: 'Voleibol Mixto', id: 'volleyball' }
];

// Round Robin Logic
// With 4 teams, we have 3 rounds.
// Round 1: 0 vs 3, 1 vs 2
// Round 2: 0 vs 2, 3 vs 1
// Round 3: 0 vs 1, 2 vs 3

// Generic Rotator for N teams (N even)
function generateRoundRobin(teams) {
    const schedule = [];
    const n = teams.length;

    // Check if odd number of teams, add 'Bye'
    let rotation = [...teams];
    if (n % 2 !== 0) {
        rotation.push('Bye');
    }

    const numRounds = rotation.length - 1;
    const half = rotation.length / 2;

    for (let round = 0; round < numRounds; round++) {
        const matches = [];
        for (let i = 0; i < half; i++) {
            const teamA = rotation[i];
            const teamB = rotation[rotation.length - 1 - i];
            if (teamA !== 'Bye' && teamB !== 'Bye') {
                matches.push({ teamA, teamB });
            }
        }
        schedule.push({ round: round + 1, matches });

        // Rotate: Keep first fixed, move last to second
        // [0, 1, 2, 3] -> [0, 3, 1, 2]
        const last = rotation.pop();
        rotation.splice(1, 0, last);
    }
    return schedule;
}

const allGames = [];
let gameIdCounter = 1;

SPORTS.forEach(sport => {
    const fixture = generateRoundRobin(TEAMS);

    const sportGames = {
        sport: sport.name,
        matches: []
    };

    fixture.forEach(round => {
        round.matches.forEach(match => {
            sportGames.matches.push({
                id: gameIdCounter++,
                round: round.round,
                sport: sport.name,
                teamA: match.teamA,
                teamB: match.teamB,
                scoreA: 0,
                scoreB: 0,
                status: 'SCHEDULED' // SCHEDULED, PLAYING, FINISHED
            });
        });
    });
    allGames.push(sportGames);
});

// Write to games.json
const outputPath = path.join(projectRoot, 'public', 'data', 'games.json');
fs.writeFileSync(outputPath, JSON.stringify(allGames, null, 2));

console.log(`Generated ${gameIdCounter - 1} matches.`);
