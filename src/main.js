import './style.css';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-kmz';

// Updated: 2026-01-30 - Agenda dates corrected to Feb 4-6, 2026
// -- STATE & DATA FETCHING --
let agendaData = [];
let matchesData = {};
let dormsData = [];

// Navigation State
let currentPage = 'home';

// Admin State
let isAdminMode = false;

// Supabase Init
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Subscribe to Realtime Changes
supabase
  .channel('public:matches')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
    console.log('Realtime update:', payload);
    fetchData(true); // Re-fetch data on change
  })
  .subscribe();

async function fetchData(isRefresh = false) {
  try {
    const promises = [
      fetch('/data/agenda.json'),
      fetch('/data/dorms.json')
    ];

    // Only fetch matches from Supabase
    // If it's a refresh we might want to skip static data, but for simplicity we fetch all or just matches
    // But existing structure expects all promises. Let's optimize slightly:

    let agendaRes, dormsRes;

    if (isRefresh) {
      // If just refreshing data, we assume static data is loaded or we re-fetch matches only
      // But we need to update matchesData global.
      const { data, error } = await supabase.from('matches').select('*').order('id', { ascending: true });
      if (error) throw error;
      processMatchesData(data);
      renderApp(); // Re-render
      return;
    }

    const [agendaResponse, dormsResponse] = await Promise.all(promises);
    const { data: matchesDb, error } = await supabase.from('matches').select('*').order('id', { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      // Fallback or alert? For now just log.
    }

    agendaData = await agendaResponse.json();
    dormsData = await dormsResponse.json();

    processMatchesData(matchesDb || []);

    // LocalStorage legacy check removed as we now use DB

    // Check admin session
    isAdminMode = sessionStorage.getItem('adminAuth') === 'true';

    renderApp();
  } catch (err) {
    console.error("Failed to load data", err);
  }
}

function processMatchesData(dbMatches) {
  // Transform flat DB array back to grouped object
  matchesData = {
    futsalVarones: [],
    futsalMujeres: [],
    voleibolMixto: [],
    pingPongVarones: [],
    pingPongMujeres: []
  };

  dbMatches.forEach(m => {
    if (matchesData[m.category]) {
      matchesData[m.category].push({
        id: m.id,
        round: m.round,
        teamA: m.team_a,
        scoreA: m.score_a,
        teamB: m.team_b,
        scoreB: m.score_b,
        status: m.status
      });
    }
  });

  // Sort valid IDs just in case, though we ordered in query
}

// -- HELPER FUNCTIONS --

function getTeamLogo(teamName) {
  const logoMap = {
    'La Paz': '/La Paz.png',
    'Cochabamba': '/Cochabamba.png',
    'Chuquisaca': '/Chuquisaca.png',
    'Nacional': '/Nacional.png'
  };
  return logoMap[teamName] || '';
}

function renderTeamWithLogo(teamName) {
  const logo = getTeamLogo(teamName);
  if (logo) {
    return `
      <div class="team-with-logo">
        <img src="${logo}" alt="${teamName}" class="team-logo" />
        <span>${teamName}</span>
      </div>
    `;
  }
  return `<span>${teamName}</span>`;
}

function calculateStandings(matches, sportType) {
  const teams = {};

  matches.forEach(match => {
    // Initialize teams
    if (!teams[match.teamA]) {
      teams[match.teamA] = { name: match.teamA, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, sf: 0, sc: 0, ds: 0, pts: 0, directResults: {} };
    }
    if (!teams[match.teamB]) {
      teams[match.teamB] = { name: match.teamB, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, sf: 0, sc: 0, ds: 0, pts: 0, directResults: {} };
    }

    // Only count finished matches
    if (match.status === 'FINISHED') {
      teams[match.teamA].pj++;
      teams[match.teamB].pj++;

      if (sportType === 'futsal') {
        teams[match.teamA].gf += match.scoreA;
        teams[match.teamA].gc += match.scoreB;
        teams[match.teamB].gf += match.scoreB;
        teams[match.teamB].gc += match.scoreA;

        if (match.scoreA > match.scoreB) {
          teams[match.teamA].g++;
          teams[match.teamA].pts += 3;
          teams[match.teamB].p++;
        } else if (match.scoreB > match.scoreA) {
          teams[match.teamB].g++;
          teams[match.teamB].pts += 3;
          teams[match.teamA].p++;
        } else {
          teams[match.teamA].e++;
          teams[match.teamB].e++;
          teams[match.teamA].pts += 1;
          teams[match.teamB].pts += 1;
        }
      } else if (sportType === 'volleyball') {
        teams[match.teamA].sf += match.scoreA;
        teams[match.teamA].sc += match.scoreB;
        teams[match.teamB].sf += match.scoreB;
        teams[match.teamB].sc += match.scoreA;

        // Direct result tracking
        teams[match.teamA].directResults[match.teamB] = match.scoreA > match.scoreB ? 1 : -1;
        teams[match.teamB].directResults[match.teamA] = match.scoreB > match.scoreA ? 1 : -1;

        if (match.scoreA > match.scoreB) {
          teams[match.teamA].g++;
          teams[match.teamB].p++;
          if (match.scoreA === 3 && (match.scoreB === 0 || match.scoreB === 1)) {
            teams[match.teamA].pts += 3;
          } else if (match.scoreA === 3 && match.scoreB === 2) {
            teams[match.teamA].pts += 2;
            teams[match.teamB].pts += 1;
          }
        } else {
          teams[match.teamB].g++;
          teams[match.teamA].p++;
          if (match.scoreB === 3 && (match.scoreA === 0 || match.scoreA === 1)) {
            teams[match.teamB].pts += 3;
          } else if (match.scoreB === 3 && match.scoreA === 2) {
            teams[match.teamB].pts += 2;
            teams[match.teamA].pts += 1;
          }
        }
      } else if (sportType === 'pingpong') {
        teams[match.teamA].sf += match.scoreA;
        teams[match.teamA].sc += match.scoreB;
        teams[match.teamB].sf += match.scoreB;
        teams[match.teamB].sc += match.scoreA;

        if (match.scoreA > match.scoreB) {
          teams[match.teamA].g++;
          teams[match.teamA].pts += 2;
          teams[match.teamB].p++;
          teams[match.teamB].pts += 1;
        } else {
          teams[match.teamB].g++;
          teams[match.teamB].pts += 2;
          teams[match.teamA].p++;
          teams[match.teamA].pts += 1;
        }
      }
    }
  });

  // Calculate difference for all
  Object.values(teams).forEach(t => {
    t.ds = t.sf - t.sc;
    t.dg = t.gf - t.gc;
  });

  // Convert to array and sort
  return Object.values(teams).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;

    if (sportType === 'futsal') {
      // Order: Pts -> Goals (GF) -> Goal Difference (DG)
      if (b.gf !== a.gf) return b.gf - a.gf;
      return b.dg - a.dg;
    } else if (sportType === 'volleyball') {
      // Order: Pts -> Difference of sets (DS) -> Sets in favor (SF) -> Result Direct
      if (b.ds !== a.ds) return b.ds - a.ds;
      if (b.sf !== a.sf) return b.sf - a.sf;
      return (a.directResults[b.name] || 0) === 1 ? -1 : 1;
    } else if (sportType === 'pingpong') {
      // Order: Pts -> Difference of sets (DS) -> Sets in favor (SF)
      if (b.ds !== a.ds) return b.ds - a.ds;
      return b.sf - a.sf;
    }
    return 0;
  });
}

