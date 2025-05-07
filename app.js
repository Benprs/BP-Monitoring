// script.js
// Intégration Telemachus via WebSocket + affichage du temps de mission + heure réelle + jauges + corps orbital + status jeu avec modale custom stylée et sons d'alerte (configurables, bouclés)

document.addEventListener('DOMContentLoaded', () => {
  const timerEl = document.getElementById('timer');
  const clockEl = document.getElementById('clock');
  const planetNameEl = document.getElementById('planet-name');
  const WS_URL = 'ws://localhost:8085/datalink';

  // === Configuration des chemins des sons d'alerte ===
  const soundPaths = {
    paused:      '',
    power:       'assets/audios/C4.wav',
    offline:     'assets/audios/A4.wav',
    noTelemetry: ''
  };

  // Création et préchargement des objets Audio, bouclage activé
  const sounds = {};
  Object.entries(soundPaths).forEach(([key, path]) => {
    const audio = new Audio(path);
    audio.loop = true;
    audio.preload = 'auto';
    audio.load();
    sounds[key] = audio;
  });

  // Injecte le style de l'animation blink si nécessaire
  function ensureBlinkStyle() {
    if (!document.getElementById('modal-blink-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'modal-blink-style';
      styleEl.textContent = `
        @keyframes blink {
          0%, 100% { color: red; }
          50% { color: white; }
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

  // Fonction pour créer la modale si elle n'existe pas
  function ensureModal() {
    ensureBlinkStyle();
    let modal = document.getElementById('custom-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm z-50 hidden';
      modal.innerHTML = `
        <div class="bg-gray-900 p-6 rounded-lg shadow-2xl max-w-sm text-center border-4 border-red-600">
          <h2 id="modal-title" class="text-3xl font-extrabold uppercase mb-2" style="animation: blink 1s step-start infinite;">ALERTE</h2>
          <p id="modal-subtitle" class="mb-4 text-xl text-white"></p>
        </div>
      `;
      document.body.appendChild(modal);
    }
    return modal;
  }

  // Affiche une modale custom avec titre et sous-titre
  function showModal(title, subtitle) {
    const modal = ensureModal();
    modal.querySelector('#modal-title').textContent = title;
    modal.querySelector('#modal-subtitle').textContent = subtitle;
    modal.classList.remove('hidden');
  }

  // Fonction pour cacher la modale et arrêter les sons
  function hideModal() {
    const modal = document.getElementById('custom-modal');
    if (modal) modal.classList.add('hidden');
    Object.values(sounds).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  // Fonction pour mettre à jour l'heure réelle chaque seconde
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('fr-FR', { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Ressources à surveiller
  const resources = [
    { name: 'LiquidFuel',     id: 'fuel' },
    { name: 'Oxidizer',       id: 'oxidizer' },
    { name: 'ElectricCharge', id: 'electric' }
  ];

  // Ouvre la connexion WebSocket
  const ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    const subscribe = { '+': [], rate: 1000 };
    subscribe['+'].push('v.missionTime');
    subscribe['+'].push('v.body');
    subscribe['+'].push('p.paused');
    resources.forEach(res => {
      subscribe['+'].push(`r.resource[${res.name}]`);
      subscribe['+'].push(`r.resourceMax[${res.name}]`);
    });
    ws.send(JSON.stringify(subscribe));
  });

  ws.addEventListener('message', evt => {
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch (err) {
      console.error('WS parse error:', err);
      return;
    }

    // Gestion du statut du jeu via p.paused
    if (data['p.paused'] !== undefined) {
      switch (parseInt(data['p.paused'], 10)) {
        case 0:
          hideModal();
          break;
        case 1:
          showModal('SIMULATION PAUSED', 'Game is currently paused');
          sounds.paused.play();
          break;
        case 2:
          showModal('POWER OUTAGE', 'MAJOR POWER OUTAGE — carry out a vessel analysis immediately.');
          sounds.power.play();
          break;
        case 3:
          showModal('SYSTEM OFFLINE', 'No data link with the distant object.');
          sounds.offline.play();
          break;
        case 4:
          showModal('NO TELEMETRY', 'No telemetry system instances detected.');
          sounds.noTelemetry.play();
          break;
        default:
          console.warn('Status jeu inconnu:', data['p.paused']);
      }
    }

    // Mise à jour du timer depuis v.missionTime
    const mt = data['v.missionTime'];
    if (mt !== undefined) {
      const totalSec = Math.floor(parseFloat(mt));
      const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const s = String(totalSec % 60).padStart(2, '0');
      timerEl.textContent = `${h}:${m}:${s}`;
    }

    // Mise à jour du nom du corps orbital via v.body
    const body = data['v.body'];
    if (body !== undefined) {
      planetNameEl.textContent = (body === 'Kerbin') ? 'Kerbin' : 'Astre Inconnu';
    }

    // Mise à jour des jauges via current/max
    resources.forEach(res => {
      const curKey = `r.resource[${res.name}]`;
      const maxKey = `r.resourceMax[${res.name}]`;
      const cur = parseFloat(data[curKey]);
      const max = parseFloat(data[maxKey]);
      if (!isNaN(cur) && !isNaN(max) && max > 0) {
        const pct = Math.round((cur / max) * 100);
        const bar = document.getElementById(`bar-${res.id}`);
        const label = document.getElementById(`label-${res.id}`);
        if (bar && label) {
          bar.style.width = `${pct}%`;
          label.textContent = `${pct}%`;
        }
      }
    });
  });

  ws.addEventListener('error', e => console.error('WebSocket error:', e));
  ws.addEventListener('close', () => console.warn('WebSocket closed'));
});
