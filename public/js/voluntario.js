import { api, qs } from './api.js';
import { state, carregarCatalogos } from './state.js';
import { navegar } from './router.js';
import { atualizarBadge } from './cabecalho.js';
import {
  html, raw, mount, spinner, vazio, alerta, cabecalhoPagina, badge, toast, confirmar, modalFormulario,
  aoEnviar, ErroForm, executar, lerForm, mensagensDe, fmtPeriodo, fmtData, fmtDataHora, fmtHoras, fmtNumero, resumir,
} from './ui.js';
import {
  blocoTermo, camposVoluntario, iniciarDisponibilidades, coletarVoluntario,
} from './componentes.js';
import { montarMapa, temCoordenadas } from './mapa.js';

const opcoes = (itens, selecionado = '') => itens.map((i) => html`<option value="${i.id}" ${String(selecionado) === String(i.id) ? raw('selected') : ''}>${i.nome}</option>`);

// ---------- UC06: oportunidades ----------
// Três visões: recomendadas (áreas de interesse, região do voluntário primeiro), todas e inscrições.
const ABAS = [
  ['recomendadas', 'Para você', 'bi-stars'],
  ['todas', 'Todas as oportunidades', 'bi-grid'],
  ['mapa', 'Mapa', 'bi-map'],
  ['minhas', 'Minhas inscrições', 'bi-bookmark-check'],
];

const linkOrganizacao = (o) => (o.link
  ? html`<a href="${o.link}" target="_blank" rel="noopener noreferrer">${o.organizacao || 'Página da organização'} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>`
  : (o.organizacao || ''));

const cartaoOportunidade = (o) => html`<div class="col-12 col-md-6 col-xl-4">
  <div class="card h-100 card-oportunidade shadow-sm"><div class="card-body d-flex flex-column">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
      <span class="d-flex flex-wrap gap-1">
        <span class="badge text-bg-light border">${o.area}</span>
        ${o.mesmaRegiao ? html`<span class="badge text-bg-success">Sua região</span>` : ''}
      </span>
      ${o.situacao ? badge(o.situacao) : ''}
    </div>
    <h2 class="h5 mb-1">${o.titulo}</h2>
    ${o.organizacao ? html`<p class="small fw-semibold mb-2"><i class="bi bi-building" aria-hidden="true"></i> ${o.organizacao}</p>` : ''}
    <p class="text-muted small flex-grow-1">${resumir(o.descricao, 140)}</p>
    <ul class="list-unstyled small mb-3">
      <li><i class="bi bi-calendar-event" aria-hidden="true"></i> ${fmtPeriodo(o.dataInicio, o.dataFim)}</li>
      <li><i class="bi bi-geo-alt" aria-hidden="true"></i> ${o.local} — ${o.regiao}</li>
      <li><i class="bi bi-people" aria-hidden="true"></i> ${o.vagas} ${Number(o.vagas) === 1 ? 'vaga' : 'vagas'}</li>
    </ul>
    <a class="btn btn-primary btn-sm align-self-start" href="#/oportunidades/demanda/${o.idDemanda}">Ver detalhes</a>
  </div></div>
</div>`;

