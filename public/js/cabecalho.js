import { api } from './api.js';
import { state } from './state.js';
import { html, mount, PERFIS } from './ui.js';
import { navegar } from './router.js';

const LOGO = html`<svg class="logo-marca" viewBox="0 0 40 40" role="img" aria-label="Logotipo do voluntariado municipal">
  <rect width="40" height="40" rx="9" fill="#ffffff" fill-opacity=".18"/>
  <path d="M20 30s-9-5.6-9-12.2A5.2 5.2 0 0 1 20 14.6a5.2 5.2 0 0 1 9 3.2C29 24.4 20 30 20 30z" fill="#fff"/>
</svg>`;

const MENUS = {
  voluntario: [
    ['#/oportunidades', 'Oportunidades'],
    ['#/notificacoes', 'Notificações', 'notif'],
    ['#/historico', 'Histórico'],
    ['#/perfil', 'Meu perfil'],
  ],
  gestor: [
    ['#/demandas', 'Demandas'],
    ['#/demandas/nova', 'Nova demanda'],
  ],
  administrador: [
    ['#/admin/painel', 'Painel'],
    ['#/admin/relatorios', 'Relatórios'],
    ['#/demandas', 'Demandas'],
    ['#/admin/usuarios', 'Usuários'],
    ['#/admin/catalogos', 'Áreas e regiões'],
    ['#/admin/config', 'Configurações'],
  ],
  publico: [
    ['#/login', 'Entrar'],
    ['#/cadastro', 'Quero ser voluntário'],
    ['#/validar', 'Validar certificado'],
  ],
};

function ativo(link, caminhoAtual) {
  const alvo = link.slice(1);
  if (alvo === '/demandas') return caminhoAtual === '/demandas';
  return caminhoAtual === alvo || caminhoAtual.startsWith(`${alvo}/`);
}

export function renderCabecalho(caminhoAtual = '') {
  const u = state.usuario;
  const itens = MENUS[u ? u.perfil : 'publico'] || [];
  const nome = state.config.nomeOrganizacao;

  mount(document.getElementById('topo'), html`<nav class="navbar navbar-expand-lg navbar-dark topo" aria-label="Navegação principal">
    <div class="container">
      <a class="navbar-brand d-flex align-items-center gap-2" href="#/">
        ${LOGO}
        <span class="lh-1"><strong>${nome}</strong><small class="d-block">Gestão de Voluntariado</small></span>
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu"
        aria-controls="menu" aria-expanded="false" aria-label="Alternar navegação">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="menu">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          ${itens.map(([link, rotulo, extra]) => html`<li class="nav-item">
            <a class="nav-link ${ativo(link, caminhoAtual) ? 'active' : ''}" href="${link}"
              ${ativo(link, caminhoAtual) ? html`aria-current="page"` : ''}>${rotulo}${extra === 'notif'
                ? html`<span class="badge text-bg-danger ms-1 ${state.naoLidas ? '' : 'd-none'}" id="badge-notif">${state.naoLidas}<span class="visually-hidden"> não lidas</span></span>`
                : ''}</a>
          </li>`)}
        </ul>
        ${u ? html`<div class="d-flex align-items-center gap-2 text-white">
          <span class="small">Olá, <strong>${u.nome}</strong> <span class="badge text-bg-light">${PERFIS[u.perfil]}</span></span>
          <button type="button" class="btn btn-outline-light btn-sm" id="btn-sair">Sair</button>
        </div>` : ''}
      </div>
    </div>
  </nav>`);

  const sair = document.getElementById('btn-sair');
  if (sair) {
    sair.addEventListener('click', async () => {
      try { await api.post('/auth/logout', {}, { semRedirecionar: true }); } catch { /* sessão já encerrada */ }
      state.usuario = null;
      state.naoLidas = 0;
      navegar('#/login');
    });
  }
}

export function renderRodape() {
  const nome = state.config.nomeOrganizacao;
  mount(document.getElementById('rodape'), html`<div class="container d-flex flex-wrap justify-content-between gap-2">
    <span>${nome}</span>
    <span>Sistema de Gestão de Voluntariado Municipal · © ${new Date().getFullYear()}</span>
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
  const b = document.getElementById('badge-notif');
  if (!b) return;
  b.firstChild.textContent = state.naoLidas;
  b.classList.toggle('d-none', !state.naoLidas);
}
