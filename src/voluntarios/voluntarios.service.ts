import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { compare } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { hashSenha } from '../auth/auth.service';
import { ConfiguracaoService } from '../common/configuracao.service';
import { DatabaseService, Db } from '../common/database.service';
import { PG_VIOLACAO_UNICA } from '../common/sql';
import { Faixa, Validador } from '../common/validador';

export const FINALIDADE_CONSENTIMENTO = 'Mobilização para ações de voluntariado';

interface PerfilDto {
  nome: string;
  email: string;
  telefone: string;
  idRegiao: number;
  areas: number[];
  faixas: Faixa[];
}

@Injectable()
export class VoluntariosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cfg: ConfiguracaoService,
  ) {}

  private validarPerfil(v: Validador): PerfilDto {
    const nome = v.texto('nome', 'Nome', { min: 3, max: 150 });
    const email = v.email();
    const telefone = v.texto('telefone', 'Telefone', { min: 8, max: 30 });
    const idRegiao = v.inteiro('idRegiao', 'Região');
    const areas = v.listaInteiros('areas', 'Áreas de interesse', 1);
    const faixas = v.faixas('disponibilidades', 'Disponibilidade', 1);
    return { nome: nome!, email: email!, telefone: telefone!, idRegiao: idRegiao!, areas, faixas };
  }

  private async exigirCatalogo(db: Db, idRegiao: number, areas: number[]) {
    const [r] = await db.query(
      `SELECT (SELECT ativo FROM regiao WHERE id_regiao = $1) AS regiao,
              (SELECT COUNT(*)::int FROM area_atuacao WHERE ativo AND id_area = ANY($2::int[])) AS areas`,
      [idRegiao, areas],
    );
    if (!r.regiao) throw new UnprocessableEntityException('Região inválida ou inativa.');
    if (r.areas !== areas.length) throw new UnprocessableEntityException('Há áreas de interesse inválidas ou inativas.');
  }

  private async gravarAreasEFaixas(db: Db, id: number, areas: number[], faixas: Faixa[]) {
    await db.query('DELETE FROM voluntario_area WHERE id_usuario = $1', [id]);
    await db.query('DELETE FROM disponibilidade WHERE id_usuario = $1', [id]);
    await db.query(
      `INSERT INTO voluntario_area (id_usuario, id_area) SELECT $1, x FROM unnest($2::int[]) AS x`,
      [id, areas],
    );
    await db.query(
      `INSERT INTO disponibilidade (id_usuario, dia_semana, hora_inicio, hora_fim)
       SELECT $1, x.d, x.hi::time, x.hf::time FROM unnest($2::int[], $3::text[], $4::text[]) AS x(d, hi, hf)`,
      [id, faixas.map((f) => f.diaSemana), faixas.map((f) => f.horaInicio), faixas.map((f) => f.horaFim)],
    );
  }

  // ---------- UC03 / UC04 ----------

  async cadastrar(body: unknown): Promise<number> {
    const v = new Validador(body);
    const dto = this.validarPerfil(v);
    const senha = v.senha();
    v.concluir();
    if ((body as any).aceiteTermo !== true) {
      throw new UnprocessableEntityException('Para se cadastrar é necessário aceitar o termo de uso e a política de privacidade.');
    }
    await this.exigirCatalogo(this.db, dto.idRegiao, dto.areas);
    const senhaHash = await hashSenha(senha!);
    const cfg = await this.cfg.obter();

    try {
      return await this.db.tx(async (tx) => {
        const [{ id }] = await tx.query(
          `INSERT INTO usuario (nome, email, senha_hash, telefone, perfil) VALUES ($1,$2,$3,$4,'voluntario')
           RETURNING id_usuario AS id`,
          [dto.nome, dto.email, senhaHash, dto.telefone],
        );
        await tx.query('INSERT INTO voluntario (id_usuario, id_regiao) VALUES ($1, $2)', [id, dto.idRegiao]);
        await this.gravarAreasEFaixas(tx, id, dto.areas, dto.faixas);
        await tx.query(
          `INSERT INTO consentimento (id_usuario, versao_termo, finalidade) VALUES ($1, $2, $3)`,
          [id, cfg.termoVersao, FINALIDADE_CONSENTIMENTO],
        );
        return id as number;
      });
    } catch (e: any) {
      if (e?.code === PG_VIOLACAO_UNICA) throw new ConflictException('Este e-mail já está cadastrado.');
      throw e;
    }
  }

  // ---------- UC05 ----------

  async obterPerfil(id: number) {
    const [u] = await this.db.query(
      `SELECT u.id_usuario AS id, u.nome, u.email, u.telefone, v.id_regiao AS "idRegiao", r.nome AS regiao
       FROM usuario u JOIN voluntario v ON v.id_usuario = u.id_usuario
       LEFT JOIN regiao r ON r.id_regiao = v.id_regiao WHERE u.id_usuario = $1`,
      [id],
    );
    if (!u) throw new NotFoundException('Voluntário não encontrado.');
    const areas = await this.db.query<{ id_area: number }>('SELECT id_area FROM voluntario_area WHERE id_usuario = $1 ORDER BY id_area', [id]);
    const disponibilidades = await this.db.query(
      `SELECT dia_semana AS "diaSemana", to_char(hora_inicio, 'HH24:MI') AS "horaInicio", to_char(hora_fim, 'HH24:MI') AS "horaFim"
       FROM disponibilidade WHERE id_usuario = $1 ORDER BY dia_semana, hora_inicio`,
      [id],
    );
    return { ...u, areas: areas.map((a) => a.id_area), disponibilidades, consentimento: await this.consentimento(id) };
  }

  async atualizarPerfil(id: number, body: unknown) {
    const v = new Validador(body);
    const dto = this.validarPerfil(v);
    v.concluir();
    await this.exigirCatalogo(this.db, dto.idRegiao, dto.areas);
    try {
      await this.db.tx(async (tx) => {
        await tx.query('UPDATE usuario SET nome = $2, email = $3, telefone = $4 WHERE id_usuario = $1', [id, dto.nome, dto.email, dto.telefone]);
        await tx.query('UPDATE voluntario SET id_regiao = $2 WHERE id_usuario = $1', [id, dto.idRegiao]);
        await this.gravarAreasEFaixas(tx, id, dto.areas, dto.faixas);
      });
    } catch (e: any) {
      if (e?.code === PG_VIOLACAO_UNICA) throw new ConflictException('Este e-mail já está em uso.');
      throw e;
    }
    return this.obterPerfil(id);
  }

  // ---------- UC04: consentimento ----------

  async consentimento(id: number) {
    const [c] = await this.db.query(
      `SELECT versao_termo AS versao, data_aceite AS "dataAceite", data_revogacao AS "dataRevogacao"
       FROM consentimento WHERE id_usuario = $1 ORDER BY data_aceite DESC, id_consentimento DESC LIMIT 1`,
      [id],
    );
    if (!c) return { vigente: false, versao: null, dataAceite: null, dataRevogacao: null };
    return { vigente: c.dataRevogacao === null, ...c };
  }

  async aceitarConsentimento(id: number, body: any) {
    if (body?.aceite !== true) throw new UnprocessableEntityException('É necessário aceitar o termo.');
    const atual = await this.consentimento(id);
    if (!atual.vigente) {
      const cfg = await this.cfg.obter();
      await this.db.query(
        `INSERT INTO consentimento (id_usuario, versao_termo, finalidade) VALUES ($1, $2, $3)`,
        [id, cfg.termoVersao, FINALIDADE_CONSENTIMENTO],
      );
    }
    return this.consentimento(id);
  }

  async revogarConsentimento(id: number) {
    await this.db.query(
      'UPDATE consentimento SET data_revogacao = now() WHERE id_usuario = $1 AND data_revogacao IS NULL',
      [id],
    );
    return this.consentimento(id);
  }

  // ---------- UC10 ----------

  async excluirConta(id: number, body: any) {
    const senha = typeof body?.senha === 'string' ? body.senha : '';
    if (!senha) throw new UnprocessableEntityException('Informe sua senha para confirmar a exclusão.');
    const [u] = await this.db.query('SELECT senha_hash FROM usuario WHERE id_usuario = $1', [id]);
    if (!u || !(await compare(senha, u.senha_hash))) throw new UnauthorizedException('Senha incorreta.');
    await this.db.tx((tx) => this.anonimizar(tx, id));
    return { ok: true };
  }

  /** RN28: remove dados pessoais, revoga consentimentos e encerra a conta; mantém só dados agregados. */
  async anonimizar(db: Db, id: number) {
    const senhaAleatoria = await hashSenha(randomBytes(16).toString('hex'));
    await db.query(
      `UPDATE usuario SET nome = 'Voluntário removido', email = 'removido-' || id_usuario || '@anonimo.invalid',
              telefone = NULL, senha_hash = $2, situacao = 'excluido', data_exclusao = now()
       WHERE id_usuario = $1`,
      [id, senhaAleatoria],
    );
    await db.query('DELETE FROM disponibilidade WHERE id_usuario = $1', [id]);
    await db.query('DELETE FROM voluntario_area WHERE id_usuario = $1', [id]);
    await db.query('UPDATE voluntario SET id_regiao = NULL WHERE id_usuario = $1', [id]);
    await db.query('UPDATE consentimento SET data_revogacao = now() WHERE id_usuario = $1 AND data_revogacao IS NULL', [id]);
    await db.query('DELETE FROM notificacao WHERE id_usuario = $1', [id]);
    await db.query('DELETE FROM redefinicao_senha WHERE id_usuario = $1', [id]);
    await db.query(
      `UPDATE participacao SET situacao = 'cancelada', data_atualizacao = now()
       WHERE id_voluntario = $1 AND situacao IN ('sugerida','confirmada','selecionada')`,
      [id],
    );
  }

  /** Rotina agendada: anonimiza voluntários sem acesso além do prazo de retenção. */
  async anonimizarInativos(): Promise<number> {
    const cfg = await this.cfg.obter();
    const ids = await this.db.query<{ id: number }>(
      `SELECT id_usuario AS id FROM usuario
       WHERE perfil = 'voluntario' AND situacao <> 'excluido'
         AND ultimo_acesso < now() - ($1::int * interval '1 month')`,
      [cfg.retencaoMeses],
    );
    for (const { id } of ids) await this.db.tx((tx) => this.anonimizar(tx, id));
    return ids.length;
  }

  // ---------- UC08 ----------

  async historico(id: number) {
    const itens = await this.db.query(
      `SELECT p.id_participacao AS "idParticipacao", d.id_demanda AS "idDemanda", d.titulo, a.nome AS area,
              d.data_inicio AS data, p.situacao, COALESCE(p.horas_realizadas, 0)::float8 AS horas,
              c.codigo_validacao AS "codigoCertificado"
       FROM participacao p
       JOIN demanda d ON d.id_demanda = p.id_demanda
       JOIN area_atuacao a ON a.id_area = d.id_area
       LEFT JOIN certificado c ON c.id_participacao = p.id_participacao
       WHERE p.id_voluntario = $1 AND p.situacao IN ('compareceu','faltou','selecionada')
       ORDER BY d.data_inicio DESC`,
      [id],
    );
    const compareceu = itens.filter((i) => i.situacao === 'compareceu');
    return {
      totais: {
        acoes: compareceu.length,
        horas: Math.round(compareceu.reduce((s, i) => s + i.horas, 0) * 100) / 100,
        faltas: itens.filter((i) => i.situacao === 'faltou').length,
      },
      itens,
    };
  }
}
