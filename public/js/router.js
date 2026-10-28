import { state } from './state.js';
import { html, mount, spinner, alerta, mensagensDe } from './ui.js';

let rotas = [];
let aoNavegar = () => {};
let versao = 0;
let limpezaAtual = [];

export const homePara = (perfil) => (
  { voluntario: '#/oportunidades', gestor: '#/demandas', administrador: '#/admin/painel' }[perfil] || '#/login'
);

export function definirRotas(lista) {
  rotas = lista.map((r) => {
    const nomes = [];
    const re = r.caminho.replace(/:([a-zA-Z]+)/g, (_, n) => {
      nomes.push(n);
      return '([^/]+)';
    });
    return { ...r, regex: new RegExp(`^${re}$`), nomes };
  });
}

export function navegar(hash) {
  if (location.hash === hash) rotear();
  else location.hash = hash;
}

function interpretarHash() {
  const bruto = (location.hash || '#/').slice(1);
  const [caminho, consulta = ''] = bruto.split('?');
  return { caminho: caminho || '/', query: Object.fromEntries(new URLSearchParams(consulta)) };
}

function resolver(caminho) {
  for (const r of rotas) {
    const m = r.regex.exec(caminho);
    if (m) {
      const params = {};
      r.nomes.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      return { rota: r, params };
    }
  }
  return null;
}

async function rotear() {
  const { caminho, query } = interpretarHash();
  const perfil = state.usuario && state.usuario.perfil;
  const alvo = resolver(caminho);

  // Raiz ou rota desconhecida: vai para a página inicial do perfil.
  if (!alvo) return navegar(perfil ? homePara(perfil) : '#/');
  const { rota, params } = alvo;

  if (!rota.publica && !perfil) return navegar('#/login');
  if (rota.soDeslogado && perfil) return navegar(homePara(perfil));
  if (rota.perfis && !rota.perfis.includes(perfil)) return navegar(homePara(perfil));

  const minha = ++versao;
  limpezaAtual.forEach((fn) => { try { fn(); } catch { /* ignora */ } });
  limpezaAtual = [];

  // Cada navegação ganha um contêiner próprio: telas lentas e obsoletas desenham fora da página.
  const raiz = document.getElementById('app');
  const el = document.createElement('div');
  mount(el, spinner());
  raiz.replaceChildren(el);
  aoNavegar({ caminho, rota });

  const ctx = { el, params, query, usuario: state.usuario, limpeza: limpezaAtual };
  try {
    await rota.tela(ctx);
  } catch (e) {
    if (minha !== versao) return;
    if (e && e.status === 401) return;
    mount(el, html`<div class="row justify-content-center"><div class="col-12 col-lg-8">
      ${alerta('danger', html`<strong>Não foi possível carregar esta página.</strong><br>${mensagensDe(e).join(' ')}`)}
      <button type="button" class="btn btn-outline-primary" id="tentar-de-novo">Tentar novamente</button>
    </div></div>`);
    const b = el.querySelector('#tentar-de-novo');
    if (b) b.addEventListener('click', rotear);
  }
  if (minha !== versao) return;

  const h1 = el.querySelector('h1');
  document.title = rota.titulo || `${h1 ? `${h1.textContent.trim()} — ` : ''}Mãos pela Cidade`;
  window.scrollTo(0, 0);
  if (h1) h1.focus({ preventScroll: true });
}

export function iniciarRouter(callback) {
  aoNavegar = callback;
  window.addEventListener('hashchange', rotear);
  rotear();
}
