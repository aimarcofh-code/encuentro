
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
console.log('Reading .env from:', envPath);
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            envVars[key] = value;
        }
    });

    process.env.VITE_SUPABASE_URL = envVars.VITE_SUPABASE_URL;
    process.env.VITE_SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

    console.log('Parsed Supabase URL:', process.env.VITE_SUPABASE_URL);
} catch (e) {
    console.error('Failed to read .env:', e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const matchesPath = path.resolve(__dirname, '../public/data/matches.json');

async function seed() {
    try {
        const data = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
        const allMatches = [];

        for (const [category, matches] of Object.entries(data)) {
            matches.forEach(m => {
                allMatches.push({
                    id: m.id,
                    category: category,
                    round: m.round,
                    team_a: m.teamA,
                    score_a: m.scoreA,
                    team_b: m.teamB,
                    score_b: m.scoreB,
                    status: m.status
                });
            });
        }

        console.log(`Preparing to insert ${allMatches.length} matches...`);

        const { error } = await supabase.from('matches').upsert(allMatches);

        if (error) {
            console.error('Error seeding data:', error);
        } else {
            console.log('Successfully seeded matches!');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

seed();