export async function telaOportunidades(ctx) {
  const [{ areas, regioes }, eu] = await Promise.all([carregarCatalogos(), api.get('/voluntarios/me')]);
  const minhasAreas = areas.filter((a) => (eu.areas || []).includes(a.id)).map((a) => a.nome);
  let aba = ABAS.some(([k]) => k === ctx.query?.aba) ? ctx.query.aba : 'recomendadas';

  mount(ctx.el, html`${cabecalhoPagina('Oportunidades')}
    <ul class="nav nav-pills abas-vagas mb-3" role="tablist" aria-label="Visões das oportunidades">
      ${ABAS.map(([k, rotulo, icone]) => html`<li class="nav-item" role="presentation">
        <button type="button" class="nav-link" role="tab" data-aba="${k}"><i class="bi ${icone}" aria-hidden="true"></i> ${rotulo}</button></li>`)}
    </ul>
    <form class="card card-body shadow-sm mb-3" id="filtros" novalidate aria-label="Filtros de oportunidades">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-lg-3" data-so-vitrine><label class="form-label small mb-1" for="f-busca">Buscar</label>
          <input class="form-control" id="f-busca" name="busca" placeholder="Ação, organização ou bairro"></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-area">Área</label>
          <select class="form-select" id="f-area" name="idArea"><option value="">Todas</option>${opcoes(areas)}</select></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-regiao">Região</label>
          <select class="form-select" id="f-regiao" name="idRegiao"><option value="">Todas</option>${opcoes(regioes)}</select></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-de">De</label>
          <input class="form-control" type="date" id="f-de" name="de"></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-ate">Até</label>
          <input class="form-control" type="date" id="f-ate" name="ate"></div>
        <div class="col-12 col-lg-1 d-flex gap-2">
          <button class="btn btn-primary flex-grow-1" type="submit" aria-label="Filtrar"><i class="bi bi-funnel" aria-hidden="true"></i></button>
          <button class="btn btn-outline-secondary" type="reset" aria-label="Limpar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
    </form>
    <p class="small text-muted" id="dica" aria-live="polite"></p>
    <div id="lista" aria-live="polite"></div>`);

  const form = ctx.el.querySelector('#filtros');
  const lista = ctx.el.querySelector('#lista');
  const dica = ctx.el.querySelector('#dica');
  const botoesAba = [...ctx.el.querySelectorAll('[data-aba]')];
  let limparMapa = () => {};
  ctx.limpeza.push(() => limparMapa());

  function marcarAba() {
    botoesAba.forEach((b) => {
      const ativa = b.dataset.aba === aba;
      b.classList.toggle('active', ativa);
      b.setAttribute('aria-selected', String(ativa));
    });
    ctx.el.querySelector('[data-so-vitrine]').classList.toggle('d-none', aba === 'minhas');
  }

  async function carregar() {
    marcarAba();
    limparMapa();
    limparMapa = () => {};
    mount(lista, spinner());
    const filtros = lerForm(form);
    try {
      if (aba === 'mapa') {
        dica.textContent = 'Clique em um marcador para ver a ação e traçar a rota da sua localização até o local. Em vermelho: suas áreas de interesse.';
        const itens = await api.get(`/oportunidades/explorar${qs({ ...filtros, escopo: 'todas' })}`);
        limparMapa = await montarMapa(lista, itens);
        return;
      }
      if (aba === 'minhas') {
        delete filtros.busca;
        dica.textContent = 'Ações em que você confirmou interesse, foi sugerido(a) ou selecionado(a).';
        const itens = await api.get(`/oportunidades${qs(filtros)}`);
        mount(lista, itens.length
          ? html`<div class="row g-3">${itens.map(cartaoOportunidade)}</div>`
          : vazio('Você ainda não se inscreveu em nenhuma ação. Veja as oportunidades e clique em "Quero participar".', 'bi-bookmark'));
        return;
      }
      dica.textContent = aba === 'recomendadas'
        ? (minhasAreas.length
          ? `Ações das suas áreas de interesse (${minhasAreas.join(', ')}). As da sua região (${eu.regiao || 'não informada'}) aparecem primeiro.`
          : 'Você ainda não escolheu áreas de interesse. Atualize em "Meu perfil".')
        : 'Todas as ações abertas. As das suas áreas e da sua região aparecem primeiro.';
      const itens = await api.get(`/oportunidades/explorar${qs({ ...filtros, escopo: aba })}`);
      if (itens.length) {
        mount(lista, html`<p class="small mb-2"><strong>${itens.length}</strong> ${itens.length === 1 ? 'oportunidade encontrada' : 'oportunidades encontradas'}</p>
          <div class="row g-3">${itens.map(cartaoOportunidade)}</div>`);
      } else {
        mount(lista, html`${vazio('Nenhuma oportunidade encontrada com esses filtros.', 'bi-search-heart')}
          ${aba === 'recomendadas' ? html`<div class="text-center"><button type="button" class="btn btn-outline-primary" data-ir="todas">Ver todas as oportunidades</button></div>` : ''}`);
      }
    } catch (e) {
      mount(lista, alerta('danger', mensagensDe(e).join(' ')));
    }
  }

  botoesAba.forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba; carregar(); }));
  lista.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ir]');
    if (b) { aba = b.dataset.ir; carregar(); }
  });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  form.addEventListener('reset', () => setTimeout(carregar));
  await carregar();
}

