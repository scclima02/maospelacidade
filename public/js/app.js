import { api, definirAoNaoAutorizado } from './api.js';
import { state } from './state.js';
import { definirRotas, iniciarRouter, navegar } from './router.js';
import { renderCabecalho, renderRodape, atualizarBadge } from './cabecalho.js';
import { iniciarEfeitos } from './efeitos.js';
import { iniciarSeletores } from './seletor.js';
import { telaLanding } from './landing.js';
import { toast } from './ui.js';
import {
  telaLogin, telaCadastro, telaRecuperarSenha, telaRedefinirSenha, telaValidarCertificado,
} from './auth.js';
import {
  telaOportunidades, telaOportunidadeDetalhe, telaNotificacoes, telaHistorico, telaPerfil,
} from './voluntario.js';
import { telaDemandas, telaDemandaForm, telaDemandaDetalhe } from './gestor.js';
import {
  telaPainel, telaRelatorios, telaUsuarios, telaCatalogos, telaConfig,
} from './admin.js';

const V = ['voluntario'];
const A = ['administrador'];
const GA = ['gestor', 'administrador'];
const TODOS = ['voluntario', 'gestor', 'administrador'];

definirRotas([
  { caminho: '/', publica: true, soDeslogado: true, tela: telaLanding, titulo: 'Mãos pela Cidade — Voluntariado comunitário' },
  { caminho: '/login', publica: true, soDeslogado: true, tela: telaLogin },
  { caminho: '/cadastro', publica: true, soDeslogado: true, tela: telaCadastro },
  { caminho: '/recuperar-senha', publica: true, soDeslogado: true, tela: telaRecuperarSenha },
  { caminho: '/redefinir-senha', publica: true, tela: telaRedefinirSenha },
  { caminho: '/validar', publica: true, tela: telaValidarCertificado },

  { caminho: '/oportunidades', perfis: TODOS, tela: telaOportunidades },
  { caminho: '/oportunidades/demanda/:idDemanda', perfis: TODOS, tela: telaOportunidadeDetalhe },
  { caminho: '/oportunidades/:id', perfis: TODOS, tela: telaOportunidadeDetalhe },
  { caminho: '/notificacoes', perfis: V, tela: telaNotificacoes },
  { caminho: '/historico', perfis: TODOS, tela: telaHistorico },
  { caminho: '/perfil', perfis: V, tela: telaPerfil },

  { caminho: '/demandas', perfis: GA, tela: telaDemandas },
  { caminho: '/demandas/nova', perfis: GA, tela: (ctx) => telaDemandaForm(ctx, false) },
  { caminho: '/demandas/:id/editar', perfis: GA, tela: (ctx) => telaDemandaForm(ctx, true) },
  { caminho: '/demandas/:id', perfis: GA, tela: telaDemandaDetalhe },

  { caminho: '/admin/painel', perfis: A, tela: telaPainel },
  { caminho: '/admin/relatorios', perfis: A, tela: telaRelatorios },
  { caminho: '/admin/usuarios', perfis: A, tela: telaUsuarios },
  { caminho: '/admin/catalogos', perfis: A, tela: telaCatalogos },
  { caminho: '/admin/config', perfis: A, tela: telaConfig },
]);

async function iniciar() {
  definirAoNaoAutorizado(() => {
    if (!state.usuario) return;
    state.usuario = null;
    state.naoLidas = 0;
    toast('Sua sessão expirou. Entre novamente.', 'warning');
    navegar('#/login');
  });

  try {
    const cfg = await api.get('/publico/config', { semRedirecionar: true });
    state.config = { ...state.config, ...cfg };
  } catch { /* mantém o nome padrão */ }

  try {
    const me = await api.get('/auth/me', { semRedirecionar: true });
    state.usuario = me && me.usuario ? me.usuario : me;
  } catch {
    state.usuario = null;
  }

  document.getElementById('pular').addEventListener('click', () => document.getElementById('conteudo').focus());
  renderRodape();
  iniciarEfeitos();
  iniciarSeletores();

  iniciarRouter(({ caminho }) => {
    // A página inicial ocupa a largura toda; as demais ficam no contêiner.
    document.getElementById('conteudo').classList.toggle('sem-container', caminho === '/');
    renderCabecalho(caminho);
    atualizarBadge();
  });

  // Mantém o contador de notificações atualizado enquanto a página está aberta.
  setInterval(atualizarBadge, 60000);
}

iniciar();
