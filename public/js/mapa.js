// Mapa das oportunidades (Leaflet + mapa base da Esri) e rota até o local (OSRM).
// Leaflet é carregado sob demanda: só quem abre o mapa baixa a biblioteca.
import { html, mount, alerta, fmtPeriodo } from './ui.js';

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
const BRASIL = { centro: [-14.2, -51.9], zoom: 4 };
let carregando = null;

export function carregarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${LEAFLET}/leaflet.min.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${LEAFLET}/leaflet.min.js`;
    js.onload = () => resolve(window.L);
    js.onerror = () => { carregando = null; reject(new Error('Não foi possível carregar o mapa. Verifique sua conexão.')); };
    document.head.appendChild(js);
  });
  return carregando;
}

export const temCoordenadas = (o) => Number.isFinite(o.latitude) && Number.isFinite(o.longitude);

/** Link de navegação do Google Maps (origem opcional: sem ela o app usa a posição do aparelho). */
export function linkNavegacao(o, origem) {
  const p = new URLSearchParams({ api: '1', destination: `${o.latitude},${o.longitude}`, travelmode: 'driving' });
  if (origem) p.set('origin', `${origem.lat},${origem.lng}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

function minhaPosicao() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu navegador não informa a localização.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1
        ? 'Permita o acesso à sua localização para traçar a rota.'
        : 'Não foi possível obter sua localização agora.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

async function calcularRota(origem, destino) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.longitude},${destino.latitude}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Serviço de rotas indisponível no momento.');
  const dados = await r.json();
  const rota = dados.routes && dados.routes[0];
  if (!rota) throw new Error('Não encontramos um caminho de carro até este local.');
  return {
    pontos: rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    km: rota.distance / 1000,
    minutos: rota.duration / 60,
  };
}

const fmtKm = (km) => `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
const fmtMin = (m) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);

const popup = (o) => html`<div class="popup-vaga">
  ${o.area ? html`<span class="popup-area ${o.mesmaArea ? 'sua' : ''}">${o.mesmaArea ? html`<i class="bi bi-heart-fill" aria-hidden="true"></i> ` : ''}${o.area}</span>` : ''}
  <strong class="popup-titulo">${o.titulo}</strong>
  ${o.organizacao ? html`<div class="popup-org">${o.organizacao}</div>` : ''}
  <div class="popup-info"><i class="bi bi-geo-alt" aria-hidden="true"></i><span>${o.local}</span></div>
  <div class="popup-info"><i class="bi bi-calendar-event" aria-hidden="true"></i><span>${fmtPeriodo(o.dataInicio, o.dataFim)}</span></div>
  <div class="d-flex flex-wrap gap-2 mt-3">
    <button type="button" class="btn btn-primary btn-sm" data-rota="${o.idDemanda}"><i class="bi bi-sign-turn-right" aria-hidden="true"></i> Traçar rota</button>
    <a class="btn btn-outline-secondary btn-sm" href="#/oportunidades/demanda/${o.idDemanda}">Detalhes</a>
  </div>
