// Utilitários de interface: escape de HTML, formatação, toasts e modais.

// ---------- Escape de HTML ----------
const MAPA_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAPA_HTML[c]);

function conv(v) {
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(conv).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}

// Template tag: todo valor interpolado é escapado, exceto resultados de outro html``/raw().
export function html(partes, ...valores) {
  let saida = '';
  partes.forEach((p, i) => {
    saida += p;
    if (i < valores.length) saida += conv(valores[i]);
  });
  return new Safe(saida);
}

export const raw = (s) => new Safe(String(s));

export function mount(el, conteudo) {
  el.innerHTML = conteudo instanceof Safe ? conteudo.s : esc(conteudo);
}

let contador = 0;
export const uid = () => `u${++contador}`;

// ---------- Erros ----------
export class ErroForm extends Error {
  constructor(mensagens) {
    const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
    super(lista.join(' '));
    this.mensagens = lista;
  }
}

export const mensagensDe = (e) => (e && e.mensagens ? e.mensagens : [(e && e.message) || 'Ocorreu um erro inesperado.']);

// ---------- Formatação (pt-BR, horário de Brasília) ----------
const TZ = 'America/Sao_Paulo';
const fData = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fLocalInput = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const fmtData = (iso) => (iso ? fData.format(new Date(iso)) : '—');
export const fmtHora = (iso) => (iso ? fHora.format(new Date(iso)) : '—');
export const fmtDataHora = (iso) => (iso ? `${fmtData(iso)} ${fmtHora(iso)}` : '—');

export function fmtPeriodo(inicio, fim) {
  if (!inicio) return '—';
  if (!fim) return fmtDataHora(inicio);
  if (fmtData(inicio) === fmtData(fim)) return `${fmtData(inicio)}, ${fmtHora(inicio)} às ${fmtHora(fim)}`;
  return `${fmtDataHora(inicio)} até ${fmtDataHora(fim)}`;
}

// Converte um instante em "YYYY-MM-DDTHH:mm" no horário de Brasília (valor de datetime-local).
export const paraInputLocal = (iso) => fLocalInput.format(new Date(iso)).replace(' ', 'T');

