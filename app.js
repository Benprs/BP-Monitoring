// script.js
// Intégration Telemachus via WebSocket + affichage du temps de mission + heure réelle + jauges + corps orbital + status jeu avec modale custom stylée et sons d'alerte (configurables, bouclés)

document.addEventListener('DOMContentLoaded', () => {
  const timerEl = document.getElementById('timer');
  const clockEl = document.getElementById('clock');
  const planetNameEl = document.getElementById('planet-name');
  const WS_URL = 'ws://localhost:8085/datalink';

  // === Configuration des chemins des sons d'alerte ===
  const soundPaths = {
    power:       'assets/audios/C4.wav',
    offline:     'assets/audios/A4.wav'
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
    const subEl = modal.querySelector('#modal-subtitle');
    subEl.textContent = subtitle;
    modal.classList.remove('hidden');
    return modal;
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

  // Fonction pour afficher la modale de connexion Telemachus
  function showConnectionError() {
    const modal = showModal(
      'NO TELEMACHUS CONNECTION DETECTED',
      ''
    );
    const subEl = modal.querySelector('#modal-subtitle');
    subEl.innerHTML = `Please make sure Telemachus is installed and your game loaded correctly. <a href="https://github.com/Benprs/BP-Monitoring" target="_blank" class="underline text-blue-400">HELP</a>`;
    const titleEl = modal.querySelector('#modal-title');
    titleEl.style.animation = 'none';
    titleEl.style.color = 'red';
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
        case 5:
          // Statut inconnu: traiter comme connexion perdue
          showConnectionError();
          break;
        default:
          // Par défaut, afficher modale de connexion
          showConnectionError();
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

  // Gestion de la connexion perdue ou erreur WebSocket
  ws.addEventListener('error', e => {
    console.error('WebSocket error:', e);
    showConnectionError();
  });

  ws.addEventListener('close', () => {
    console.warn('WebSocket closed');
    showConnectionError();
  });
});

// === Three.js Kerbin viewer ===
(function(){
  const container = document.getElementById('planet-viewer');
  const width     = container.clientWidth;
  const height    = container.clientHeight;

  // Scène et caméra
  const scene  = new THREE.Scene();
    // Skybox
    // Simulation de fond étoilé via point cloud
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = THREE.MathUtils.randFloatSpread(360);
      const phi = THREE.MathUtils.randFloatSpread(360);
      const radius = THREE.MathUtils.randFloat(50, 100);
      positions[i*3 + 0] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i*3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      positions[i*3 + 2] = radius * Math.cos(theta);
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);
  const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 1000);
  camera.position.set(0, 0, 3);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
    // Paramètres de tone mapping pour effet cinématique
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // exposant initial
  container.appendChild(renderer.domElement);

  // Lumières
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);

  // Géométrie de Kerbin
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const loader   = new THREE.TextureLoader();
  const texture  = loader.load(
    'assets/images/kerbin_texture.png'
  );
  // Ajout de bumpMap pour relief
  const bumpTexture = loader.load('assets/images/kerbin-bump-map.png');
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: bumpTexture,
    // bumpScale calculé : 4km altitude pour niveau 255
    bumpScale: 4000 / 600000  // ≈0.006667, pour un rayon de sphère de 1 unité (Kerbin radius≈600km)
  });
  const kerbin   = new THREE.Mesh(geometry, material);
  scene.add(kerbin);

    // Couches de nuages
    const cloudGeo = new THREE.SphereGeometry(1.02, 64, 64);
    const cloudTex = loader.load('assets/images/kerbin-clouds-map.png');
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(clouds);

    // Atmosphère
    const atmGeometry = new THREE.SphereGeometry(1.05, 64, 64);
    const atmMaterial = new THREE.MeshBasicMaterial({
      color: 0x5e98e8,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.25
    });
    const atmosphere = new THREE.Mesh(atmGeometry, atmMaterial);
    scene.add(atmosphere);

  // Animation
  function animate() {
    requestAnimationFrame(animate);
    kerbin.rotation.y += 0.001;
    clouds.rotation.y += 0.0009; // rotation des nuages, légèrement plus lente
    
    // Effet de tonalité animé (pulse subtle)
    const tExposure = Date.now() * 0.0002;
    renderer.toneMappingExposure = 1.0 + Math.sin(tExposure) * 0.3;

    // Éclairage cinématique: soleil tourne
    const tLight = Date.now() * 0.0001;
    dirLight.position.set(Math.sin(tLight)*5, 3, Math.cos(tLight)*5);
    dirLight.intensity = 0.6 + 0.4 * Math.sin(tLight);

    renderer.render(scene, camera);
  }
  animate();

  // Réponse au redimensionnement
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  });
})();
