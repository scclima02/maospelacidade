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

const opcoes = (itens, selecionado = '') => itens.map((i) => html`<option value="${i.id}" ${String(selecionado) === String(i.id) ? raw('selected') : ''}>${i.nome}</option>`);

// ---------- UC06: oportunidades ----------
const cartaoOportunidade = (o) => html`<div class="col-12 col-md-6 col-xl-4">
  <div class="card h-100 card-oportunidade shadow-sm"><div class="card-body d-flex flex-column">
    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
      ${badge(o.situacao)}
      <span class="badge text-bg-light border">${o.area}</span>
    </div>
    <h2 class="h5">${o.titulo}</h2>
    <p class="text-muted small flex-grow-1">${resumir(o.descricao, 140)}</p>
    <ul class="list-unstyled small mb-3">
      <li><i class="bi bi-calendar-event" aria-hidden="true"></i> ${fmtPeriodo(o.dataInicio, o.dataFim)}</li>
      <li><i class="bi bi-geo-alt" aria-hidden="true"></i> ${o.local} — ${o.regiao}</li>
      <li><i class="bi bi-people" aria-hidden="true"></i> ${o.vagas} ${Number(o.vagas) === 1 ? 'vaga' : 'vagas'}</li>
    </ul>
    <a class="btn btn-primary btn-sm align-self-start" href="#/oportunidades/${o.idParticipacao}">Ver detalhes</a>
  </div></div>
</div>`;

export async function telaOportunidades(ctx) {
  const { areas, regioes } = await carregarCatalogos();
  mount(ctx.el, html`${cabecalhoPagina('Oportunidades')}
    <form class="card card-body shadow-sm mb-3" id="filtros" novalidate aria-label="Filtros de oportunidades">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-lg-3"><label class="form-label small mb-1" for="f-area">Área</label>
          <select class="form-select" id="f-area" name="idArea"><option value="">Todas</option>${opcoes(areas)}</select></div>
        <div class="col-6 col-lg-3"><label class="form-label small mb-1" for="f-regiao">Região</label>
          <select class="form-select" id="f-regiao" name="idRegiao"><option value="">Todas</option>${opcoes(regioes)}</select></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-de">De</label>
          <input class="form-control" type="date" id="f-de" name="de"></div>
        <div class="col-6 col-lg-2"><label class="form-label small mb-1" for="f-ate">Até</label>
          <input class="form-control" type="date" id="f-ate" name="ate"></div>
        <div class="col-12 col-lg-2 d-flex gap-2">
          <button class="btn btn-primary flex-grow-1" type="submit">Filtrar</button>
          <button class="btn btn-outline-secondary" type="reset" aria-label="Limpar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
    </form>
    <div id="lista" aria-live="polite"></div>`);

  const form = ctx.el.querySelector('#filtros');
  const lista = ctx.el.querySelector('#lista');

  async function carregar() {
    mount(lista, spinner());
    try {
      const itens = await api.get(`/oportunidades${qs(lerForm(form))}`);
      mount(lista, itens.length
        ? html`<div class="row g-3">${itens.map(cartaoOportunidade)}</div>`
        : vazio('Nenhuma oportunidade encontrada no momento. Quando surgir uma ação compatível com o seu perfil, você será avisado.', 'bi-search-heart'));
    } catch (e) {
      mount(lista, alerta('danger', mensagensDe(e).join(' ')));
    }
  }
  form.addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  form.addEventListener('reset', () => setTimeout(carregar));
  await carregar();
}

// ---------- UC07: detalhe, confirmar, recusar, cancelar ----------
function acoesPossiveis(o) {
  const aberta = o.situacaoDemanda === 'aberta' && new Date(o.dataInicio) > new Date();
  if (!aberta) return [];
  return {
    sugerida: ['confirmar', 'recusar'],
    confirmada: ['cancelar'],
    selecionada: ['cancelar'],
    cancelada: ['confirmar'],
  }[o.situacao] || [];
}

const ROTULO_ACAO = {
  confirmar: ['btn-success', 'Confirmar participação'],
  recusar: ['btn-outline-danger', 'Recusar'],
  cancelar: ['btn-outline-danger', 'Cancelar participação'],
};

export async function telaOportunidadeDetalhe(ctx) {
  const id = ctx.params.id;

  function desenhar(o) {
    const acoes = acoesPossiveis(o);
    const aviso = {
      selecionada: alerta('success', 'Você foi selecionado(a) para esta ação. Compareça no local e horário combinados.'),
      confirmada: alerta('primary', 'Participação confirmada. Aguarde a seleção do gestor responsável.'),
      recusada: alerta('secondary', 'Você recusou esta oportunidade e ela não será sugerida novamente.'),
      cancelada: alerta('secondary', 'Sua participação foi cancelada.'),
      compareceu: alerta('success', 'Presença registrada. Seu certificado está disponível no histórico.'),
      faltou: alerta('warning', 'Falta registrada nesta ação.'),
    }[o.situacao] || '';

    mount(ctx.el, html`<nav aria-label="Navegação"><a href="#/oportunidades" class="small"><i class="bi bi-arrow-left" aria-hidden="true"></i> Voltar às oportunidades</a></nav>
      <div class="card shadow-sm mt-2"><div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <h1 class="h3 mb-0" tabindex="-1">${o.titulo}</h1>
          <div class="d-flex gap-2">${badge(o.situacao)}${o.situacaoDemanda !== 'aberta' ? badge(o.situacaoDemanda) : ''}</div>
        </div>
        ${aviso}
        <p class="mb-3" style="white-space:pre-line">${o.descricao}</p>
        <dl class="row mb-4">
          <dt class="col-sm-3">Área</dt><dd class="col-sm-9">${o.area}</dd>
          <dt class="col-sm-3">Região</dt><dd class="col-sm-9">${o.regiao}</dd>
          <dt class="col-sm-3">Local</dt><dd class="col-sm-9">${o.local}</dd>
          <dt class="col-sm-3">Período</dt><dd class="col-sm-9">${fmtPeriodo(o.dataInicio, o.dataFim)}</dd>
          <dt class="col-sm-3">Vagas</dt><dd class="col-sm-9">${o.vagas}</dd>
        </dl>
        <div class="d-flex flex-wrap gap-2">
          ${acoes.map((a) => html`<button type="button" class="btn ${ROTULO_ACAO[a][0]}" data-acao="${a}">${a === 'confirmar' && o.situacao === 'cancelada' ? 'Confirmar novamente' : ROTULO_ACAO[a][1]}</button>`)}
        </div>
      </div></div>`);

    ctx.el.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', async () => {
      const acao = b.dataset.acao;
      if (acao === 'recusar' && !(await confirmar({
        titulo: 'Recusar oportunidade', ok: 'Recusar', perigo: true,
        mensagem: 'Ao recusar, esta ação não será mais sugerida para você. Deseja continuar?',
      }))) return;
      if (acao === 'cancelar' && !(await confirmar({
        titulo: 'Cancelar participação', ok: 'Cancelar participação', perigo: true,
        mensagem: 'Sua vaga será liberada para outros voluntários. Deseja cancelar sua participação?',
      }))) return;
      await executar(b, async () => {
        const atualizada = await api.post(`/participacoes/${o.idParticipacao}/${acao}`);
        toast({ confirmar: 'Participação confirmada!', recusar: 'Oportunidade recusada.', cancelar: 'Participação cancelada.' }[acao]);
        desenhar(atualizada);
      });
    }));
  }

  desenhar(await api.get(`/oportunidades/${id}`));
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