// ---------- UC07: detalhe, participar, confirmar, recusar, cancelar ----------
function acoesPossiveis(o) {
  const aberta = o.situacaoDemanda === 'aberta' && new Date(o.dataInicio) > new Date();
  if (!aberta) return [];
  if (!o.situacao || o.situacao === 'recusada') return ['participar'];
  return {
    sugerida: ['confirmar', 'recusar'],
    confirmada: ['cancelar'],
    selecionada: ['cancelar'],
    cancelada: ['confirmar'],
  }[o.situacao] || [];
}

const ROTULO_ACAO = {
  participar: ['btn-success', 'Quero participar'],
  confirmar: ['btn-success', 'Confirmar participação'],
  recusar: ['btn-outline-danger', 'Recusar'],
  cancelar: ['btn-outline-danger', 'Cancelar participação'],
};

export async function telaOportunidadeDetalhe(ctx) {
  const { id, idDemanda } = ctx.params;

  function desenhar(o) {
    const acoes = acoesPossiveis(o);
    const aviso = {
      selecionada: alerta('success', 'Você foi selecionado(a) para esta ação. Compareça no local e horário combinados.'),
      confirmada: alerta('primary', 'Participação confirmada. Aguarde a seleção do responsável pela ação.'),
      recusada: alerta('secondary', 'Você recusou esta oportunidade. Se mudar de ideia, ainda pode participar.'),
      cancelada: alerta('secondary', 'Sua participação foi cancelada.'),
      compareceu: alerta('success', 'Presença registrada. Seu certificado está disponível no histórico.'),
      faltou: alerta('warning', 'Falta registrada nesta ação.'),
    }[o.situacao] || '';

    mount(ctx.el, html`<nav aria-label="Navegação"><a href="#/oportunidades" class="small"><i class="bi bi-arrow-left" aria-hidden="true"></i> Voltar às oportunidades</a></nav>
      <div class="card shadow-sm mt-2"><div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <h1 class="h3 mb-0" tabindex="-1">${o.titulo}</h1>
          <div class="d-flex gap-2">${o.situacao ? badge(o.situacao) : ''}${o.situacaoDemanda !== 'aberta' ? badge(o.situacaoDemanda) : ''}</div>
        </div>
        ${aviso}
        <p class="mb-3" style="white-space:pre-line">${o.descricao}</p>
        <dl class="row mb-4">
          ${o.organizacao || o.link ? html`<dt class="col-sm-3">Organização</dt><dd class="col-sm-9">${linkOrganizacao(o)}</dd>` : ''}
          <dt class="col-sm-3">Área</dt><dd class="col-sm-9">${o.area}</dd>
          <dt class="col-sm-3">Região</dt><dd class="col-sm-9">${o.regiao}</dd>
          <dt class="col-sm-3">Local</dt><dd class="col-sm-9">${o.local}</dd>
          <dt class="col-sm-3">Período</dt><dd class="col-sm-9">${fmtPeriodo(o.dataInicio, o.dataFim)}</dd>
          <dt class="col-sm-3">Vagas</dt><dd class="col-sm-9">${o.vagas}</dd>
        </dl>
        <div class="d-flex flex-wrap gap-2">
          ${acoes.map((a) => html`<button type="button" class="btn ${ROTULO_ACAO[a][0]}" data-acao="${a}">${a === 'confirmar' && o.situacao === 'cancelada' ? 'Confirmar novamente' : ROTULO_ACAO[a][1]}</button>`)}
          ${o.link ? html`<a class="btn btn-outline-secondary" href="${o.link}" target="_blank" rel="noopener noreferrer">Ver na página da organização <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>` : ''}
        </div>
      </div></div>
      ${temCoordenadas(o) ? html`<section class="card shadow-sm mt-3" aria-labelledby="t-mapa"><div class="card-body">
        <h2 class="h5" id="t-mapa"><i class="bi bi-map" aria-hidden="true"></i> Como chegar</h2>
        <div data-mapa-detalhe></div>
      </div></section>` : ''}`);

    const caixaMapa = ctx.el.querySelector('[data-mapa-detalhe]');
    if (caixaMapa) montarMapa(caixaMapa, [o], { alturaClasse: 'mapa-detalhe', unico: true }).then((f) => ctx.limpeza.push(f));

    ctx.el.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', async () => {
      const acao = b.dataset.acao;
      if (acao === 'recusar' && !(await confirmar({
        titulo: 'Recusar oportunidade', ok: 'Recusar', perigo: true,
        mensagem: 'Ao recusar, esta ação deixará de ser sugerida para você. Deseja continuar?',
      }))) return;
      if (acao === 'cancelar' && !(await confirmar({
        titulo: 'Cancelar participação', ok: 'Cancelar participação', perigo: true,
        mensagem: 'Sua vaga será liberada para outros voluntários. Deseja cancelar sua participação?',
      }))) return;
      await executar(b, async () => {
        const atualizada = acao === 'participar'
          ? await api.post(`/oportunidades/demanda/${o.idDemanda}/participar`)
          : await api.post(`/participacoes/${o.idParticipacao}/${acao}`);
        toast({
          participar: 'Inscrição feita! O responsável pela ação vai analisar e você será avisado.',
          confirmar: 'Participação confirmada!',
          recusar: 'Oportunidade recusada.',
          cancelar: 'Participação cancelada.',
        }[acao]);
        desenhar(atualizada);
      });
    }));
  }

  desenhar(await api.get(idDemanda ? `/oportunidades/demanda/${idDemanda}` : `/oportunidades/${id}`));
}

