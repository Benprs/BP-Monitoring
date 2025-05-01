const ws = new WebSocket('ws://localhost:8085/datalink');
let streams = [];

ws.addEventListener('open', () => {
  console.log('WS connecté');
  // par défaut : catégorie Vol
  subscribe(['v.altitude','v.surfaceSpeed','v.missionTime'], 500);
});

ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.streams) {
    streams = msg.streams;
    renderCards();
    updateCharts();
  }
});

function subscribe(ids, rate) {
  ws.send(JSON.stringify({ '+': ids, rate }));
}

function renderCards() {
  const container = document.getElementById('cards');
  container.innerHTML = '';
  streams.forEach(s => {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `
      <h3 class="card-title">${s.name}</h3>
      <p class="card-value" id="val-${s.id}">${s.value}</p>
    `;
    container.appendChild(card);
  });
}

function updateCharts() {
  // à intégrer Chart.js pour les streams « plotable »
}

// Navigation catégories
Array.from(document.querySelectorAll('#sidebar button')).forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('#sidebar .active')?.classList.remove('active');
    btn.classList.add('active');
    // unsubscribe précédent, subscribe nouveau
    const cat = btn.dataset.cat;
    // map catégories → streams
    // subscribe([...], 500);
  });
});
