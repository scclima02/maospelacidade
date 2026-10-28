import { api } from './api.js';
import { state, carregarCatalogos } from './state.js';
import { homePara, navegar } from './router.js';
import {
  html, mount, aoEnviar, ErroForm, toast, alerta, fmtData, fmtHoras, executar, mensagensDe,
} from './ui.js';
import {
  blocoTermo, camposVoluntario, iniciarDisponibilidades, coletarVoluntario, SENHA_FORTE, DICA_SENHA,
} from './componentes.js';

const cartaoCentral = (conteudo, largura = 'col-lg-5') => html`<div class="row justify-content-center">
  <div class="col-12 col-md-9 ${largura}"><div class="card shadow-sm"><div class="card-body p-4">${conteudo}</div></div></div>
</div>`;

export function telaLogin({ el }) {
  mount(el, cartaoCentral(html`
    <h1 class="h4 mb-1" tabindex="-1">Entrar</h1>
    <p class="text-muted">Acesse com seu e-mail e senha.</p>
    <form novalidate>
      <div data-erros></div>
      <div class="mb-3">
        <label class="form-label" for="l-email">E-mail</label>
        <input class="form-control" type="email" id="l-email" name="email" required autocomplete="username">
        <div class="invalid-feedback">Informe seu e-mail.</div>
      </div>
      <div class="mb-3">
        <label class="form-label" for="l-senha">Senha</label>
        <input class="form-control" type="password" id="l-senha" name="senha" required autocomplete="current-password">
        <div class="invalid-feedback">Informe sua senha.</div>
      </div>
      <button class="btn btn-primary w-100" type="submit">Entrar</button>
    </form>
    <div class="d-flex flex-wrap justify-content-between gap-2 mt-3 small">
      <a href="#/recuperar-senha">Esqueci minha senha</a>
      <a href="#/cadastro">Quero ser voluntário</a>
    </div>`));

  aoEnviar(el.querySelector('form'), async (form) => {
    const r = await api.post('/auth/login', {
      email: form.elements.email.value.trim(),
      senha: form.elements.senha.value,
    }, { semRedirecionar: true });
    state.usuario = r.usuario;
    navegar(homePara(r.usuario.perfil));
  });
}

export async function telaCadastro({ el }) {
  const { areas, regioes } = await carregarCatalogos(true);
  const termo = state.config.termo;

  mount(el, cartaoCentral(html`
    <h1 class="h4 mb-1" tabindex="-1">Cadastro de voluntário</h1>
    <p class="text-muted">Informe seus dados e sua disponibilidade para receber oportunidades compatíveis.</p>
    <form novalidate>
      <div data-erros></div>
      ${camposVoluntario({ areas, regioes })}

      <div class="row g-3 mt-1">
        <div class="col-12 col-md-6">
          <label class="form-label" for="v-senha">Senha</label>
          <input class="form-control" type="password" id="v-senha" name="senha" required minlength="8" autocomplete="new-password" aria-describedby="v-senha-dica">
          <div class="form-text" id="v-senha-dica">${DICA_SENHA}</div>
          <div class="invalid-feedback">Informe uma senha com ao menos 8 caracteres.</div>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="v-senha2">Confirmar senha</label>
          <input class="form-control" type="password" id="v-senha2" name="senha2" required autocomplete="new-password">
          <div class="invalid-feedback">Repita a senha.</div>
        </div>
      </div>

      <section class="mt-4" aria-labelledby="t-termo">
        <h2 class="h6" id="t-termo">Termo de uso e política de privacidade (LGPD)</h2>
        ${blocoTermo(termo)}
        <div class="form-check mt-3">
          <input class="form-check-input" type="checkbox" id="v-aceite" name="aceite" required>
          <label class="form-check-label" for="v-aceite">Li e aceito o termo de uso e a política de privacidade${state.config.termoVersao ? ` (versão ${state.config.termoVersao})` : ''}.</label>
          <div class="invalid-feedback">É necessário aceitar o termo para concluir o cadastro.</div>
        </div>
      </section>

      <button class="btn btn-primary mt-4" type="submit">Concluir cadastro</button>
      <a class="btn btn-link mt-4" href="#/login">Já tenho conta</a>
    </form>`, 'col-lg-8'));

  aoEnviar(el.querySelector('form'), async (form) => {
    const { dados, erros } = coletarVoluntario(form);
    const senha = form.elements.senha.value;
    if (!SENHA_FORTE.test(senha)) erros.push(`Senha fraca. ${DICA_SENHA}`);
    if (senha !== form.elements.senha2.value) erros.push('A confirmação de senha não confere.');
    if (erros.length) throw new ErroForm(erros);

    const r = await api.post('/voluntarios/cadastro', { ...dados, senha, aceiteTermo: true }, { semRedirecionar: true });
    state.usuario = r.usuario;
    toast('Cadastro concluído! Bem-vindo(a) ao voluntariado.');
    navegar(homePara('voluntario'));
  });
  iniciarDisponibilidades(el.querySelector('form'));
}