// ---------- UC06: notificações ----------
export async function telaNotificacoes(ctx) {
  let somenteNaoLidas = false;
  mount(ctx.el, html`${cabecalhoPagina('Notificações', html`
      <div class="form-check form-switch align-self-center me-2">
        <input class="form-check-input" type="checkbox" role="switch" id="so-nao-lidas">
        <label class="form-check-label" for="so-nao-lidas">Somente não lidas</label>
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" id="ler-todas">Marcar todas como lidas</button>`)}
    <div id="lista" aria-live="polite"></div>`);
  const lista = ctx.el.querySelector('#lista');

  async function carregar() {
    mount(lista, spinner());
    try {
      const itens = await api.get(`/notificacoes${qs({ naoLidas: somenteNaoLidas })}`);
      mount(lista, itens.length
        ? html`<div class="list-group shadow-sm">${itens.map((n) => html`<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-start gap-3" data-id="${n.id}">
            <span><span class="d-block ${n.lida ? 'text-muted' : 'fw-semibold'}">${n.mensagem}</span>
              <small class="text-muted">${fmtDataHora(n.dataEnvio)}</small></span>
            ${n.lida ? '' : html`<span class="badge text-bg-primary">Nova</span>`}
          </button>`)}</div>`
        : vazio(somenteNaoLidas ? 'Você não tem notificações não lidas.' : 'Você ainda não recebeu notificações.', 'bi-bell'));
    } catch (e) {
      mount(lista, alerta('danger', mensagensDe(e).join(' ')));
    }
  }

  lista.addEventListener('click', async (ev) => {
    const item = ev.target.closest('[data-id]');
    if (!item) return;
    await executar(item, async () => {
      const r = await api.post(`/notificacoes/${item.dataset.id}/ler`);
      atualizarBadge();
      if (r.idParticipacao) navegar(`#/oportunidades/${r.idParticipacao}`);
      else await carregar();
    });
  });
  ctx.el.querySelector('#so-nao-lidas').addEventListener('change', (ev) => {
    somenteNaoLidas = ev.target.checked;
    carregar();
  });
  ctx.el.querySelector('#ler-todas').addEventListener('click', (ev) => executar(ev.currentTarget, async () => {
    await api.post('/notificacoes/ler-todas');
    toast('Todas as notificações foram marcadas como lidas.');
    atualizarBadge();
    await carregar();
  }));
  await carregar();
}

