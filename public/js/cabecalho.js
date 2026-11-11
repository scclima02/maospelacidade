import { api } from './api.js';
import { state } from './state.js';
import { html, mount, PERFIS } from './ui.js';
import { navegar } from './router.js';

export const NOME_PRODUTO = 'Mãos pela Cidade';
export const TAGLINE = 'Voluntariado comunitário';

// [link, rótulo, ícone, rótulo curto (dock), extra]
const MENUS = {
  voluntario: [
    ['#/oportunidades', 'Oportunidades', 'bi-search-heart', 'Vagas'],
    ['#/notificacoes', 'Notificações', 'bi-bell', 'Avisos', 'notif'],
    ['#/historico', 'Histórico', 'bi-clock-history', 'Histórico'],
    ['#/perfil', 'Meu perfil', 'bi-person-circle', 'Perfil'],
  ],
  gestor: [
    ['#/demandas', 'Demandas', 'bi-clipboard2-heart', 'Demandas'],
    ['#/demandas/nova', 'Nova demanda', 'bi-plus-circle', 'Nova'],
    ['#/oportunidades', 'Oportunidades', 'bi-search-heart', 'Vagas'],
    ['#/historico', 'Participações', 'bi-clock-history', 'Histórico'],
  ],
  administrador: [
    ['#/admin/painel', 'Painel', 'bi-speedometer2', 'Painel'],
    ['#/admin/relatorios', 'Relatórios', 'bi-file-earmark-bar-graph', 'Relatórios'],
    ['#/admin/usuarios', 'Usuários', 'bi-people', 'Usuários'],
    ['#/demandas', 'Demandas', 'bi-clipboard2-heart', 'Demandas'],
    ['#/oportunidades', 'Vagas', 'bi-search-heart', 'Vagas'],
    ['#/admin/catalogos', 'Áreas e regiões', 'bi-diagram-3', 'Áreas'],
    ['#/admin/config', 'Configurações', 'bi-sliders', 'Config'],
  ],
  publico: [
    ['#/', 'Início', 'bi-house-heart', 'Início'],
    ['#/login', 'Entrar', 'bi-box-arrow-in-right', 'Entrar'],
    ['#/cadastro', 'Quero ser voluntário', 'bi-heart-fill', 'Cadastrar', 'destaque'],
    ['#/validar', 'Validar certificado', 'bi-patch-check', 'Validar'],
  ],
};

// No celular o administrador tem mais itens do que cabem no dock: o excedente vai para "Mais".
const DOCK_ADMIN = 3;

export const marcaHtml = (classe = '') => html`<a class="marca ${classe}" href="#/">
  <img src="img/logo.svg" alt="" width="42" height="42">
  <span><strong>${NOME_PRODUTO}</strong><small>${TAGLINE}</small></span>
</a>`;

const botaoTema = html`<button type="button" class="btn-icone" data-tema aria-label="Alternar entre tema claro e escuro">
  <i class="bi bi-moon-stars-fill ico-claro" aria-hidden="true"></i><i class="bi bi-sun-fill ico-escuro" aria-hidden="true"></i>
</button>`;

const selo = (n) => html`<span class="badge-notif ${n ? '' : 'd-none'}" data-badge-notif><span data-n>${n}</span><span class="visually-hidden"> não lidas</span></span>`;

function ativo(link, caminhoAtual) {
  const alvo = link.slice(1);
  if (alvo === '/') return caminhoAtual === '/';
  if (alvo === '/demandas') return caminhoAtual === '/demandas';
  return caminhoAtual === alvo || caminhoAtual.startsWith(`${alvo}/`);
}

let chave = '';

