import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { UsuarioSessao } from '../auth/auth.decorators';
import { hashSenha } from '../auth/auth.service';
import { Configuracao, ConfiguracaoService } from '../common/configuracao.service';
import { DatabaseService } from '../common/database.service';
import { escaparLike, PG_VIOLACAO_UNICA } from '../common/sql';
import { Validador } from '../common/validador';

const PERFIS = ['voluntario', 'gestor', 'administrador'];
const SITUACOES = ['ativo', 'inativo', 'excluido'];

// nomes de tabela vêm só desta lista fixa (nunca de entrada do usuário)
const CATALOGOS = {
  areas: { tabela: 'area_atuacao', pk: 'id_area', rotulo: 'Área' },
  regioes: { tabela: 'regiao', pk: 'id_regiao', rotulo: 'Região' },
} as const;
export type Catalogo = keyof typeof CATALOGOS;

const SENHA_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function gerarSenhaTemporaria(): string {
  for (;;) {
    let s = '';
    for (let i = 0; i < 12; i++) s += SENHA_ALFABETO[randomInt(SENHA_ALFABETO.length)];
    if (/[A-Za-z]/.test(s) && /\d/.test(s)) return s;
  }
}

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cfg: ConfiguracaoService,
  ) {}

  // ---------- UC19 ----------

  listarUsuarios(q: Record<string, any>) {
    const filtros: string[] = [];
    const params: any[] = [];
    if (typeof q.perfil === 'string' && PERFIS.includes(q.perfil)) {
      params.push(q.perfil);
      filtros.push(`u.perfil = $${params.length}`);
    }
    if (typeof q.situacao === 'string' && SITUACOES.includes(q.situacao)) {
      params.push(q.situacao);
      filtros.push(`u.situacao = $${params.length}`);
    } else {
      filtros.push(`u.situacao <> 'excluido'`);
    }
    if (typeof q.busca === 'string' && q.busca.trim()) {
      params.push(`%${escaparLike(q.busca.trim().slice(0, 100))}%`);
      filtros.push(`(u.nome ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    return this.db.query(
      `SELECT u.id_usuario AS id, u.nome, u.email, u.telefone, u.perfil, u.situacao,
              u.data_cadastro AS "dataCadastro", g.organizacao, g.cargo
       FROM usuario u LEFT JOIN gestor g ON g.id_usuario = u.id_usuario
       WHERE ${filtros.join(' AND ')} ORDER BY u.nome LIMIT 500`,
      params,
    );
  }

  private async obterUsuario(id: number) {
    const [u] = await this.db.query(
      `SELECT u.id_usuario AS id, u.nome, u.email, u.telefone, u.perfil, u.situacao,
              u.data_cadastro AS "dataCadastro", g.organizacao, g.cargo
       FROM usuario u LEFT JOIN gestor g ON g.id_usuario = u.id_usuario WHERE u.id_usuario = $1`,
      [id],
    );
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  async criarUsuario(body: unknown) {
    const v = new Validador(body);
    const nome = v.texto('nome', 'Nome', { min: 3, max: 150 });
    const email = v.email();
    const telefone = v.texto('telefone', 'Telefone', { min: 8, max: 30, opcional: true });
    const senha = v.senha();
    const perfil = v.texto('perfil', 'Perfil');
    const organizacao = v.texto('organizacao', 'Organização', { max: 150, opcional: true });
    const cargo = v.texto('cargo', 'Cargo', { max: 100, opcional: true });
    if (perfil && !['gestor', 'administrador'].includes(perfil)) v.erro('Perfil deve ser gestor ou administrador.');
    v.concluir();
    const senhaHash = await hashSenha(senha!);

    try {
      const id = await this.db.tx(async (tx) => {
        const [{ id }] = await tx.query(
          `INSERT INTO usuario (nome, email, senha_hash, telefone, perfil) VALUES ($1,$2,$3,$4,$5) RETURNING id_usuario AS id`,
          [nome, email, senhaHash, telefone ?? null, perfil],
        );
        if (perfil === 'gestor') {
          await tx.query('INSERT INTO gestor (id_usuario, organizacao, cargo) VALUES ($1,$2,$3)', [id, organizacao ?? null, cargo ?? null]);
        }
        return id as number;
      });
      return this.obterUsuario(id);
    } catch (e: any) {
      if (e?.code === PG_VIOLACAO_UNICA) throw new ConflictException('Este e-mail já está cadastrado.');
      throw e;
    }
  }

  async atualizarUsuario(admin: UsuarioSessao, id: number, body: unknown) {
    const v = new Validador(body);
    const nome = v.texto('nome', 'Nome', { min: 3, max: 150, opcional: true });
    const perfil = v.texto('perfil', 'Perfil', { opcional: true });
    const situacao = v.texto('situacao', 'Situação', { opcional: true });
    const organizacao = v.texto('organizacao', 'Organização', { max: 150, opcional: true });
    const cargo = v.texto('cargo', 'Cargo', { max: 100, opcional: true });
    if (perfil && !PERFIS.includes(perfil)) v.erro('Perfil inválido.');
    if (situacao && !['ativo', 'inativo'].includes(situacao)) v.erro('Situação deve ser ativo ou inativo.');
    v.concluir();

    const alvo = await this.obterUsuario(id);
    if (alvo.situacao === 'excluido') throw new UnprocessableEntityException('Conta excluída não pode ser alterada.');
    if (id === admin.id && ((perfil && perfil !== alvo.perfil) || (situacao && situacao !== alvo.situacao))) {
      throw new UnprocessableEntityException('Você não pode alterar o próprio perfil ou situação.');
    }

    await this.db.tx(async (tx) => {
      await tx.query(
        `UPDATE usuario SET nome = COALESCE($2::text, nome), perfil = COALESCE($3::text, perfil),
                situacao = COALESCE($4::text, situacao) WHERE id_usuario = $1`,
        [id, nome ?? null, perfil ?? null, situacao ?? null],
      );
      const perfilFinal = perfil ?? alvo.perfil;
      if (perfilFinal === 'gestor') {
        await tx.query(
          `INSERT INTO gestor (id_usuario, organizacao, cargo) VALUES ($1, $2::text, $3::text)
           ON CONFLICT (id_usuario) DO UPDATE
           SET organizacao = COALESCE($2::text, gestor.organizacao), cargo = COALESCE($3::text, gestor.cargo)`,
          [id, organizacao ?? null, cargo ?? null],
        );
      } else if (perfilFinal === 'voluntario') {
        await tx.query('INSERT INTO voluntario (id_usuario) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
      }
    });
    return this.obterUsuario(id);
  }

  /** A senha temporária é devolvida uma única vez; senhas existentes nunca são exibidas. */
  async redefinirAcesso(id: number) {
    const alvo = await this.obterUsuario(id);
    if (alvo.situacao === 'excluido') throw new UnprocessableEntityException('Conta excluída não pode ser alterada.');
    const senhaTemporaria = gerarSenhaTemporaria();
    await this.db.tx(async (tx) => {
      await tx.query('UPDATE usuario SET senha_hash = $2 WHERE id_usuario = $1', [id, await hashSenha(senhaTemporaria)]);
      await tx.query('DELETE FROM redefinicao_senha WHERE id_usuario = $1', [id]);
    });
    return { senhaTemporaria };
  }

  /**
   * Exclusão definitiva de um usuário. As demandas que ele cadastrou passam para o administrador
   * que executou a exclusão; participações, notificações e certificados do usuário são removidos.
   */
  async excluirUsuario(admin: UsuarioSessao, id: number) {
    if (id === admin.id) throw new UnprocessableEntityException('Você não pode excluir a própria conta.');
    await this.obterUsuario(id);
    await this.db.tx(async (tx) => {
      await tx.query('UPDATE demanda SET id_gestor = $2 WHERE id_gestor = $1', [id, admin.id]);
      await tx.query('DELETE FROM usuario WHERE id_usuario = $1', [id]);
    });
    return { ok: true };
  }

  // ---------- UC20 ----------

  listarCatalogo(tipo: Catalogo) {
    const c = CATALOGOS[tipo];
    return this.db.query(`SELECT ${c.pk} AS id, nome, ativo FROM ${c.tabela} ORDER BY nome`);
  }

  async criarCatalogo(tipo: Catalogo, body: unknown) {
    const c = CATALOGOS[tipo];
    const v = new Validador(body);
    const nome = v.texto('nome', 'Nome', { min: 2, max: 100 });
    v.concluir();
    try {
      const [item] = await this.db.query(`INSERT INTO ${c.tabela} (nome) VALUES ($1) RETURNING ${c.pk} AS id, nome, ativo`, [nome]);
      return item;
    } catch (e: any) {
      if (e?.code === PG_VIOLACAO_UNICA) throw new ConflictException(`${c.rotulo} com este nome já existe.`);
      throw e;
    }
  }

  async atualizarCatalogo(tipo: Catalogo, id: number, body: unknown) {
    const c = CATALOGOS[tipo];
    const v = new Validador(body);
    const nome = v.texto('nome', 'Nome', { min: 2, max: 100, opcional: true });
    const ativo = v.booleano('ativo');
    v.concluir();
    try {
      const [item] = await this.db.query(
        `UPDATE ${c.tabela} SET nome = COALESCE($2::text, nome), ativo = COALESCE($3::boolean, ativo)
         WHERE ${c.pk} = $1 RETURNING ${c.pk} AS id, nome, ativo`,
        [id, nome ?? null, ativo ?? null],
      );
      if (!item) throw new NotFoundException(`${c.rotulo} não encontrada.`);
      return item;
    } catch (e: any) {
      if (e?.code === PG_VIOLACAO_UNICA) throw new ConflictException(`${c.rotulo} com este nome já existe.`);
      throw e;
    }
  }

  /** Exclusão definitiva; bloqueada enquanto houver demandas usando o item. */
  async excluirCatalogo(tipo: Catalogo, id: number) {
    const c = CATALOGOS[tipo];
    const [{ n }] = await this.db.query(`SELECT COUNT(*)::int AS n FROM demanda WHERE ${c.pk} = $1`, [id]);
    if (n > 0) {
      throw new ConflictException(
        `${c.rotulo} usada em ${n} demanda(s). Exclua ou altere essas demandas antes, ou apenas inative.`,
      );
    }
    const r = await this.db.tx(async (tx) => {
      if (tipo === 'areas') await tx.query('DELETE FROM voluntario_area WHERE id_area = $1', [id]);
      else await tx.query('UPDATE voluntario SET id_regiao = NULL WHERE id_regiao = $1', [id]);
      return tx.query(`DELETE FROM ${c.tabela} WHERE ${c.pk} = $1 RETURNING ${c.pk}`, [id]);
    });
    if (!r.length) throw new NotFoundException(`${c.rotulo} não encontrada.`);
    return { ok: true };
  }

  // ---------- RN33 ----------

  obterConfig() {
    return this.cfg.obter();
  }

  async atualizarConfig(body: unknown) {
    const v = new Validador(body);
    const pesoBase = v.inteiro('pesoBase', 'Peso base', { min: 0, max: 1000, opcional: true });
    const pesoRegiao = v.inteiro('pesoRegiao', 'Peso da região', { min: 0, max: 1000, opcional: true });
    const retencaoMeses = v.inteiro('retencaoMeses', 'Prazo de retenção (meses)', { min: 1, max: 120, opcional: true });
    const nomeOrganizacao = v.texto('nomeOrganizacao', 'Nome da organização', { min: 3, max: 100, opcional: true });
    v.concluir();
    const parcial: Partial<Configuracao> = { pesoBase, pesoRegiao, retencaoMeses, nomeOrganizacao };
    return this.cfg.atualizar(parcial);
  }
}