// ---------- UC08 e UC09: histórico e certificado ----------
export async function telaHistorico(ctx) {
  const h = await api.get('/voluntarios/me/historico');
  const indicador = (valor, rotulo, cls = '', icone = 'bi-stars') => html`<div class="col-6 col-md-4"><div class="card indicador ${cls}"><div class="card-body"><span class="ico" aria-hidden="true"><i class="bi ${icone}"></i></span>
    <div class="valor">${valor}</div><div class="rotulo">${rotulo}</div></div></div></div>`;

  mount(ctx.el, html`${cabecalhoPagina('Meu histórico')}
    <div class="row g-3 mb-4">
      ${indicador(fmtNumero(h.totais.acoes), 'Ações realizadas', '', 'bi-hand-thumbs-up-fill')}
      ${indicador(fmtHoras(h.totais.horas), 'Horas voluntariadas', 'verde', 'bi-clock-history')}
      ${indicador(fmtNumero(h.totais.faltas), 'Faltas registradas', '', 'bi-person-x-fill')}
    </div>
    ${h.itens.length ? html`<div class="card shadow-sm"><div class="table-responsive">
      <table class="table table-hover tabela-compacta mb-0">
        <caption class="visually-hidden">Ações em que você foi selecionado(a)</caption>
        <thead class="table-light"><tr><th scope="col">Data</th><th scope="col">Ação</th><th scope="col">Área</th><th scope="col">Situação</th><th scope="col" class="num">Horas</th><th scope="col">Certificado</th></tr></thead>
        <tbody>${h.itens.map((i) => html`<tr>
          <td>${fmtData(i.data)}</td><td>${i.titulo}</td><td>${i.area}</td><td>${badge(i.situacao)}</td>
          <td class="num">${fmtHoras(i.horas)}</td>
          <td>${i.situacao === 'compareceu'
            ? html`<a class="btn btn-outline-primary btn-sm" href="/api/participacoes/${i.idParticipacao}/certificado" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i> Certificado (PDF)</a>
              ${i.codigoCertificado ? html`<div class="small text-muted mt-1">Código: <a href="#/validar?codigo=${i.codigoCertificado}">${i.codigoCertificado}</a></div>` : ''}`
            : html`<span class="text-muted small">—</span>`}</td>
        </tr>`)}</tbody>
      </table></div></div>`
    : vazio('Você ainda não participou de nenhuma ação. Confira as oportunidades disponíveis.', 'bi-clock-history')}`);
}

