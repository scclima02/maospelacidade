// Página inicial para visitantes (#/).
import { api } from './api.js';
import { state } from './state.js';
import { html, mount, raw } from './ui.js';
import { animarNumero, aoEntrar, reduzido } from './efeitos.js';

const ICONES_AREA = {
  educação: 'bi-mortarboard-fill',
  'meio ambiente': 'bi-tree-fill',
  'assistência social': 'bi-people-fill',
  saúde: 'bi-heart-pulse-fill',
  eventos: 'bi-calendar-event-fill',
  'esporte e lazer': 'bi-trophy-fill',
};
const iconeArea = (nome) => ICONES_AREA[String(nome).toLowerCase()] || 'bi-stars';

const feixes = (n) => raw(Array.from({ length: n }, (_, i) => {
  const x = 6 + (i * 88) / Math.max(1, n - 1);
  const larga = i % 3 === 1 ? ' larga' : '';
  const cor = i % 2 ? 'var(--beam2)' : 'var(--beam)';
  return `<i class="beam${larga}" style="--x:${x.toFixed(1)}%;--d:${7 + (i % 4) * 2}s;--atraso:${-(i * 1.7).toFixed(1)}s;--cor:${cor}"></i>`;
}).join(''));

const coracoes = raw(Array.from({ length: 7 }, (_, i) => `<i class="bi bi-heart-fill" style="--x:${8 + i * 13}%;--s:${1 + (i % 3) * 0.45}rem;--d:${8 + (i % 4) * 2}s;--atraso:${-i * 1.4}s"></i>`).join(''));
export const coracoesFlutuantes = coracoes;

const AREAS_PADRAO = ['Educação', 'Meio ambiente', 'Assistência social', 'Saúde', 'Eventos', 'Esporte e lazer'];

function trilha(nomes) {
  // Cada metade repete a lista para cobrir telas largas; a segunda metade é só decorativa.
  const metade = [...nomes, ...nomes];
  const item = (n, clone) => html`<span class="marquee-item vidro" ${clone ? raw('data-clone aria-hidden="true"') : ''}><i class="bi ${iconeArea(n)}" aria-hidden="true"></i>${n}</span>`;
  return html`${metade.map((n) => item(n, false))}${metade.map((n) => item(n, true))}`;
}