export const fmtHoras = (n) => `${Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
export const fmtNumero = (n) => Number(n || 0).toLocaleString('pt-BR');

// Aceita taxa como fração (0..1) ou percentual (0..100).
export function fmtTaxa(t) {
  if (t === null || t === undefined) return '—';
  const v = Number(t) > 1 ? Number(t) : Number(t) * 100;
  return `${Math.round(v)}%`;
}

export const resumir = (txt, max = 120) => {
  const s = String(txt ?? '');
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

export const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const PERFIS = { voluntario: 'Voluntário', gestor: 'Gestor', administrador: 'Administrador' };

const SITUACOES = {
  sugerida: ['info', 'Sugerida'],
  confirmada: ['primary', 'Confirmada'],
  recusada: ['secondary', 'Recusada'],
  selecionada: ['success', 'Selecionada'],
  compareceu: ['success', 'Compareceu'],
  faltou: ['danger', 'Faltou'],
  cancelada: ['secondary', 'Cancelada'],
  aberta: ['success', 'Aberta'],
  concluida: ['primary', 'Concluída'],
  ativo: ['success', 'Ativo'],
  inativo: ['secondary', 'Inativo'],
  excluido: ['dark', 'Excluído'],
};

export function badge(situacao) {
  const [cor, rotulo] = SITUACOES[situacao] || ['secondary', situacao];
  return html`<span class="pill pill-${cor}"><span class="ponto" aria-hidden="true"></span>${rotulo}</span>`;
}

// ---------- Blocos de interface ----------
// Esqueleto de carregamento (a mensagem fica disponível para leitores de tela).
export const spinner = (msg = 'Carregando…') =>
  html`<div class="sk-bloco" role="status"><span class="visually-hidden">${msg}</span>
    <div class="sk sk-titulo"></div>
    <div class="row g-3">
      <div class="col-12 col-md-6 col-xl-4"><div class="sk sk-card"></div></div>
      <div class="col-12 col-md-6 col-xl-4 d-none d-md-block"><div class="sk sk-card"></div></div>
      <div class="col-xl-4 d-none d-xl-block"><div class="sk sk-card"></div></div>
    </div></div>`;

// Estado vazio ilustrado.
export const vazio = (msg, icone = 'bi-inbox') =>
  html`<div class="vazio"><div class="vazio-ilustra">
    <svg viewBox="0 0 148 124" aria-hidden="true">
      <defs><linearGradient id="vz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a3d" stop-opacity=".35"/><stop offset="1" stop-color="#2f6fed" stop-opacity=".28"/></linearGradient></defs>
      <ellipse cx="74" cy="64" rx="60" ry="52" fill="url(#vz)"/>
      <circle cx="74" cy="64" r="38" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="2" stroke-dasharray="4 6"/>
      <path d="M20 26c3-5 9-3 9 2 0-5 6-7 9-2 3 6-5 11-9 15-4-4-12-9-9-15z" fill="#ff5e62" opacity=".75"/>
      <path d="M118 88c2-4 7-2 7 2 0-4 5-5 7-2 2 5-4 9-7 12-3-3-9-7-7-12z" fill="#2f6fed" opacity=".6"/>
      <circle cx="126" cy="30" r="4" fill="#22c7b8"/><circle cx="16" cy="92" r="3" fill="#ff9a3d"/>
    </svg>
    <i class="bi ${icone}" aria-hidden="true"></i></div>
    <p>${msg}</p></div>`;

export const alerta = (tipo, msg) => html`<div class="alert alert-${tipo}" role="alert">${msg}</div>`;

const SUBTITULOS = {
  Oportunidades: 'Ações compatíveis com o seu perfil, prontas para você responder.',
  Notificações: 'Avisos sobre oportunidades, seleções e mudanças nas ações.',
  'Meu histórico': 'Suas ações, horas voluntariadas e certificados.',
  'Meu perfil': 'Seus dados, áreas de interesse, disponibilidade e privacidade.',
  Demandas: 'Ações da cidade que precisam de voluntários.',
  'Painel de indicadores': 'Um retrato do engajamento da cidade, em tempo real.',
  'Relatório de engajamento': 'Voluntários, horas e presenças por área, região e período.',
  'Usuários e perfis': 'Quem acessa o sistema e com qual perfil.',
  'Áreas e regiões': 'Os cadastros que alimentam perfis, demandas e o cruzamento.',
  Configurações: 'Pontuação do cruzamento, retenção de dados e identidade da organização.',
};

export const cabecalhoPagina = (titulo, acoes = '', subtitulo = SUBTITULOS[titulo]) =>
  html`<div class="pag-cab">
    <div><h1 tabindex="-1">${titulo}</h1>${subtitulo ? html`<p>${subtitulo}</p>` : ''}</div>
    <div class="acoes">${acoes}</div>
  </div>`;

// ---------- Toasts ----------
const ICONES_TOAST = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

export function toast(msg, tipo = 'success') {
  const area = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo} border-0`;
  el.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
  const fechar = tipo === 'warning' ? 'btn-close' : 'btn-close btn-close-white';
  mount(el, html`<div class="d-flex"><div class="toast-body"><i class="bi ${ICONES_TOAST[tipo] || ICONES_TOAST.info}" aria-hidden="true"></i><span>${msg}</span></div><button type="button" class="${fechar} me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button></div>`);
  area.append(el);
  const t = new bootstrap.Toast(el, { delay: tipo === 'danger' ? 7000 : 4000 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

// ---------- Formulários ----------
export function validarForm(form) {
  form.classList.add('was-validated');
  const ok = form.checkValidity();
  if (!ok) {
    const invalido = form.querySelector(':invalid');
    if (invalido) invalido.focus();
  }
  return ok;
}

export function mostrarErros(container, mensagens) {
  const alvo = container.querySelector('[data-erros]');
  if (!alvo) return;
  if (!mensagens || !mensagens.length) {
    alvo.innerHTML = '';
    return;
  }
  mount(alvo, html`<div class="alert alert-danger" role="alert">${mensagens.length === 1
    ? mensagens[0]
    : html`<ul class="mb-0 ps-3">${mensagens.map((m) => html`<li>${m}</li>`)}</ul>`}</div>`);
}

// Liga o envio do formulário: valida, bloqueia o botão e mostra erros da API.
export function aoEnviar(form, fn, { botao } = {}) {
  form.noValidate = true;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!validarForm(form)) return;
    const btn = botao || form.querySelector('button[type=submit]');
    mostrarErros(form, []);
    if (btn) btn.disabled = true;
    try {
      await fn(form);
    } catch (e) {
      mostrarErros(form, mensagensDe(e));
      const alvo = form.querySelector('[data-erros]');
      if (alvo) alvo.scrollIntoView({ block: 'nearest' });
    } finally {
      if (btn && btn.isConnected) btn.disabled = false;
    }
  });
}

