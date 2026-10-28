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
  return html`<span class="badge text-bg-${cor}">${rotulo}</span>`;
}

// ---------- Blocos de interface ----------
export const spinner = (msg = 'Carregando…') =>
  html`<div class="text-center text-muted py-5"><div class="spinner-border" role="status" aria-hidden="true"></div><p class="mt-2 mb-0">${msg}</p></div>`;

export const vazio = (msg, icone = 'bi-inbox') =>
  html`<div class="text-center text-muted py-5"><i class="bi ${icone} fs-1" aria-hidden="true"></i><p class="mt-2 mb-0">${msg}</p></div>`;

export const alerta = (tipo, msg) => html`<div class="alert alert-${tipo}" role="alert">${msg}</div>`;

export const cabecalhoPagina = (titulo, acoes = '') =>
  html`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <h1 class="h3 mb-0" tabindex="-1">${titulo}</h1>
    <div class="d-flex flex-wrap gap-2">${acoes}</div>
  </div>`;

// ---------- Toasts ----------
export function toast(msg, tipo = 'success') {
  const area = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo} border-0`;
  el.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
  const fechar = tipo === 'warning' ? 'btn-close' : 'btn-close btn-close-white';
  mount(el, html`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="${fechar} me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button></div>`);
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
export function abrirModal({ titulo, corpo, rodape, grande = false }) {
  const id = uid();
  const el = document.createElement('div');
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', `${id}t`);
  el.setAttribute('aria-hidden', 'true');
  mount(el, html`<div class="modal-dialog modal-dialog-scrollable ${grande ? 'modal-lg' : ''}">
    <div class="modal-content">
      <div class="modal-header">
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
