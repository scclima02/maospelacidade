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

const popup = (o, unico) => html`<div class="popup-vaga">
  ${o.area ? html`<span class="popup-area ${o.mesmaArea ? 'sua' : ''}">${o.mesmaArea ? html`<i class="bi bi-heart-fill" aria-hidden="true"></i> ` : ''}${o.area}</span>` : ''}
  <strong class="popup-titulo">${o.titulo}</strong>
  ${o.organizacao ? html`<div class="popup-org">${o.organizacao}</div>` : ''}
  <div class="popup-info"><i class="bi bi-geo-alt" aria-hidden="true"></i><span>${o.local}</span></div>
  <div class="popup-info"><i class="bi bi-calendar-event" aria-hidden="true"></i><span>${fmtPeriodo(o.dataInicio, o.dataFim)}</span></div>
  <div class="d-flex flex-wrap gap-2 mt-3">
    <button type="button" class="btn btn-primary btn-sm" data-rota="${o.idDemanda}"><i class="bi bi-sign-turn-right" aria-hidden="true"></i> Traçar rota</button>
    ${unico ? '' : html`<a class="btn btn-outline-secondary btn-sm" href="#/oportunidades/demanda/${o.idDemanda}">Detalhes</a>`}
  </div>
</div>`;

/**
 * Desenha o mapa em `alvo` com um marcador por oportunidade e o painel de rota.
 * Devolve uma função de limpeza (remove o mapa).
 */
export async function montarMapa(alvo, itens, { alturaClasse = 'mapa-vagas', unico = false } = {}) {
  const comLugar = itens.filter(temCoordenadas);
  const semLugar = itens.length - comLugar.length;

  mount(alvo, html`<div class="mapa-caixa ${unico ? 'compacta' : ''}">
      <div class="mapa-layout">
        <div class="${alturaClasse}" data-mapa role="region" aria-label="Mapa das oportunidades"></div>
        <div class="painel-rota card d-none" data-painel aria-live="polite"></div>
      </div>
      ${unico && comLugar.length ? html`<div class="rota-acoes" data-atalhos>
        <button type="button" class="btn btn-primary btn-sm" data-rota="${comLugar[0].idDemanda}"><i class="bi bi-sign-turn-right" aria-hidden="true"></i> Traçar rota até aqui</button>
        <a class="btn btn-outline-secondary btn-sm" href="${linkNavegacao(comLugar[0])}" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> Abrir no Google Maps</a>
      </div>` : ''}
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
  const atalhos = alvo.querySelector('[data-atalhos]');
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
    mount(conteudo, popup(o, unico));
    m.bindPopup(conteudo, { maxWidth: Math.min(280, Math.max(200, caixaMapa.clientWidth - 64)), autoPanPadding: [16, 16] });
    return m.addTo(mapa);
  });
  if (marcadores.length) {
    const grupo = L.featureGroup(marcadores);
    if (marcadores.length === 1) mapa.setView(marcadores[0].getLatLng(), 15);
    else mapa.fitBounds(grupo.getBounds().pad(0.15));
  }

  let camadaRota = null;
  let eu = null;

  // No celular o painel fica abaixo do mapa: rola até ele para o resultado não passar despercebido.
  function mostrarPainel() {
    const r = painel.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 96) painel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Com o painel ao lado o mapa muda de largura: o Leaflet precisa recalcular o tamanho.
  const ajustarMapa = () => mapa.invalidateSize();

  async function tracar(o) {
    painel.classList.remove('d-none');
    if (atalhos) atalhos.classList.add('d-none');
    ajustarMapa();
    mount(painel, html`<div class="card-body small"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Buscando sua localização e a melhor rota…</div>`);
    try {
      const origem = await minhaPosicao();
      const rota = await calcularRota(origem, o);
      if (camadaRota) camadaRota.remove();
      if (eu) eu.remove();
      camadaRota = L.polyline(rota.pontos, { color: '#ff5e62', weight: 5, opacity: 0.85 }).addTo(mapa);
      eu = L.circleMarker([origem.lat, origem.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f6fed', fillOpacity: 1 })
        .bindTooltip('Você está aqui').addTo(mapa);
      ajustarMapa();
      mapa.fitBounds(camadaRota.getBounds().pad(0.12));
      mount(painel, html`<div class="card-body">
        <div class="rota-resumo">
          <div class="rota-destino"><div class="small text-muted">Rota de carro até</div><strong>${o.titulo}</strong></div>
          <div class="rota-tempo">${fmtMin(rota.minutos)} <span>· ${fmtKm(rota.km)}</span></div>
        </div>
        <div class="rota-acoes">
          <a class="btn btn-primary btn-sm" href="${linkNavegacao(o, origem)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-cursor" aria-hidden="true"></i> Seguir no Google Maps</a>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-limpar><i class="bi bi-x-lg" aria-hidden="true"></i> Limpar rota</button>
        </div>
        <div class="small text-muted mt-2">No Google Maps você também pode escolher ir a pé ou de transporte público.</div>
      </div>`);
      mostrarPainel();
    } catch (e) {
      mount(painel, html`<div class="card-body small">${alerta('warning', e.message)}
        <div class="rota-acoes">
          <a class="btn btn-primary btn-sm" href="${linkNavegacao(o)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-cursor" aria-hidden="true"></i> Abrir rota no Google Maps</a>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-limpar>Fechar</button>
        </div></div>`);
      mostrarPainel();
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
      if (atalhos) atalhos.classList.remove('d-none');
      ajustarMapa();
    }
  });

  // O contêiner pode ter mudado de tamanho enquanto a biblioteca carregava.
  setTimeout(() => mapa.invalidateSize(), 50);
  return () => {
    document.removeEventListener('tema', aoTrocarTema);
    mapa.remove();
  };
}