export const lerForm = (form) => Object.fromEntries(new FormData(form));

// Executa uma ação disparada por botão, mostrando erro em toast.
export async function executar(botao, fn) {
  if (botao) botao.disabled = true;
  try {
    return await fn();
  } catch (e) {
    toast(mensagensDe(e).join(' '), 'danger');
    return undefined;
  } finally {
    if (botao && botao.isConnected) botao.disabled = false;
  }
}

// ---------- Modais ----------
export function abrirModal({ titulo, corpo, rodape, grande = false, icone = '', tom = '' }) {
  const id = uid();
  const el = document.createElement('div');
  el.className = `modal fade ${tom ? `modal-${tom}` : ''}`;
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', `${id}t`);
  el.setAttribute('aria-hidden', 'true');
  mount(el, html`<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${grande ? 'modal-lg' : ''}">
    <div class="modal-content">
      <div class="modal-header">
        ${icone ? html`<span class="modal-icone" aria-hidden="true"><i class="bi ${icone}"></i></span>` : ''}
        <h2 class="modal-title fs-5" id="${id}t">${titulo}</h2>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
      </div>
      <div class="modal-body">${corpo}</div>
      ${rodape ? html`<div class="modal-footer">${rodape}</div>` : ''}
    </div>
  </div>`);
  document.body.append(el);
  const modal = new bootstrap.Modal(el);
  el.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    el.remove();
  });
  modal.show();
  return { el, fechar: () => modal.hide() };
}

export function confirmar({ titulo = 'Confirmar', mensagem, ok = 'Confirmar', perigo = false }) {
  return new Promise((resolve) => {
    const m = abrirModal({
      titulo,
      icone: perigo ? 'bi-exclamation-triangle-fill' : 'bi-question-lg',
      tom: perigo ? 'perigo' : '',
      corpo: html`<p class="mb-0">${mensagem}</p>`,
      rodape: html`<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" data-ok>${ok}</button>`,
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      resolve(true);
      m.fechar();
    });
    m.el.addEventListener('hidden.bs.modal', () => resolve(false));
  });
}

// Modal com formulário. aoSalvar(form, modal) pode retornar false para manter o modal aberto.
export function modalFormulario({ titulo, corpo, ok = 'Salvar', perigo = false, grande = false, aoSalvar }) {
  const fid = uid();
  const m = abrirModal({
    titulo,
    grande,
    icone: perigo ? 'bi-exclamation-triangle-fill' : 'bi-pencil-square',
    tom: perigo ? 'perigo' : '',
    corpo: html`<form id="${fid}" novalidate><div data-erros></div>${corpo}</form>`,
    rodape: html`<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" form="${fid}" class="btn ${perigo ? 'btn-danger' : 'btn-primary'}">${ok}</button>`,
  });
  const form = m.el.querySelector('form');
  aoEnviar(form, async (f) => {
    const r = await aoSalvar(f, m);
    if (r !== false) m.fechar();
  }, { botao: m.el.querySelector('button[type=submit]') });
  return m;
}