export function telaLanding({ el, limpeza }) {
  const org = state.config.nomeOrganizacao;

  mount(el, html`<div class="landing">
    <section class="hero">
      <div class="beams" aria-hidden="true">${feixes(7)}</div>
      <div class="secao-wrap hero-grade">
        <div class="hero-texto">
          <span class="selo"><i class="bi bi-heart-fill" aria-hidden="true"></i> Uma iniciativa da ${org}</span>
          <h1 tabindex="-1">Juntos, mudamos a cidade com <span class="grad">as próprias mãos.</span></h1>
          <p class="lead">Cadastre-se, diga quando pode ajudar e receba na hora as ações que combinam com você. Cada hora doada vira história, certificado e impacto real no seu bairro.</p>
          <div class="hero-cta">
            <a class="btn btn-primary btn-lg magnetico" href="#/cadastro">Quero ser voluntário <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
            <a class="btn btn-outline-secondary btn-lg" href="#/login">Entrar</a>
          </div>
          <ul class="hero-prova">
            <li><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Cadastro gratuito</li>
            <li><i class="bi bi-shield-check" aria-hidden="true"></i> Seus dados protegidos (LGPD)</li>
            <li><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Certificado em PDF</li>
          </ul>
        </div>

        <div class="hero-visual" data-parallax aria-hidden="true">
          <div class="halo"></div><div class="anel"></div><div class="anel dois"></div>
          <img class="hero-logo" src="img/logo.svg" alt="" width="240" height="240">
          <div class="flutuante f1"><div class="vidro cartao-mini"><span class="ic"><i class="bi bi-stars"></i></span>
            <div><small>Nova oportunidade compatível</small><strong>Oficina de leitura · 100 pts</strong></div></div></div>
          <div class="flutuante f2"><div class="vidro cartao-mini"><span class="ic azul"><i class="bi bi-patch-check-fill"></i></span>
            <div><small>Certificado emitido</small><strong>VOL-7F3A-9C21-B84E</strong></div></div></div>
          <div class="flutuante f3"><div class="vidro cartao-mini"><span class="ic turq"><i class="bi bi-clock-history"></i></span>
            <div><small>Suas horas voluntariadas</small><strong>12 h neste mês</strong><div class="barra-mini"><i></i></div></div></div></div>
        </div>
      </div>
    </section>

    <section class="secao-wrap">
      <div class="stats" id="stats">
        <div class="stat vidro spot reveal"><span class="stat-num" data-alvo="voluntarios">—</span><span class="stat-rot">voluntários ativos</span></div>
        <div class="stat vidro spot reveal" style="--atraso:.08s"><span class="stat-num" data-alvo="acoes">—</span><span class="stat-rot">ações concluídas</span></div>
        <div class="stat vidro spot reveal" style="--atraso:.16s"><span class="stat-num" data-alvo="horas">—</span><span class="stat-rot">horas doadas à cidade</span></div>
        <div class="stat vidro spot reveal" style="--atraso:.24s"><span class="stat-num" data-alvo="areas">—</span><span class="stat-rot">áreas de atuação</span></div>
      <p class="stat-nota" id="stat-nota" hidden>Estamos começando: seja um dos primeiros voluntários da sua cidade.</p>
    </section>

    <section aria-label="Áreas de atuação"><div class="marquee"><div class="marquee-trilha" id="trilha">${trilha(AREAS_PADRAO)}</div></div></section>

    <section class="secao-wrap">
      <div class="sec-cab reveal">
        <span class="sobre">Recursos</span>
        <h2>Tudo para a cidade e para quem ajuda, em um só lugar</h2>
        <p>Do primeiro cadastro ao certificado, o caminho do voluntário é simples, transparente e seguro.</p>
      </div>
      <div class="bento">
        <article class="tile t-a vidro spot reveal">
          <span class="ic"><i class="bi bi-bullseye" aria-hidden="true"></i></span>
          <h3>Cruzamento inteligente entre perfil e demanda</h3>
          <p>Área de interesse e horário disponível decidem quem é compatível. A região dá pontos a mais, sem excluir ninguém, e a taxa de comparecimento desempata.</p>
          <div class="ranking" aria-hidden="true">
            <div class="ranking-linha"><span class="av">M</span><div><strong>Maria Silva</strong><small>Centro · mesma região</small></div><span class="pts">100 pts</span><div class="ranking-barra"><i style="--w:100%"></i></div></div>
            <div class="ranking-linha"><span class="av">J</span><div><strong>João Souza</strong><small>Zona Sul · outra região</small></div><span class="pts">50 pts</span><div class="ranking-barra"><i style="--w:50%"></i></div></div>
            <div class="ranking-linha"><span class="av">A</span><div><strong>Ana Lima</strong><small>Zona Leste · outra região · 100% de presença</small></div><span class="pts">50 pts</span><div class="ranking-barra"><i style="--w:50%"></i></div></div>
          </div>
          <div class="chips" aria-hidden="true"><span><i class="bi bi-check-lg"></i> Área</span><span><i class="bi bi-check-lg"></i> Dia e horário</span><span><i class="bi bi-plus-lg"></i> Região pontua</span></div>
        </article>

        <article class="tile t-b vidro spot reveal" style="--atraso:.08s">
          <div class="sino" aria-hidden="true"><span class="ic azul"><i class="bi bi-bell-fill"></i></span></div>
          <h3>Avisos na hora</h3>
          <p>Nova ação a ver com você? Chega no sistema e no seu e-mail, com link para responder.</p>
        </article>

        <article class="tile t-c vidro spot reveal" style="--atraso:.16s">
          <span class="ic turq"><i class="bi bi-patch-check-fill" aria-hidden="true"></i></span>
          <h3>Certificado validável</h3>
          <p>PDF com código único, conferido por qualquer pessoa.</p>
          <div class="certificado-mini" aria-hidden="true"><b>Certificado</b><div class="linha"></div><div class="linha curta"></div><code>VOL-7F3A-9C21-B84E</code></div>
        </article>

        <article class="tile t-d vidro spot reveal">
          <span class="ic"><i class="bi bi-graph-up-arrow" aria-hidden="true"></i></span>
          <h3>Seu histórico de horas</h3>
          <p>Acompanhe cada ação, presença e hora doada ao longo do tempo.</p>
          <div class="colunas" aria-hidden="true">${raw([30, 55, 40, 72, 60, 92].map((h, i) => `<i style="--h:${h}%;--n:${i}"></i>`).join(''))}</div>
        </article>

        <article class="tile t-e vidro spot reveal" style="--atraso:.08s">
          <span class="ic azul"><i class="bi bi-shield-lock-fill" aria-hidden="true"></i></span>
          <h3>Seus dados, sua decisão</h3>
          <p>Consentimento claro, revogável a qualquer momento, e exclusão da conta com anonimização (LGPD).</p>
          <div class="interruptor" aria-hidden="true"><span class="tr"></span> Consentimento ativo</div>
        </article>

        <article class="tile t-f vidro spot reveal">
          <span class="ic turq"><i class="bi bi-bar-chart-line-fill" aria-hidden="true"></i></span>
          <h3>Painel e relatórios para a gestão pública</h3>
          <p>Voluntários ativos, ações concluídas, horas e taxa de comparecimento, com gráficos, filtros por período e relatórios em PDF.</p>
          <div class="painel-mini" aria-hidden="true">
            <div class="kpis-mini"><div><b>248</b><small>voluntários</small></div><div><b>37</b><small>ações</small></div><div><b>92%</b><small>presença</small></div></div>
            <svg class="linha-grafico" viewBox="0 0 400 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#ff9a3d"/><stop offset="1" stop-color="#2f6fed"/></linearGradient>
                <linearGradient id="la" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a45" stop-opacity=".28"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></linearGradient>
              </defs>
              <path class="area" d="M0 90 C40 80 60 60 100 66 S170 30 210 40 S290 70 330 36 S380 14 400 10 V110 H0 Z"/>
              <path class="trilha" d="M0 90 C40 80 60 60 100 66 S170 30 210 40 S290 70 330 36 S380 14 400 10"/>
            </svg>
          </div>
        </article>
      </div>
    </section>

    <section class="secao-wrap">
      <div class="sec-cab reveal">
        <span class="sobre">Como funciona</span>
        <h2>Em três passos você já está ajudando</h2>
      </div>
      <div class="passos observar">
        <div class="passo vidro reveal"><div class="num">1</div><div><h3>Cadastre-se</h3><p>Informe seus dados, áreas de interesse, região e quando pode ajudar.</p></div></div>
        <div class="passo vidro reveal" style="--atraso:.12s"><div class="num">2</div><div><h3>Receba oportunidades</h3><p>O sistema avisa quando surge uma ação compatível. Você confirma com um toque.</p></div></div>
        <div class="passo vidro reveal" style="--atraso:.24s"><div class="num">3</div><div><h3>Participe e acumule horas</h3><p>Depois da ação, suas horas entram no histórico e o certificado fica disponível.</p></div></div>
      </div>
    </section>

    <section class="secao-wrap">
      <div class="cta reveal">
        <div class="beams" aria-hidden="true">${feixes(6)}</div>
        <h2>A sua cidade precisa de você. E de mãos como as suas.</h2>
        <p>Leva menos de dois minutos para se cadastrar. Escolha como e quando quer ajudar.</p>
        <div class="cta-botoes">
          <a class="btn btn-claro btn-lg" href="#/cadastro"><i class="bi bi-heart-fill" aria-hidden="true"></i> Quero ser voluntário</a>
          <a class="btn btn-vidro btn-lg" href="#/login">Já tenho conta</a>
        </div>
      </div>
    </section>
  </div>`);

  // Contadores com números reais; falhas ou zeros aparecem de forma elegante.
  api.get('/publico/estatisticas', { semRedirecionar: true }).then((s) => {
    el.querySelectorAll('[data-alvo]').forEach((n) => {
      const alvo = Number(s[n.dataset.alvo]) || 0;
      n.textContent = '0';
      aoEntrar(n, () => animarNumero(n, alvo));
    });
    if (!(Number(s.voluntarios) + Number(s.acoes) + Number(s.horas))) el.querySelector('#stat-nota').hidden = false;
  }).catch(() => {
    el.querySelectorAll('[data-alvo]').forEach((n) => { n.textContent = '—'; });
  });

  api.get('/catalogos/areas', { semRedirecionar: true }).then((areas) => {
    const nomes = (areas || []).map((a) => a.nome);
    if (nomes.length) mount(el.querySelector('#trilha'), trilha(nomes));
  }).catch(() => { /* mantém a lista padrão */ });

  // Parallax suave dos cartões flutuantes.
  const visual = el.querySelector('[data-parallax]');
  const hero = el.querySelector('.hero');
  if (visual && hero && !reduzido()) {
    const mover = (ev) => {
      if (ev.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect();
      visual.style.setProperty('--px', (((ev.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      visual.style.setProperty('--py', (((ev.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    };
    hero.addEventListener('pointermove', mover, { passive: true });
    limpeza.push(() => hero.removeEventListener('pointermove', mover));
  }
}