</div>`;

/**
 * Desenha o mapa em `alvo` com um marcador por oportunidade e o painel de rota.
 * Devolve uma função de limpeza (remove o mapa).
 */
export async function montarMapa(alvo, itens, { alturaClasse = 'mapa-vagas', unico = false } = {}) {
  const comLugar = itens.filter(temCoordenadas);
  const semLugar = itens.length - comLugar.length;

  mount(alvo, html`<div class="mapa-caixa">
      <div class="${alturaClasse}" data-mapa role="region" aria-label="Mapa das oportunidades"></div>
      <div class="painel-rota card shadow-sm d-none" data-painel aria-live="polite"></div>
    </div>
    ${!unico && semLugar ? html`<p class="small text-muted mt-2">${semLugar} ${semLugar === 1 ? 'ação não aparece' : 'ações não aparecem'} no mapa (online ou sem endereço localizado). Veja na aba "Todas as oportunidades".</p>` : ''}`);

  let L;
  try {
    L = await carregarLeaflet();
  } catch (e) {
    mount(alvo, alerta('danger', e.message));
    return () => {};
  }

  const caixaMapa = alvo.querySelector('[data-mapa]');
  const painel = alvo.querySelector('[data-painel]');
  const mapa = L.map(caixaMapa, { scrollWheelZoom: !unico }).setView(BRASIL.centro, BRASIL.zoom);
  // Mapa base da Esri (sem chave): ruas coloridas no tema claro; cinza-escuro com rótulos no escuro.
  const esri = (servico) => `https://server.arcgisonline.com/ArcGIS/rest/services/${servico}/MapServer/tile/{z}/{y}/{x}`;
  const CAMADAS = {
    light: ['World_Street_Map'],
    dark: ['Canvas/World_Dark_Gray_Base', 'Canvas/World_Dark_Gray_Reference'],
  };
  let camadasBase = [];
  function aplicarBase(tema) {
    camadasBase.forEach((c) => c.remove());
    camadasBase = CAMADAS[tema === 'dark' ? 'dark' : 'light'].map((s, i) => L.tileLayer(esri(s), {
      maxZoom: tema === 'dark' ? 16 : 19,
      attribution: i ? '' : 'Mapa &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa));
    mapa.setMaxZoom(tema === 'dark' ? 16 : 19);
  }
  aplicarBase(document.documentElement.getAttribute('data-bs-theme'));
  const aoTrocarTema = (ev) => aplicarBase(ev.detail);
  document.addEventListener('tema', aoTrocarTema);

  const icone = (cor) => L.divIcon({ className: 'pino-vaga', html: `<span style="--cor:${cor}"></span>`, iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -28] });
  const porId = new Map(comLugar.map((o) => [String(o.idDemanda), o]));
  const marcadores = comLugar.map((o) => {
    const m = L.marker([o.latitude, o.longitude], { icon: icone(o.mesmaArea ? '#ff5e62' : '#2f6fed'), title: o.titulo, alt: o.titulo });
    const conteudo = document.createElement('div');
    mount(conteudo, popup(o));
    m.bindPopup(conteudo, { maxWidth: 280 });
    return m.addTo(mapa);
  });
  if (marcadores.length) {
    const grupo = L.featureGroup(marcadores);
    if (marcadores.length === 1) mapa.setView(marcadores[0].getLatLng(), 15);
    else mapa.fitBounds(grupo.getBounds().pad(0.15));
    if (unico) marcadores[0].openPopup();
  }

  let camadaRota = null;
  let eu = null;

  async function tracar(o) {
    painel.classList.remove('d-none');
    mount(painel, html`<div class="card-body py-2 small"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Buscando sua localização e a melhor rota…</div>`);
    try {
      const origem = await minhaPosicao();
      const rota = await calcularRota(origem, o);
      if (camadaRota) camadaRota.remove();
      if (eu) eu.remove();
      camadaRota = L.polyline(rota.pontos, { color: '#ff5e62', weight: 5, opacity: 0.85 }).addTo(mapa);
      eu = L.circleMarker([origem.lat, origem.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f6fed', fillOpacity: 1 })
        .bindTooltip('Você está aqui').addTo(mapa);
      mapa.fitBounds(camadaRota.getBounds().pad(0.12));
      mount(painel, html`<div class="card-body py-2">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div><div class="small text-muted">Rota de carro até</div><strong>${o.titulo}</strong>
            <div class="fs-5 fw-bold">${fmtMin(rota.minutos)} <span class="fs-6 fw-normal text-muted">· ${fmtKm(rota.km)}</span></div></div>
          <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-primary btn-sm" href="${linkNavegacao(o, origem)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-cursor" aria-hidden="true"></i> Seguir no Google Maps</a>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-limpar>Limpar rota</button>
          </div>
        </div>
        <div class="small text-muted mt-1">No Google Maps você também pode escolher ir a pé ou de transporte público.</div>
      </div>`);
    } catch (e) {
      mount(painel, html`<div class="card-body py-2 small">${alerta('warning', e.message)}
        <a class="btn btn-primary btn-sm" href="${linkNavegacao(o)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-cursor" aria-hidden="true"></i> Abrir rota no Google Maps</a>
        <button type="button" class="btn btn-outline-secondary btn-sm" data-limpar>Fechar</button></div>`);
    }
  }

  alvo.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rota]');
    if (b) { mapa.closePopup(); tracar(porId.get(b.dataset.rota)); }
    if (ev.target.closest('[data-limpar]')) {
      if (camadaRota) camadaRota.remove();
      if (eu) eu.remove();
      camadaRota = null;
      eu = null;
      painel.classList.add('d-none');
    }
  });

  // O contêiner pode ter mudado de tamanho enquanto a biblioteca carregava.
  setTimeout(() => mapa.invalidateSize(), 50);
  return () => {
    document.removeEventListener('tema', aoTrocarTema);
    mapa.remove();
  };
}