// ---------- UC05, UC04, UC10: perfil ----------
export async function telaPerfil(ctx) {
  const [perfil, { areas, regioes }] = await Promise.all([api.get('/voluntarios/me'), carregarCatalogos(true)]);
  const c = perfil.consentimento || {};

  mount(ctx.el, html`${cabecalhoPagina('Meu perfil')}
    <div class="row g-4">
      <div class="col-12 col-xl-8">
        <div class="card shadow-sm"><div class="card-body">
          <h2 class="h5">Dados e disponibilidade</h2>
          <p class="text-muted small">As alterações valem para os próximos cruzamentos com novas demandas.</p>
          <form id="form-perfil" novalidate>
            <div data-erros></div>
            ${camposVoluntario({ areas, regioes, valores: perfil })}
            <button type="submit" class="btn btn-primary mt-4">Salvar alterações</button>
          </form>
        </div></div>
      </div>
      <div class="col-12 col-xl-4">
        <div class="card shadow-sm mb-4"><div class="card-body">
          <h2 class="h5">Consentimento (LGPD)</h2>
          ${c.vigente
            ? html`<p>${badge('ativo')} Consentimento vigente desde ${fmtDataHora(c.dataAceite)} (termo ${c.versao}).</p>
              <p class="small text-muted">Ao revogar, você deixa de receber sugestões de oportunidades até aceitar novamente.</p>
              <button type="button" class="btn btn-outline-danger btn-sm" id="revogar">Revogar consentimento</button>`
            : html`<p>${badge('inativo')} ${c.dataRevogacao ? `Consentimento revogado em ${fmtDataHora(c.dataRevogacao)}.` : 'Sem consentimento vigente.'}</p>
              <p class="small text-muted">Sem consentimento, você não é sugerido para novas ações.</p>
              <button type="button" class="btn btn-primary btn-sm" id="aceitar">Aceitar o termo novamente</button>`}
        </div></div>
        <div class="card border-danger shadow-sm"><div class="card-body">
          <h2 class="h5 text-danger">Excluir minha conta</h2>
          <p class="small">Seus dados pessoais serão removidos ou anonimizados e o consentimento será revogado. Esta ação não pode ser desfeita.</p>
          <button type="button" class="btn btn-danger btn-sm" id="excluir">Excluir conta e dados</button>
        </div></div>
      </div>
    </div>`);

  const form = ctx.el.querySelector('#form-perfil');
  iniciarDisponibilidades(form);
  aoEnviar(form, async () => {
    const { dados, erros } = coletarVoluntario(form);
    if (erros.length) throw new ErroForm(erros);
    await api.put('/voluntarios/me', dados);
    state.usuario = { ...state.usuario, nome: dados.nome, email: dados.email };
    toast('Perfil atualizado com sucesso.');
  });

  const revogar = ctx.el.querySelector('#revogar');
  if (revogar) {
    revogar.addEventListener('click', async () => {
      if (!(await confirmar({
        titulo: 'Revogar consentimento', ok: 'Revogar', perigo: true,
        mensagem: 'Você deixará de ser sugerido para novas oportunidades. Deseja revogar o consentimento?',
      }))) return;
      await executar(revogar, async () => {
        await api.del('/voluntarios/me/consentimento');
        toast('Consentimento revogado.', 'warning');
        await telaPerfil(ctx);
      });
    });
  }

  const aceitar = ctx.el.querySelector('#aceitar');
  if (aceitar) {
    aceitar.addEventListener('click', () => modalFormulario({
      titulo: 'Termo de uso e privacidade',
      ok: 'Aceitar termo',
      grande: true,
      corpo: html`${blocoTermo(state.config.termo)}
        <div class="form-check mt-3">
          <input class="form-check-input" type="checkbox" id="m-aceite" required>
          <label class="form-check-label" for="m-aceite">Li e aceito o termo de uso e a política de privacidade.</label>
          <div class="invalid-feedback">É necessário aceitar o termo.</div>
        </div>`,
      aoSalvar: async () => {
        await api.post('/voluntarios/me/consentimento', { aceite: true });
        toast('Consentimento registrado.');
        await telaPerfil(ctx);
      },
    }));
  }

  ctx.el.querySelector('#excluir').addEventListener('click', () => modalFormulario({
    titulo: 'Excluir conta e dados',
    ok: 'Excluir definitivamente',
    perigo: true,
    corpo: html`<p>Esta ação remove ou anonimiza seus dados pessoais, revoga seus consentimentos e encerra sua conta. <strong>Não é possível desfazer.</strong></p>
      <label class="form-label" for="m-senha">Confirme com sua senha</label>
      <input class="form-control" type="password" id="m-senha" name="senha" required autocomplete="current-password">
      <div class="invalid-feedback">Informe sua senha.</div>`,
    aoSalvar: async (f) => {
      await api.post('/voluntarios/me/excluir', { senha: f.elements.senha.value });
      state.usuario = null;
      state.naoLidas = 0;
      toast('Sua conta foi excluída. Obrigado pela participação!');
      navegar('#/login');
    },
  }));
}
