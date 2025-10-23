// script.js moved to js/ directory
// ======================== MAPA ========================
const map = L.map('map').setView([-23.5015, -47.4526], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

let pontos = [];
let markers = [];
let userMarker = null;
let coverageCircle = null;
let regioesSet = new Set();

function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizaTexto(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function normalizaColuna(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
}

function carregarCSV() {
  Papa.parse('data/pontos-de-coleta.csv?v=' + Date.now(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimitersToGuess: [",", ";"],
    complete: function (results) {
      if (!results.data || results.data.length === 0) {
        alert('Nenhum dado encontrado no CSV.');
        return;
      }
      const colunas = Object.keys(results.data[0]);
      let mapaColunas = {};
      colunas.forEach(c => {
        const key = normalizaColuna(c);
        if (key.includes('latitude')) mapaColunas.lat = c;
        if (key.includes('longitude')) mapaColunas.lon = c;
        if (key.includes('regiao')) mapaColunas.regiao = c;
        if (key.includes('nome')) mapaColunas.nome = c;
        if (key.includes('endereco')) mapaColunas.endereco = c;
        if (key.includes('bairro')) mapaColunas.bairro = c;
        if (key.includes('categoria')) mapaColunas.categoria = c;
        if (key.includes('horario')) mapaColunas.horario = c;
      });

      pontos = results.data.filter(p => {
        const lat = parseFloat((p[mapaColunas.lat] || '').toString().replace(',', '.'));
        const lon = parseFloat((p[mapaColunas.lon] || '').toString().replace(',', '.'));
        return !isNaN(lat) && !isNaN(lon);
      }).map(p => {
        const lat = parseFloat((p[mapaColunas.lat] || '').toString().replace(',', '.'));
        const lon = parseFloat((p[mapaColunas.lon] || '').toString().replace(',', '.'));
        const regiao = p[mapaColunas.regiao] || '-';
        regioesSet.add(regiao);
        return { lat, lon, nome: p[mapaColunas.nome] || 'Ponto de Coleta', endereco: p[mapaColunas.endereco] || '-', bairro: p[mapaColunas.bairro] || '-', regiao, categoria: p[mapaColunas.categoria] || '-', horario: p[mapaColunas.horario] || 'Não informado', original: p };
      });

      atualizarFiltroRegioes();
      adicionarPinos();
    },
    error: function (err) { console.error('Erro ao carregar CSV:', err); alert('Erro ao carregar CSV.'); }
  });
}

function atualizarFiltroRegioes() {
  const select = document.getElementById('regiaoSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Todas</option>';
  const regioesLogicas = ["Centro", "Norte", "Sul", "Leste", "Oeste"];
  let cidades = [];
  let regioes = [];
  Array.from(regioesSet).forEach(item => {
    if (regioesLogicas.includes(item)) regioes.push(item); else cidades.push(item);
  });
  regioesLogicas.forEach(regiao => { if (regioes.includes(regiao)) { const opt = document.createElement('option'); opt.value = regiao; opt.textContent = regiao; select.appendChild(opt); } });
  cidades.sort().forEach(cidade => { const opt = document.createElement('option'); opt.value = cidade; opt.textContent = cidade; select.appendChild(opt); });
}

function adicionarPinos(filtro = {}) {
  markers.forEach(m => map.removeLayer(m)); markers = [];
  const regiaoFiltrada = filtro.regiao || ''; const distanciaFiltrada = filtro.distancia; const userLat = filtro.userLat; const userLon = filtro.userLon;
  pontos.forEach(ponto => {
    if (regiaoFiltrada && regiaoFiltrada !== '' && regiaoFiltrada !== 'Todas') { if (normalizaTexto(ponto.regiao) !== normalizaTexto(regiaoFiltrada)) return; }
    else if (distanciaFiltrada && userLat != null && userLon != null) { const d = distanciaKm(userLat, userLon, ponto.lat, ponto.lon); if (d > distanciaFiltrada) return; }
    const marker = L.marker([ponto.lat, ponto.lon]).addTo(map);
    marker.bindPopup(`<b>${ponto.nome}</b><br>${ponto.bairro}`);
    marker.on('click', () => abrirSidebar(ponto));
    markers.push(marker);
  });
}

function abrirSidebar(ponto) {
  const sidebar = document.getElementById('sidebar'); sidebar.innerHTML = '';
  const closeBtn = document.createElement('button'); closeBtn.className = 'close-btn'; closeBtn.textContent = '✖'; closeBtn.addEventListener('click', () => { sidebar.classList.remove('active'); document.body.classList.remove('sidebar-open'); });
  let buscaMaps = ponto.nome; if (ponto.endereco && ponto.endereco !== '-') buscaMaps += ' ' + ponto.endereco; if (ponto.bairro && ponto.bairro !== '-') buscaMaps += ' ' + ponto.bairro; buscaMaps += ' Sorocaba SP';
  const googleLink = buscaMaps.trim() !== '' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buscaMaps)}` : (!isNaN(ponto.lat) && !isNaN(ponto.lon)) ? `https://www.google.com/maps/search/?api=1&query=${ponto.lat},${ponto.lon}` : '';
  const content = document.createElement('div'); content.id = 'sidebar-content'; content.innerHTML = `
    <h2>${ponto.nome}</h2>
    <h3>${ponto.categoria}</h3>
    <div class="sidebar-block">
      <strong>Endereço completo:</strong>
      <p>${ponto.endereco}${ponto.bairro && ponto.bairro !== '-' ? ' - ' + ponto.bairro : ''}</p>
    </div>
    <div class="sidebar-block horario">
      <strong>Horário de funcionamento:</strong>
      <p>${ponto.horario}</p>
    </div>
    <a href="${googleLink}" target="_blank" rel="noopener" class="sidebar-btn-gmaps">📍 Ver no Google Maps</a>
  `;
  sidebar.appendChild(closeBtn); sidebar.appendChild(content); sidebar.classList.add('active'); document.body.classList.add('sidebar-open');
}

map.on('click', () => { document.getElementById('sidebar').classList.remove('active'); document.body.classList.remove('sidebar-open'); if (coverageCircle) map.removeLayer(coverageCircle); });

document.addEventListener('DOMContentLoaded', carregarCSV);

document.getElementById('buscarCEP')?.addEventListener('click', () => {
  const cep = (document.getElementById('cepInput')?.value || '').replace(/\D/g, '');
  if (cep.length !== 8) { alert('Digite um CEP válido!'); return; }
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cep}+Brazil`).then(resp => resp.json()).then(data => {
    if (!data || data.length === 0) { alert('CEP não encontrado!'); return; }
    const lat = parseFloat(data[0].lat); const lon = parseFloat(data[0].lon); if (isNaN(lat) || isNaN(lon)) { alert('Não foi possível localizar o CEP.'); return; }
    map.setView([lat, lon], 14);
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lon], { icon: L.icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png', iconSize: [32,32], iconAnchor: [16,32] }) }).addTo(map).bindPopup('📍 Você está aqui').openPopup();
    const distancia = parseInt(document.querySelector('input[name="distancia"]:checked')?.value || '1');
    if (coverageCircle) map.removeLayer(coverageCircle);
    coverageCircle = L.circle([lat, lon], { radius: distancia * 1000, color: '#2c7a7b', fillColor: '#38b2ac', fillOpacity: 0.2, weight: 2 }).addTo(map);
    adicionarPinos({ distancia, userLat: lat, userLon: lon });
  }).catch(err => { console.error(err); alert('Erro ao buscar o CEP. Tente novamente.'); });
});

document.getElementById('regiaoSelect')?.addEventListener('change', e => {
  const distancia = parseInt(document.querySelector('input[name="distancia"]:checked')?.value || '1');
  const userLat = userMarker ? userMarker.getLatLng().lat : null; const userLon = userMarker ? userMarker.getLatLng().lng : null; adicionarPinos({ regiao: e.target.value, distancia, userLat, userLon });
});

document.querySelectorAll('input[name="distancia"]').forEach(radio => { radio.addEventListener('change', e => { const distancia = parseInt(e.target.value); const regiao = document.getElementById('regiaoSelect')?.value; const userLat = userMarker ? userMarker.getLatLng().lat : null; const userLon = userMarker ? userMarker.getLatLng().lng : null; adicionarPinos({ regiao, distancia, userLat, userLon }); if (coverageCircle) map.removeLayer(coverageCircle); if (userMarker) { const { lat, lng } = userMarker.getLatLng(); coverageCircle = L.circle([lat, lng], { radius: distancia * 1000, color: '#2c7a7b', fillColor: '#38b2ac', fillOpacity: 0.2, weight: 2 }).addTo(map); } }); });