export function telaRecuperarSenha({ el }) {
  mount(el, cartaoCentral(html`
    <h1 class="h4 mb-1" tabindex="-1">Recuperar senha</h1>
    <p class="text-muted">Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.</p>
    <div id="resultado"></div>
    <form novalidate>
      <div data-erros></div>
      <div class="mb-3">
        <label class="form-label" for="r-email">E-mail</label>
        <input class="form-control" type="email" id="r-email" name="email" required autocomplete="email">
        <div class="invalid-feedback">Informe um e-mail válido.</div>
      </div>
      <button class="btn btn-primary w-100" type="submit">Enviar link de redefinição</button>
    </form>
    <p class="mt-3 mb-0 small"><a href="#/login">Voltar ao login</a></p>`));

  const form = el.querySelector('form');
  aoEnviar(form, async () => {
    const r = await api.post('/auth/recuperar-senha', { email: form.elements.email.value.trim() }, { semRedirecionar: true });
    mount(el.querySelector('#resultado'), alerta('success', r.mensagem || 'Se o e-mail estiver cadastrado, você receberá as instruções em instantes.'));
    form.reset();
    form.classList.remove('was-validated');
  });
}

export function telaRedefinirSenha({ el, query }) {
  const token = query.token;
  if (!token) {
    mount(el, cartaoCentral(html`
      <h1 class="h4" tabindex="-1">Redefinir senha</h1>
      ${alerta('danger', 'Link inválido: o código de redefinição não foi informado.')}
      <a href="#/recuperar-senha">Solicitar um novo link</a>`));
    return;
  }
  mount(el, cartaoCentral(html`
    <h1 class="h4 mb-1" tabindex="-1">Definir nova senha</h1>
    <p class="text-muted">Escolha uma nova senha para sua conta.</p>
    <div id="resultado"></div>
    <form novalidate>
      <div data-erros></div>
      <div class="mb-3">
        <label class="form-label" for="n-senha">Nova senha</label>
        <input class="form-control" type="password" id="n-senha" name="senha" required minlength="8" autocomplete="new-password" aria-describedby="n-dica">
        <div class="form-text" id="n-dica">${DICA_SENHA}</div>
        <div class="invalid-feedback">Informe uma senha com ao menos 8 caracteres.</div>
      </div>
      <div class="mb-3">
        <label class="form-label" for="n-senha2">Confirmar nova senha</label>
        <input class="form-control" type="password" id="n-senha2" name="senha2" required autocomplete="new-password">
        <div class="invalid-feedback">Repita a senha.</div>
      </div>
      <button class="btn btn-primary w-100" type="submit">Salvar nova senha</button>
    </form>`));

  const form = el.querySelector('form');
  aoEnviar(form, async () => {
    const senha = form.elements.senha.value;
    const erros = [];
    if (!SENHA_FORTE.test(senha)) erros.push(`Senha fraca. ${DICA_SENHA}`);
    if (senha !== form.elements.senha2.value) erros.push('A confirmação de senha não confere.');
    if (erros.length) throw new ErroForm(erros);
    const r = await api.post('/auth/redefinir-senha', { token, senha }, { semRedirecionar: true });
    form.remove();
    mount(el.querySelector('#resultado'), html`${alerta('success', r.mensagem || 'Senha alterada com sucesso.')}
      <a class="btn btn-primary" href="#/login">Ir para o login</a>`);
  });
}

export async function telaValidarCertificado({ el, query }) {
  mount(el, cartaoCentral(html`
    <h1 class="h4 mb-1" tabindex="-1">Validar certificado</h1>
    <p class="text-muted">Digite o código de validação impresso no certificado de participação.</p>
    <form novalidate class="mb-3">
      <div class="input-group">
        <input class="form-control" id="c-codigo" name="codigo" required placeholder="VOL-XXXX-XXXX-XXXX" aria-label="Código de validação" autocomplete="off" value="${query.codigo || ''}">
        <button class="btn btn-primary" type="submit">Validar</button>
      </div>
      <div class="invalid-feedback">Informe o código.</div>
    </form>
    <div id="resultado" aria-live="polite"></div>`, 'col-lg-6'));

  const form = el.querySelector('form');
  const saida = el.querySelector('#resultado');

  async function validar(codigo) {
    mount(saida, html`<div class="text-center text-muted py-2"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Verificando…</div>`);
    try {
      const r = await api.get(`/certificados/validar/${encodeURIComponent(codigo)}`, { semRedirecionar: true });
      mount(saida, html`<div class="alert alert-success" role="status">
        <h2 class="h6"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Certificado válido</h2>
        <dl class="row mb-0">
          <dt class="col-sm-4">Voluntário(a)</dt><dd class="col-sm-8">${r.nome}</dd>
          <dt class="col-sm-4">Ação</dt><dd class="col-sm-8">${r.acao}</dd>
          <dt class="col-sm-4">Data</dt><dd class="col-sm-8">${fmtData(r.data)}</dd>
          <dt class="col-sm-4">Horas</dt><dd class="col-sm-8">${fmtHoras(r.horas)}</dd>
        </dl></div>`);
    } catch (e) {
      mount(saida, alerta(e.status === 404 ? 'warning' : 'danger',
        e.status === 404 ? 'Código não encontrado. Confira os caracteres e tente novamente.' : mensagensDe(e).join(' ')));
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    form.classList.add('was-validated');
    const codigo = form.elements.codigo.value.trim().toUpperCase();
    if (codigo) validar(codigo);
  });
  if (query.codigo) await executar(null, () => validar(query.codigo.trim().toUpperCase()));
}
