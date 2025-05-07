// script.js
// Intégration Telemachus via WebSocket + affichage du temps de mission + jauges

document.addEventListener('DOMContentLoaded', () => {
  const timerEl = document.getElementById('timer');
  const WS_URL = 'ws://localhost:8085/datalink';

  // Ressources à surveiller
  const resources = [
    { name: 'LiquidFuel', id: 'fuel' },
    { name: 'Oxidizer', id: 'oxidizer' },
    { name: 'ElectricCharge', id: 'electric' }
  ];

  // Ouvre la connexion WebSocket
  const ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    const subscribe = { '+': [], rate: 1000 };
    // S'abonner à la mission time
    subscribe['+'].push('v.missionTime()');
    // S'abonner au current et max de chaque ressource
    resources.forEach(res => {
      subscribe['+'].push(`r.resource[${res.name}]`);
      subscribe['+'].push(`r.resourceMax[${res.name}]`);
    });
    ws.send(JSON.stringify(subscribe));
  });

  ws.addEventListener('message', evt => {
    console.log('WS message raw:', evt.data);
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch (err) {
      console.error('WS parse error:', err);
      return;
    }

    // Mise à jour du timer depuis v.missionTime()
    const mt = data['v.missionTime()'];
    if (mt !== undefined) {
      const sec = Math.floor(parseFloat(mt));
      const h = String(Math.floor(sec / 3600)).padStart(2, '0');
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      timerEl.textContent = `${h}:${m}:${s}`;
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