function montar(u) {
  const perfil = u ? u.perfil : 'publico';
  const itens = MENUS[perfil] || [];
  const inicial = u ? (u.nome || '?').trim().charAt(0).toUpperCase() : '';

  let dock;
  let mais = [];
  if (perfil === 'administrador') {
    dock = itens.slice(0, DOCK_ADMIN);
    mais = itens.slice(DOCK_ADMIN);
  } else {
    dock = itens;
  }

  mount(document.getElementById('topo'), html`
    <nav class="nav-flutuante ${itens.length > 5 ? 'muitos' : ''}" aria-label="Navegação principal">
      ${marcaHtml()}
      <ul class="nav-links">
        ${itens.map(([link, rotulo, , , extra]) => html`<li><a href="${link}" data-rota="${link}" class="${extra === 'destaque' ? 'destaque' : ''}">${rotulo}${extra === 'notif' ? selo(state.naoLidas) : ''}</a></li>`)}
      </ul>
      <div class="nav-dir">
        ${botaoTema}
        ${u ? html`<div class="chip-usuario" title="${u.nome} · ${PERFIS[u.perfil]}"><span class="avatar" aria-hidden="true">${inicial}</span>
            <span><strong>${u.nome}</strong><small>${PERFIS[u.perfil]}</small></span></div>
          <button type="button" class="btn-icone sair" data-sair aria-label="Sair"><i class="bi bi-box-arrow-right" aria-hidden="true"></i></button>` : ''}
      </div>
    </nav>

    <div class="topo-movel">
      ${marcaHtml()}
      <div class="nav-dir">
        ${botaoTema}
        ${u ? html`<button type="button" class="btn-icone sair" data-sair aria-label="Sair"><i class="bi bi-box-arrow-right" aria-hidden="true"></i></button>` : ''}
      </div>
    </div>

    <nav class="dock" aria-label="Navegação principal">
      <span class="dock-ind" aria-hidden="true"></span>
      ${dock.map(([link, rotulo, icone, curto, extra]) => html`<a class="dock-item" href="${link}" data-rota="${link}" aria-label="${rotulo}">
        <i class="bi ${icone}" aria-hidden="true">${extra === 'notif' ? selo(state.naoLidas) : ''}</i><span>${curto}</span></a>`)}
      ${perfil === 'gestor' ? html`<button type="button" class="dock-item" data-sair aria-label="Sair"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Sair</span></button>` : ''}
      ${mais.length ? html`<button type="button" class="dock-item" data-mais aria-haspopup="true" aria-expanded="false" aria-controls="mais-sheet"><i class="bi bi-grid-fill" aria-hidden="true"></i><span>Mais</span></button>` : ''}
    </nav>
    ${mais.length ? html`<div class="mais-sheet" id="mais-sheet" inert>
      ${mais.map(([link, rotulo, icone]) => html`<a href="${link}" data-rota="${link}"><i class="bi ${icone}" aria-hidden="true"></i>${rotulo}</a>`)}
      <button type="button" data-sair><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Sair</button>
    </div>` : ''}`);
}

async function sair() {
  try { await api.post('/auth/logout', {}, { semRedirecionar: true }); } catch { /* sessão já encerrada */ }
  state.usuario = null;
  state.naoLidas = 0;
  navegar('#/login');
}

function alternarMais(abrir) {
  const folha = document.getElementById('mais-sheet');
  const botao = document.querySelector('[data-mais]');
  if (!folha || !botao) return;
  const vaiAbrir = abrir === undefined ? !folha.classList.contains('aberto') : abrir;
  folha.classList.toggle('aberto', vaiAbrir);
  folha.toggleAttribute('inert', !vaiAbrir);
  botao.setAttribute('aria-expanded', String(vaiAbrir));
}

function posicionarIndicador() {
  const dock = document.querySelector('.dock');
  const ind = dock && dock.querySelector('.dock-ind');
  if (!ind) return;
  const atual = dock.querySelector('.dock-item.ativo');
  if (!atual || !atual.offsetWidth) { ind.classList.remove('pronto'); return; }
  ind.style.setProperty('--ind-x', `${atual.offsetLeft}px`);
  ind.style.setProperty('--ind-w', `${atual.offsetWidth}px`);
  ind.classList.add('pronto');
}

function atualizarAtivos(caminhoAtual) {
  const topo = document.getElementById('topo');
  topo.querySelectorAll('[data-rota]').forEach((a) => {
    const on = ativo(a.dataset.rota, caminhoAtual);
    a.classList.toggle('ativo', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // "Mais" fica ativo quando a rota atual é um dos itens do menu extra.
  const maisAtivo = !!topo.querySelector('.mais-sheet [data-rota].ativo');
  const botaoMais = topo.querySelector('[data-mais]');
  if (botaoMais) botaoMais.classList.toggle('ativo', maisAtivo);
  alternarMais(false);
  requestAnimationFrame(posicionarIndicador);
}

let ligado = false;
function ligarEventos() {
  if (ligado) return;
  ligado = true;
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-sair]')) { sair(); return; }
    const m = ev.target.closest('[data-mais]');
    if (m) { alternarMais(); return; }
    if (!ev.target.closest('.mais-sheet')) alternarMais(false);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') alternarMais(false); });
  window.addEventListener('resize', posicionarIndicador, { passive: true });
}

export function renderCabecalho(caminhoAtual = '') {
  const u = state.usuario;
  const nova = `${u ? `${u.perfil}:${u.nome}` : 'publico'}`;
  if (nova !== chave) {
    chave = nova;
    montar(u);
  }
  ligarEventos();
  atualizarAtivos(caminhoAtual);
}

export function renderRodape() {
  const nome = state.config.nomeOrganizacao;
  mount(document.getElementById('rodape'), html`<div class="caixa">
    ${marcaHtml()}
    <span>Uma iniciativa da <strong>${nome}</strong></span>
    <span><a href="#/validar">Validar certificado</a> · © ${new Date().getFullYear()}</span>
  </div>`);
}

// Atualiza o contador de notificações não lidas (somente voluntários).
export async function atualizarBadge() {
  if (!state.usuario || state.usuario.perfil !== 'voluntario') return;
  try {
    const r = await api.get('/notificacoes/contagem', { semRedirecionar: true });
    state.naoLidas = r.naoLidas || 0;
  } catch {
    return;
  }
  document.querySelectorAll('[data-badge-notif]').forEach((b) => {
    b.querySelector('[data-n]').textContent = state.naoLidas;
    b.classList.toggle('d-none', !state.naoLidas);
  });
}