function renderStandings(categoryName, matches, sportType) {
  const standings = calculateStandings(matches, sportType);

  const isFutsal = sportType === 'futsal';

  return `
    <div class="glass-panel" style="padding: 2rem; margin-bottom: 3rem;">
      <h3 class="neon-text-magenta" style="margin-bottom: 1.5rem; text-align: center;">
        Tabla de Posiciones - ${categoryName}
      </h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>Posición</th>
            <th>Equipo</th>
            <th>PJ</th>
            ${isFutsal ? `
              <th>G</th>
              <th>E</th>
              <th>P</th>
              <th>GF</th>
              <th>GC</th>
              <th>DG</th>
            ` : `
              <th>PG</th>
              <th>PP</th>
              <th>SF</th>
              <th>SC</th>
              <th>DS</th>
            `}
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((team, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>
                <div class="team-cell">
                  ${team.name ? `<img src="${getTeamLogo(team.name)}" alt="${team.name}" class="team-logo" />` : ''}
                  <strong>${team.name}</strong>
                </div>
              </td>
              <td>${team.pj}</td>
              ${isFutsal ? `
                <td>${team.g}</td>
                <td>${team.e}</td>
                <td>${team.p}</td>
                <td>${team.gf}</td>
                <td>${team.gc}</td>
                <td>${team.dg}</td>
              ` : `
                <td>${team.g}</td>
                <td>${team.p}</td>
                <td>${team.sf}</td>
                <td>${team.sc}</td>
                <td>${team.ds}</td>
              `}
              <td><strong>${team.pts}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMatchRow(match, isEditable) {
  const isWinnerA = match.status === 'FINISHED' && match.scoreA > match.scoreB;
  const isWinnerB = match.status === 'FINISHED' && match.scoreB > match.scoreA;

  if (isEditable) {
    return `
      <tr data-match-id="${match.id}">
        <td class="mono">R${match.round}</td>
        <td style="text-align:right" class="${isWinnerA ? 'winner' : ''}">
          ${renderTeamWithLogo(match.teamA)}
        </td>
        <td style="text-align:center;">
          <input type="number" class="editable-score" value="${match.scoreA}" data-team="A" min="0" />
        </td>
        <td style="text-align:center; color:var(--text-secondary)">-</td>
        <td style="text-align:center;">
          <input type="number" class="editable-score" value="${match.scoreB}" data-team="B" min="0" />
        </td>
        <td style="text-align:left" class="${isWinnerB ? 'winner' : ''}">
          ${renderTeamWithLogo(match.teamB)}
        </td>
        <td>
          <select class="editable-score" data-field="status" style="width: auto;">
            <option value="SCHEDULED" ${match.status === 'SCHEDULED' ? 'selected' : ''}>SCHEDULED</option>
            <option value="PLAYING" ${match.status === 'PLAYING' ? 'selected' : ''}>PLAYING</option>
            <option value="FINISHED" ${match.status === 'FINISHED' ? 'selected' : ''}>FINISHED</option>
          </select>
        </td>
        <td>
          <button class="btn-save-match" onclick="saveMatch(${match.id})">Guardar</button>
        </td>
      </tr>
    `;
  } else {
    return `
      <tr class="${match.status === 'FINISHED' ? 'finished' : ''}">
        <td class="mono">R${match.round}</td>
        <td style="text-align:right" class="${isWinnerA ? 'winner' : ''}">
          ${renderTeamWithLogo(match.teamA)}
          <span class="score-badge">${match.scoreA}</span>
        </td>
        <td style="text-align:center; color:var(--text-secondary)">-</td>
        <td style="text-align:left" class="${isWinnerB ? 'winner' : ''}">
          <span class="score-badge">${match.scoreB}</span>
          ${renderTeamWithLogo(match.teamB)}
        </td>
        <td><span class="status-badge ${match.status.toLowerCase()}">${match.status}</span></td>
      </tr>
    `;
  }
}

// -- RENDER COMPONENTS --

function renderSidebar() {
  const menuItems = [
    { id: 'home', icon: '🏠', label: 'Inicio' },
    { id: 'agenda', icon: '📅', label: 'Programa' },
    { id: 'games', icon: '🏆', label: 'Torneo' },
    { id: 'dorms', icon: '🛏️', label: 'Habitaciones' },
    { id: 'hotel', icon: '🏨', label: 'La Base' },
    { id: 'gallery', icon: '📸', label: 'Recuerdos' },
    { id: 'emergencies', icon: '🆘', label: 'Contactos' }
  ];

  return `
    <aside class="app-sidebar">
      <div class="brand-logo" onclick="navigateTo('home')">
        <h1 class="brand-title text-gradient">UNLOCK<br><span style="font-size:0.6em">NEXT LEVEL</span></h1>
      </div>
      
      <nav class="sidebar-nav">
        ${menuItems.map(item => `
          <a href="#" class="nav-item ${currentPage === item.id ? 'active' : ''}" data-page="${item.id}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-text">${item.label}</span>
          </a>
        `).join('')}
      </nav>
      
      <div class="sidebar-footer">
        <p class="mono">v2.0.26</p>
      </div>
    </aside>
  `;
}

// -- RENDER PAGES --

function renderHero() {
  return `
    <section id="hero" class="hero-section reveal">
      <div class="hero-bg"></div>
      <div class="hero-particles"></div>
      
      <div class="hero-top-logo">
        <img src="/logo_en_negro.jpeg" alt="Logo" class="main-logo-centered">
      </div>

      <div class="container hero-content">
        <h1 class="hero-title text-gradient floating">UNLOCK<br><span class="hero-title-sub">NEXT LEVEL</span></h1>
        
        <div class="hero-subtitle-container">
          <p class="hero-subtitle">Regional Chuquisaca</p>
          <p class="hero-subtitle-year">encuentro nacional 2026</p>
        </div>

        <div class="hero-actions">
          <button class="btn-neon btn-large" onclick="navigateTo('agenda')">Iniciar Experiencia</button>
        </div>
      </div>
    </section>
  `;
}

function getEventTimeState(dateISO, timeStr) {
  // Parse the event date and time
  const [hours, minutes] = timeStr.split(':').map(Number);
  const [year, month, day] = dateISO.split('-').map(Number);
  // Using new Date(year, monthIndex, day, ...) creates a local date
  const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  const now = new Date();
  const diffMs = eventDate - now;
  const diffMinutes = diffMs / (1000 * 60);

  // Past: more than 30 minutes after the event
  if (diffMinutes < -30) {
    return 'past';
  }

  // Current: within 30 minutes before to 30 minutes after
  if (diffMinutes >= -30 && diffMinutes <= 30) {
    return 'current';
  }

  // Upcoming: within 1 hour before the event
  if (diffMinutes > 30 && diffMinutes <= 60) {
    return 'upcoming';
  }

  // Default: future event
  return '';
}

function renderAgenda() {
  const agendaHTML = agendaData.map(day => `
    <div class="day-group reveal">
      <h3 class="neon-text-magenta" style="text-align:center; margin-bottom:2rem">${day.day} - ${day.date}</h3>
      <div class="timeline">
        ${day.events.map(event => {
    const timeState = getEventTimeState(day.dateISO, event.time);
    return `
            <div class="timeline-item ${timeState}">
              <div class="timeline-dot"></div>
              <div class="timeline-content glass-panel">
                <span class="timeline-time">${event.time}</span>
                <h4 class="timeline-title">${event.title}</h4>
                ${event.description ? `<p style="color:var(--text-secondary); margin-top:0.5rem">${event.description}</p>` : ''}
                ${event.location ? `<small class="mono" style="color:var(--accent-cyan)">${event.location}</small>` : ''}
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `).join('');

  return `
    <section id="agenda" class="container">
      <h2 class="section-title text-gradient">Programa Encuentro</h2>
      ${agendaHTML}
    </section>
  `;
}

function renderGames() {
  const categories = [
    { key: 'futsalVarones', name: 'Futsal Varones', type: 'futsal' },
    { key: 'futsalMujeres', name: 'Futsal Mujeres', type: 'futsal' },
    { key: 'voleibolMixto', name: 'Voleibol Mixto', type: 'volleyball' },
    { key: 'pingPongVarones', name: 'Ping-Pong Hombres', type: 'pingpong' },
    { key: 'pingPongMujeres', name: 'Ping-Pong Mujeres', type: 'pingpong' }
  ];

  const categoriesHTML = categories.map(category => {
    const matches = matchesData[category.key] || [];

    return `
      <div class="sport-section reveal">
        <h3 class="sport-title neon-text-cyan">${category.name}</h3>
        
        ${renderStandings(category.name, matches, category.type)}
        
        <div class="table-responsive">
          <table class="games-table glass-panel">
            <thead>
              <tr>
                <th>Ronda</th>
                <th style="text-align:right">Equipo A</th>
                ${isAdminMode ? '<th style="text-align:center">Score A</th>' : ''}
                <th style="text-align:center">VS</th>
                ${isAdminMode ? '<th style="text-align:center">Score B</th>' : ''}
                <th style="text-align:left">Equipo B</th>
                <th>Estado</th>
                ${isAdminMode ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${matches.map(match => renderMatchRow(match, isAdminMode)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section id="games" class="container">
      <h2 class="section-title text-gradient">Torneo: Sigue el legado de Cristo</h2>
      
      <div class="admin-bar">
        ${isAdminMode
      ? '<button class="btn-admin active" onclick="logoutAdmin()">Cerrar Sesión Admin</button>'
      : '<button class="btn-admin" onclick="showLoginModal()">Admin</button>'
    }
      </div>
      
      ${categoriesHTML}
    </section>
  `;
}

function renderDorms() {
  return `
    <section id="dorms" class="container" style="min-height:80vh">
      <h2 class="section-title text-gradient">Buscador de Habitaciones</h2>
      <div class="dorm-search-container reveal">
        <input type="text" id="dorm-search" class="search-input" placeholder="Escribe tu nombre y flota hacia tu habitación..." />
        <div id="search-results"></div>
        <div id="map"></div>
      </div>
    </section>
  `;
}

function renderHotel() {
  return `
    <section id="hotel" class="container" style="padding:4rem 0">
      <h2 class="section-title text-gradient">Lugar del Encuentro</h2>
      
      <div class="glass-panel hotel-card reveal">
        <img src="/madrigal_cover.png" alt="Madrigal Resort" class="hotel-image" style="width:100%; height:300px; object-fit:cover; border-radius:12px 12px 0 0;">
        
        <div class="hotel-info" style="padding:2rem;">
          <div class="hotel-rating">★★★★☆ 4.1</div>
          <h3 class="neon-text-cyan" style="font-size: 2rem; margin-bottom: 0.5rem">Madrigal Resort</h3>
          <p style="color:var(--text-secondary); margin-bottom: 1.5rem">
            Av. Nestor Paz Galarza S/N, Carretera Comunidad Villa Carmena a Yota.
          </p>
          
          <p class="description" style="margin-bottom:2rem;">
            Un hermoso resort campestre en la comunidad de Yotala, ideal para desconectarse y disfrutar de la naturaleza. 
            Cuenta con amplias áreas verdes, salones de eventos y zonas recreativas.
          </p>
          
          <div class="hotel-features" style="margin-bottom:2rem; display:flex; flex-wrap:wrap; gap:1rem;">
            <span class="feature-tag glass-panel" style="padding:0.5rem 1rem; border-radius:20px;">🏊 Piscinas con Toboganes</span>
            <span class="feature-tag glass-panel" style="padding:0.5rem 1rem; border-radius:20px;">🧖 Sauna</span>
            <span class="feature-tag glass-panel" style="padding:0.5rem 1rem; border-radius:20px;">🌳 Áreas Verdes</span>
            <span class="feature-tag glass-panel" style="padding:0.5rem 1rem; border-radius:20px;">🎉 Salón de Eventos</span>
          </div>
          
          <a href="https://maps.app.goo.gl/S5bYfEt4v5G6hPBG6" target="_blank" class="btn-neon">
            📍 Ver Ubicación en Maps
          </a>
        </div>
      </div>
    </section>
  `;
}

function renderGallery() {
  const photosLink = "https://photos.app.goo.gl/P4mxDVSAqkkD9sVk8";
  return `
    <section id="gallery" class="container" style="padding:4rem 0">
      <h2 class="section-title text-gradient">Portal de Recuerdos</h2>
      <div style="text-align:center; padding:3rem" class="glass-panel reveal">
          <div style="margin-bottom:2rem">
            <img src="/qr_fotos.jpeg" alt="QR Code Portal" style="width:200px; height:200px; border: 2px solid var(--accent-cyan); padding: 10px; border-radius: 10px;">
          </div>
          <p>Escanea el QR para subir tus memorias al servidor central.</p>
          <a href="${photosLink}" target="_blank" class="btn-neon" style="margin-top:2rem">Abrir Portal</a>
      </div>
    </section>
  `;
}

function renderContacts() {
  const whatsappLink = "https://wa.me/59169697591?text=Hola%2C%20tengo%20una%20emergencia";
  const groupLink = "https://chat.whatsapp.com/LJjutgTmuSf5aAieFXsBej";
  return `
    <section id="emergencies" class="container" style="padding:4rem 0">
      <h2 class="section-title text-gradient">Centro de Contactos</h2>
      <div class="contacts-grid reveal" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
          <div style="text-align:center; padding:3rem" class="glass-panel">
              <h3 class="neon-text-cyan" style="margin-bottom: 1.5rem">Soporte y Emergencias</h3>
              <div style="margin-bottom:2rem; display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 1rem;">
                <canvas id="emergency-qr-canvas" style="border: 2px solid var(--accent-cyan); padding: 10px; border-radius: 10px; background: #fff;"></canvas>
              </div>
              <p style="margin-bottom: 2rem; color: var(--text-secondary);">Si tienes alguna urgencia médica o técnica, contacta inmediatamente al equipo de soporte orbital.</p>
              <a href="${whatsappLink}" target="_blank" class="btn-neon">
                🆘 Contactar por WhatsApp
              </a>
          </div>

          <div style="text-align:center; padding:3rem" class="glass-panel">
              <h3 class="neon-text-magenta" style="margin-bottom: 1.5rem">Grupo del Encuentro</h3>
              <div style="margin-bottom:2rem; display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 1rem;">
                <canvas id="group-qr-canvas" style="border: 2px solid var(--accent-cyan); padding: 10px; border-radius: 10px; background: #fff;"></canvas>
              </div>
              <p style="margin-bottom: 1rem; color: var(--text-secondary);">Unirme al grupo oficial para no perderme ninguna actualización.</p>
              <p style="font-weight: bold; color: var(--accent-cyan); margin-bottom: 1.5rem">"Hola, estoy feliz de unirme al encuentro."</p>
              <a href="${groupLink}" target="_blank" class="btn-neon">
                💬 Unirse al Grupo
              </a>
          </div>
      </div>
      ${renderAbout()}
    </section>
  `;
}

function renderAbout() {
  return `
    <section id="about" class="container reveal" style="padding: 4rem 0; border-top: 1px solid rgba(255,255,255,0.1)">
      <h2 class="section-title text-gradient">About</h2>
      <div class="glass-panel" style="padding: 3rem; text-align: center;">
        <p style="font-size: 1.2rem; line-height: 1.8; max-width: 800px; margin: 0 auto;">
          Este es un espacio para aprender, servir y crecer con propósito. 
          Creemos en la justicia, la dignidad y el compromiso de hacer todo de corazón, como para el Señor, caminando junto a comunidades que enfrentan desafíos reales.
        </p>
        <div style="margin-top: 3rem;">
           <h4 class="neon-text-cyan" style="margin-bottom: 1rem;">¿Qué es Antigravity?</h4>
           <p style="font-style: italic; color: var(--text-secondary);">Servicio innovador que restaura dignidad y eleva el propósito divino.</p>
           <p style="margin-top: 2rem; font-weight: bold; color: var(--accent-cyan);">📲 WhatsApp: 71158256</p>
        </div>
      </div>
    </section>
  `;
}

function renderLoginModal() {
  return `
    <div class="modal-overlay" id="login-modal" onclick="closeLoginModal(event)">
      <div class="login-modal" onclick="event.stopPropagation()">
        <h3>Acceso Administrador</h3>
        <form class="login-form" onsubmit="handleLogin(event)">
          <input 
            type="text" 
            id="admin-username" 
            class="login-input" 
            placeholder="Usuario" 
            required 
          />
          <input 
            type="password" 
            id="admin-password" 
            class="login-input" 
            placeholder="Contraseña" 
            required 
          />
          <div id="login-error" class="login-error"></div>
          <div class="login-buttons">
            <button type="button" class="btn-login-cancel" onclick="closeLoginModal()">Cancelar</button>
            <button type="submit" class="btn-login-submit">Ingresar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function getContent() {
  switch (currentPage) {
    case 'home': return renderHero();
    case 'agenda': return renderAgenda();
    case 'games': return renderGames();
    case 'dorms': return renderDorms();
    case 'hotel': return renderHotel();
    case 'gallery': return renderGallery();
    case 'emergencies': return renderContacts();
    default: return renderHero();
  }
}

function renderApp() {
  const app = document.querySelector('#app');
  if (!app) return;

  app.innerHTML = `
    ${renderSidebar()}
    <main class="main-content" id="main-content">
      ${getContent()}
      <footer style="text-align:center; padding:4rem; color:var(--text-secondary); border-top:1px solid rgba(255,255,255,0.05); margin-top: auto;">
        <p>&copy; 2026 Encuentro Nacional. Regional Chuquisaca.</p>
      </footer>
    </main>
  `;

  // Attach event listeners
  setupNavigation();
  setupDormSearch();
  setupScrollReveal();
  setupContactQRs();
  setupMap();
}

let activeMap = null;
let kmzLayer = null;

function setupMap() {
  if (currentPage !== 'dorms') {
    activeMap = null;
    kmzLayer = null;
    return;
  }

  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Initialize map with precision focus (300m/Zoom 18 equivalent)
  // 19° 9'24.24"S, 65°15'3.02"W
  activeMap = L.map('map').setView([-19.156733, -65.250839], 18);

  // Add Google Hybrid tiles
  L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 21
  }).addTo(activeMap);

  // Load KMZ
  kmzLayer = L.kmzLayer().addTo(activeMap);
  kmzLayer.load('/habitaciones_madrigal_actual.kmz');

  kmzLayer.on('load', (e) => {
    // We stay at the requested precision zoom.
    // If we were to use fitBounds, it might zoom out to the whole world/KMZ extent.
    // So we just ensure the layer is visible.
    console.log('KMZ Layer loaded at precision focus');
  });
}

function highlightRoomOnMap(roomName) {
  console.log('Attempting to highlight room:', roomName);
  if (!activeMap || !kmzLayer) {
    console.warn('Map or KMZ layer not initialized');
    return;
  }

  let targetLayer = null;
  const cleanRoomName = roomName.toLowerCase().replace('habitación', '').replace('cabaña', '').trim();
  const roomNum = parseInt(cleanRoomName);

  function findLayerRecursive(layer) {
    if (targetLayer) return;

    if (layer.feature && layer.feature.properties) {
      const name = (layer.feature.properties.name || '').toLowerCase().trim();
      const cleanName = name.replace('habitación', '').replace('cabaña', '').replace('habitaciones', '').trim();

      // 1. Exact or include match (Improved to prevent partial numeric matches like 1 matching 10)
      const isNumericRoom = !isNaN(roomNum);
      const isLayerNumeric = !isNaN(parseInt(cleanName));

      if (cleanName === cleanRoomName) {
        targetLayer = layer;
        return;
      }

      // If one is numeric and they don't match exactly, don't allow "contains" matching
      // as "10" contains "1" but they are different rooms.
      if (!isNumericRoom && cleanName.length > 0 && cleanRoomName.includes(cleanName)) {
        targetLayer = layer;
        return;
      }

      // 2. Special case: BUHO
      if (cleanRoomName.includes('buho') && name.includes('buho')) {
        targetLayer = layer;
        return;
      }

      // 3. Range match (e.g., 13-16, 21-26)
      if (!isNaN(roomNum)) {
        const rangeMatch = name.match(/(\d+)\s*-\s*(\d+)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          if (roomNum >= start && roomNum <= end) {
            targetLayer = layer;
            return;
          }
        }
      }
    }

    if (layer.eachLayer) {
      layer.eachLayer(child => findLayerRecursive(child));
    }
  }

  findLayerRecursive(kmzLayer);

  if (targetLayer) {
    console.log('Match found for:', roomName, 'layer name:', targetLayer.feature.properties.name);
    if (targetLayer.getBounds) {
      activeMap.flyToBounds(targetLayer.getBounds(), { padding: [30, 30], maxZoom: 19 });
    } else if (targetLayer.getLatLng) {
      activeMap.flyTo(targetLayer.getLatLng(), 19);
    }

    // Ensure popup content shows the searched room info
    const popupContent = `<strong>${roomName}</strong><br/><small>Ubicación: ${targetLayer.feature.properties.name}</small>`;
    if (!targetLayer.getPopup()) {
      targetLayer.bindPopup(popupContent).openPopup();
    } else {
      targetLayer.setPopupContent(popupContent).openPopup();
    }
  } else {
    console.warn('No matching layer found for:', roomName);
  }
}

function setupContactQRs() {
  if (currentPage === 'emergencies') {
    const emergencyCanvas = document.getElementById('emergency-qr-canvas');
    if (emergencyCanvas) {
      const whatsappLink = "https://wa.me/59169697591?text=Hola%2C%20tengo%20una%20emergencia";
      QRCode.toCanvas(emergencyCanvas, whatsappLink, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }, (error) => {
        if (error) console.error('Error generating emergency QR:', error);
      });
    }

    const groupCanvas = document.getElementById('group-qr-canvas');
    if (groupCanvas) {
      const groupLink = "https://chat.whatsapp.com/LJjutgTmuSf5aAieFXsBej";
      QRCode.toCanvas(groupCanvas, groupLink, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }, (error) => {
        if (error) console.error('Error generating group QR:', error);
      });
    }
  }
}

// -- INTERACTIONS --

// Expose functions to window scope for inline onclick handlers
window.navigateTo = (pageId) => {
  currentPage = pageId;
  renderApp();
};

window.showLoginModal = () => {
  const modal = document.createElement('div');
  modal.innerHTML = renderLoginModal();
  document.body.appendChild(modal.firstElementChild);
};

window.closeLoginModal = (event) => {
  if (event && event.target.id !== 'login-modal') return;
  const modal = document.getElementById('login-modal');
  if (modal) modal.remove();
};

window.handleLogin = (event) => {
  event.preventDefault();
  const username = document.getElementById('admin-username').value;
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('login-error');

  if (username === 'admin' && password === 'M&L') {
    sessionStorage.setItem('adminAuth', 'true');
    isAdminMode = true;
    closeLoginModal();
    renderApp();
  } else {
    errorDiv.textContent = 'Usuario o contraseña incorrectos';
  }
};

window.logoutAdmin = () => {
  sessionStorage.removeItem('adminAuth');
  isAdminMode = false;
  renderApp();
};

window.saveMatch = async (matchId) => {
  const row = document.querySelector(`tr[data-match-id="${matchId}"]`);
  if (!row) return;

  const scoreA = parseInt(row.querySelector('input[data-team="A"]').value) || 0;
  const scoreB = parseInt(row.querySelector('input[data-team="B"]').value) || 0;
  const status = row.querySelector('select[data-field="status"]').value;
  const btn = row.querySelector('.btn-save-match');

  if (btn) {
    btn.textContent = 'Guardando...';
    btn.disabled = true;
  }

  const { error } = await supabase
    .from('matches')
    .update({
      score_a: scoreA,
      score_b: scoreB,
      status: status,
      updated_at: new Date()
    })
    .eq('id', matchId);

  if (error) {
    console.error('Error updating match:', error);
    alert('Error al guardar cambios: ' + error.message);
    if (btn) {
      btn.textContent = 'Guardar';
      btn.disabled = false;
    }
    return;
  }

  // Update local state immediately for responsiveness
  for (let category in matchesData) {
    const match = matchesData[category].find(m => m.id === matchId);
    if (match) {
      match.scoreA = scoreA;
      match.scoreB = scoreB;
      match.status = status;
      break;
    }
  }

  if (btn) {
    btn.textContent = 'Guardado!';
    setTimeout(() => {
      btn.textContent = 'Guardar';
      btn.disabled = false;
      // Re-render to update standings if not already triggered by realtime
      renderApp();
    }, 500);
  }
};

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.getAttribute('data-page');
      navigateTo(pageId);
    });
  });
}

function setupScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal');
      }
    });
  });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function setupDormSearch() {
  const searchInput = document.getElementById('dorm-search');
  const resultsContainer = document.getElementById('search-results');

  if (searchInput && resultsContainer) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (query.length < 3) {
        resultsContainer.innerHTML = '';
        return;
      }

      const found = [];
      dormsData.forEach(room => {
        const hasOccupant = room.occupants.some(name => name.toLowerCase().includes(query));
        if (hasOccupant) found.push(room);
      });

      if (found.length > 0) {
        resultsContainer.innerHTML = found.map(room => `
          <div class="result-card glass-panel floating" onclick="highlightRoomOnMap('${room.room}')" style="cursor:pointer">
            <div class="room-number">${room.room}</div>
            <ul class="occupant-list">
              ${room.occupants.map(name => `<li>${name}</li>`).join('')}
            </ul>
            <small style="color:var(--accent-cyan)">Ver en mapa ↓</small>
          </div>
        `).join('');

        // Auto-highlight the first result
        highlightRoomOnMap(found[0].room);
      } else {
        resultsContainer.innerHTML = '<p style="margin-top:2rem; color:var(--text-secondary)">Buscando señal en el vacío...</p>';
      }
    });
  }
}

// Auto-refresh agenda page every minute to update time-based states
let agendaRefreshInterval = null;

window.navigateTo = (pageId) => {
  currentPage = pageId;

  // Clear previous interval
  if (agendaRefreshInterval) {
    clearInterval(agendaRefreshInterval);
    agendaRefreshInterval = null;
  }

  // Set up auto-refresh for agenda page
  if (pageId === 'agenda') {
    agendaRefreshInterval = setInterval(() => {
      if (currentPage === 'agenda') {
        renderApp();
      }
    }, 3600000); // Refresh every hour
  }

  renderApp();
};

// Init
fetchData();
