// Componentes de formulário reutilizados por cadastro e perfil do voluntário.
import { html, raw, uid, DIAS } from './ui.js';

const hhmm = (v) => String(v ?? '').slice(0, 5);

export function blocoTermo(t) {
  if (!t) return html`<p class="text-muted">Termo indisponível no momento.</p>`;
  return html`<div class="termo border rounded p-3 bg-light small" tabindex="0" role="region" aria-label="Termo de uso e política de privacidade">
    <h3 class="h6">${t.titulo}</h3>
    <p><strong>Finalidade:</strong> ${t.finalidade}</p>
    <p class="mb-1"><strong>Dados coletados:</strong></p>
    <ul>${(t.dadosColetados || []).map((i) => html`<li>${i}</li>`)}</ul>
    <p class="mb-1"><strong>Quem pode acessar:</strong></p>
    <ul>${(t.quemAcessa || []).map((i) => html`<li>${i}</li>`)}</ul>
    <p><strong>Prazo de retenção:</strong> ${t.retencao}</p>
    ${t.texto ? html`<p class="mb-0">${t.texto}</p>` : ''}
  </div>`;
}

function linhaDisp(d = {}) {
  const id = uid();
  const dia = d.diaSemana === undefined ? 1 : Number(d.diaSemana);
  return html`<div class="row g-2 align-items-end disp-linha mb-2">
    <div class="col-12 col-md-5">
      <label class="form-label small mb-1" for="${id}d">Dia da semana</label>
      <select class="form-select" id="${id}d" name="diaSemana" required>
        ${DIAS.map((nome, i) => html`<option value="${i}" ${dia === i ? raw('selected') : ''}>${nome}</option>`)}
      </select>
    </div>
    <div class="col-6 col-md-3">
      <label class="form-label small mb-1" for="${id}i">Das</label>
      <input class="form-control" type="time" id="${id}i" name="horaInicio" value="${hhmm(d.horaInicio) || '08:00'}" required>
    </div>
    <div class="col-6 col-md-3">
      <label class="form-label small mb-1" for="${id}f">Até</label>
      <input class="form-control" type="time" id="${id}f" name="horaFim" value="${hhmm(d.horaFim) || '12:00'}" required>
    </div>
    <div class="col-12 col-md-1 text-md-end">
      <button type="button" class="btn btn-outline-danger btn-sm" data-remover aria-label="Remover faixa"><i class="bi bi-trash" aria-hidden="true"></i></button>
    </div>
  </div>`;
}

export function camposVoluntario({ areas, regioes, valores = {} }) {
  const selecionadas = new Set((valores.areas || []).map(Number));
  const idRegiao = valores.idRegiao === undefined || valores.idRegiao === null ? '' : String(valores.idRegiao);
  const disp = valores.disponibilidades && valores.disponibilidades.length ? valores.disponibilidades : [{}];
  return html`
    <div class="row g-3">
      <div class="col-12 col-md-6">
        <label class="form-label" for="v-nome">Nome completo</label>
        <input class="form-control" id="v-nome" name="nome" value="${valores.nome || ''}" required maxlength="120" autocomplete="name">
        <div class="invalid-feedback">Informe seu nome.</div>
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label" for="v-email">E-mail</label>
        <input class="form-control" type="email" id="v-email" name="email" value="${valores.email || ''}" required maxlength="160" autocomplete="email">
        <div class="invalid-feedback">Informe um e-mail válido.</div>
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label" for="v-telefone">Telefone</label>
        <input class="form-control" type="tel" id="v-telefone" name="telefone" value="${valores.telefone || ''}" required maxlength="20" autocomplete="tel" placeholder="(00) 00000-0000">
        <div class="invalid-feedback">Informe um telefone com DDD.</div>
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label" for="v-regiao">Região / bairro de residência</label>
        <select class="form-select" id="v-regiao" name="idRegiao" required>
          <option value="">Selecione…</option>
          ${regioes.map((r) => html`<option value="${r.id}" ${idRegiao === String(r.id) ? raw('selected') : ''}>${r.nome}</option>`)}
        </select>
        <div class="invalid-feedback">Selecione sua região.</div>
      </div>
    </div>

    <fieldset class="mt-4">
      <legend class="h6">Áreas de interesse <span class="text-muted fw-normal">(escolha ao menos uma)</span></legend>
      <div class="area-lista" data-areas>
        ${areas.map((a) => html`<div class="form-check">
          <input class="form-check-input" type="checkbox" name="area" value="${a.id}" id="area-${a.id}" ${selecionadas.has(Number(a.id)) ? raw('checked') : ''}>
          <label class="form-check-label" for="area-${a.id}">${a.nome}</label>
        </div>`)}
      </div>
    </fieldset>

    <fieldset class="mt-4">
      <legend class="h6">Disponibilidade <span class="text-muted fw-normal">(dias da semana e faixas de horário)</span></legend>
      <div data-disps>${disp.map(linhaDisp)}</div>
      <button type="button" class="btn btn-outline-primary btn-sm" data-add-disp><i class="bi bi-plus-lg" aria-hidden="true"></i> Adicionar faixa</button>
    </fieldset>`;
}

// Liga os botões de adicionar/remover faixas de disponibilidade.
export function iniciarDisponibilidades(form) {
  const lista = form.querySelector('[data-disps]');
  form.querySelector('[data-add-disp]').addEventListener('click', () => {
    lista.insertAdjacentHTML('beforeend', linhaDisp().s);
  });
  lista.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-remover]');
    if (!b) return;
    // Mantém sempre ao menos uma faixa na tela.
    if (lista.querySelectorAll('.disp-linha').length > 1) b.closest('.disp-linha').remove();
  });
}

// Lê e valida os campos do voluntário. Retorna { dados, erros }.
export function coletarVoluntario(form) {
  const f = form.elements;
  const erros = [];
  const areas = [...form.querySelectorAll('input[name=area]:checked')].map((c) => Number(c.value));
  const disponibilidades = [...form.querySelectorAll('.disp-linha')].map((l) => ({
    diaSemana: Number(l.querySelector('[name=diaSemana]').value),
    horaInicio: l.querySelector('[name=horaInicio]').value,
    horaFim: l.querySelector('[name=horaFim]').value,
  }));

  if (!areas.length) erros.push('Selecione ao menos uma área de interesse.');
  if (!disponibilidades.length) erros.push('Informe ao menos uma faixa de disponibilidade.');
  disponibilidades.forEach((d, i) => {
    if (d.horaInicio && d.horaFim && d.horaFim <= d.horaInicio) {
      erros.push(`Disponibilidade ${i + 1}: o horário final deve ser posterior ao inicial.`);
    }
  });
  const digitos = f.telefone.value.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 11) erros.push('Informe o telefone com DDD (10 ou 11 dígitos).');

  return {
    erros,
    dados: {
      nome: f.nome.value.trim(),
      email: f.email.value.trim(),
      telefone: f.telefone.value.trim(),
      idRegiao: Number(f.idRegiao.value),
      areas,
      disponibilidades,
    },
  };
}

export const SENHA_FORTE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const DICA_SENHA = 'Mínimo de 8 caracteres, com letras e números.';
