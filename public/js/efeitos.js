// Efeitos de interface: tema claro/escuro, spotlight, ondulação, contadores, revelar ao rolar.
// Tudo respeita prefers-reduced-motion.

export const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Tema ----------
export const temaAtual = () => document.documentElement.getAttribute('data-bs-theme') || 'light';

export function ajustarGraficos() {
  if (typeof Chart === 'undefined') return;
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.font.family = css.getPropertyValue('--fonte').trim() || 'sans-serif';
  Chart.defaults.color = css.getPropertyValue('--texto-suave').trim();
  Chart.defaults.borderColor = temaAtual() === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(27,34,51,.08)';
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute('data-bs-theme', tema);
  try { localStorage.setItem('tema', tema); } catch { /* sem armazenamento: vale só nesta visita */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'dark' ? '#0d1120' : '#fff7ee');
  ajustarGraficos();
  document.dispatchEvent(new CustomEvent('tema', { detail: tema }));
}

// ---------- Números ----------
const fmt = (n, dec) => n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function animarNumero(el, alvo, { dec = 0, prefixo = '', sufixo = '', duracao = 1300 } = {}) {
  if (reduzido() || !(alvo > 0)) {
    el.textContent = `${prefixo}${fmt(alvo, dec)}${sufixo}`;
    return;
  }
  const inicio = performance.now();
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / duracao);
    const suave = t === 1 ? 1 : 1 - 2 ** (-10 * t);
    el.textContent = `${prefixo}${fmt(alvo * suave, dec)}${sufixo}`;
    if (t < 1 && el.isConnected) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

// Lê um texto já formatado em pt-BR ("1.234", "2,5 h", "100%") e devolve as partes.
function lerNumero(texto) {
  const m = String(texto).trim().match(/^(\D*?)(\d[\d.,]*)(.*)$/);
  if (!m) return null;
  const [, prefixo, num, sufixo] = m;
  const dec = num.includes(',') ? num.split(',')[1].length : 0;
  const alvo = Number(num.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(alvo) ? { prefixo, sufixo, dec, alvo } : null;
}

// ---------- Observadores ----------
let entrada = null;

function observadorDeEntrada() {
  if (entrada) return entrada;
  entrada = new IntersectionObserver((itens) => {
    for (const item of itens) {
      if (!item.isIntersecting) continue;
      const el = item.target;
      entrada.unobserve(el);
      el.classList.add('visto');
      if (el._contar) el._contar();
    }
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  return entrada;
}

/** Chama fn quando o elemento entra na tela (ou já, sem animação). */
export function aoEntrar(el, fn) {
  if (reduzido()) { fn(); return; }
  el._contar = fn;
  observadorDeEntrada().observe(el);
}

function medirRolagem(el) {
  const max = el.scrollWidth - el.clientWidth;
  el.classList.toggle('rolavel', max > 4);
  el.classList.toggle('inicio', el.scrollLeft <= 2);
  el.classList.toggle('fim', el.scrollLeft >= max - 2);
}

/** Prepara o que acabou de ser desenhado em `raiz`: revelar, contadores e rolagem das tabelas. */
export function prepararConteudo(raiz) {
  const obs = observadorDeEntrada();
  raiz.querySelectorAll('.reveal:not([data-ok]), .observar:not([data-ok])').forEach((el) => {
    el.dataset.ok = '1';
    if (reduzido()) el.classList.add('visto');
    else obs.observe(el);
  });

  raiz.querySelectorAll('.indicador .valor:not([data-ok])').forEach((el) => {
    el.dataset.ok = '1';
    const n = lerNumero(el.textContent);
    if (!n || !(n.alvo > 0) || reduzido()) return;
    el.textContent = `${n.prefixo}${fmt(0, n.dec)}${n.sufixo}`;
    aoEntrar(el, () => animarNumero(el, n.alvo, n));
  });

  raiz.querySelectorAll('.table-responsive').forEach((el) => {
    if (!el.dataset.rol) {
      el.dataset.rol = '1';
      el.addEventListener('scroll', () => medirRolagem(el), { passive: true });
    }
    medirRolagem(el);
  });
}

// ---------- Inicialização ----------
export function iniciarEfeitos() {
  ajustarGraficos();

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tema]');
    if (b) aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark');
  });

  // Cabeçalho ganha sombra e encolhe ao rolar.
  const topo = document.getElementById('topo');
  const aoRolar = () => topo.classList.toggle('rolado', window.scrollY > 14);
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  // Spotlight (brilho que segue o ponteiro) e botões magnéticos.
  let quadro = 0;
  let ultimo = null;
  document.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    ultimo = ev;
    if (quadro) return;
    quadro = requestAnimationFrame(() => {
      quadro = 0;
      const alvo = ultimo.target.closest && ultimo.target.closest('.card, .spot, .tile');
      if (alvo) {
        const r = alvo.getBoundingClientRect();
        alvo.style.setProperty('--mx', `${ultimo.clientX - r.left}px`);
        alvo.style.setProperty('--my', `${ultimo.clientY - r.top}px`);
      }
      if (reduzido()) return;
      document.querySelectorAll('.magnetico').forEach((m) => {
        const r = m.getBoundingClientRect();
        const dx = ultimo.clientX - (r.left + r.width / 2);
        const dy = ultimo.clientY - (r.top + r.height / 2);
        const perto = Math.hypot(dx, dy) < Math.max(r.width, 120) * 0.75;
        m.style.translate = perto ? `${(dx * 0.18).toFixed(1)}px ${(dy * 0.28).toFixed(1)}px` : '';
      });
    });
  }, { passive: true });

  // Ondulação discreta nos botões.
  document.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest && ev.target.closest('.btn');
    if (!b || b.disabled || reduzido()) return;
    const r = b.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const onda = document.createElement('span');
    onda.className = 'ripple';
    onda.style.cssText = `width:${d}px;height:${d}px;left:${ev.clientX - r.left - d / 2}px;top:${ev.clientY - r.top - d / 2}px`;
    b.append(onda);
    onda.addEventListener('animationend', () => onda.remove());
  });

  // Tabelas largas: reavalia as sombras de rolagem ao redimensionar.
  window.addEventListener('resize', () => document.querySelectorAll('.table-responsive').forEach(medirRolagem), { passive: true });

  // Tudo que as telas desenham dentro de #app é preparado automaticamente.
  const app = document.getElementById('app');
  let pendente = 0;
  new MutationObserver((mut) => {
    if (!mut.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1))) return;
    cancelAnimationFrame(pendente);
    pendente = requestAnimationFrame(() => prepararConteudo(app));
  }).observe(app, { childList: true, subtree: true });
  prepararConteudo(app);
}
