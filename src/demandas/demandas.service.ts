import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsuarioSessao } from '../auth/auth.decorators';
import { Configuracao, ConfiguracaoService } from '../common/configuracao.service';
import { DatabaseService, Db } from '../common/database.service';
import { fimDoDia, formatarDataHora, inicioDoDia } from '../common/datas';
import { escaparLike, taxaComparecimentoSql } from '../common/sql';
import { Validador, diaOpcional, inteiroOpcional } from '../common/validador';
import { NotificacoesService, NovaNotificacao } from '../notificacoes/notificacoes.service';
import { Candidato, Compativel, cruzar } from './cruzamento';

export interface DemandaDto {
  titulo: string;
  descricao: string;
  idArea: number;
  idRegiao: number;
  local: string;
  inicio: Date;
  fim: Date;
  vagas: number;
}

const SITUACOES_DEMANDA = ['aberta', 'concluida', 'cancelada'];
const CONTATO_LIBERADO = ['confirmada', 'selecionada', 'compareceu', 'faltou'];

const BASE_DEMANDA = `
  SELECT d.id_demanda AS id, d.titulo, d.descricao, d.id_area AS "idArea", a.nome AS area,
         d.id_regiao AS "idRegiao", r.nome AS regiao, d.local_acao AS "local",
         d.data_inicio AS "dataInicio", d.data_fim AS "dataFim", d.vagas, d.situacao,
         d.id_gestor AS "idGestor", ug.nome AS gestor,
         (SELECT COUNT(*)::int FROM participacao p WHERE p.id_demanda = d.id_demanda AND p.situacao = 'sugerida') AS sugeridas,
         (SELECT COUNT(*)::int FROM participacao p WHERE p.id_demanda = d.id_demanda AND p.situacao = 'confirmada') AS confirmadas,
         (SELECT COUNT(*)::int FROM participacao p WHERE p.id_demanda = d.id_demanda AND p.situacao = 'selecionada') AS selecionadas,
         (SELECT COUNT(*)::int FROM participacao p WHERE p.id_demanda = d.id_demanda AND p.situacao = 'compareceu') AS compareceram,
         (SELECT COUNT(*)::int FROM participacao p WHERE p.id_demanda = d.id_demanda AND p.situacao = 'faltou') AS faltaram
  FROM demanda d
  JOIN area_atuacao a ON a.id_area = d.id_area
  JOIN regiao r ON r.id_regiao = d.id_regiao
  JOIN usuario ug ON ug.id_usuario = d.id_gestor`;

@Injectable()
export class DemandasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cfg: ConfiguracaoService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  // ---------- validação ----------

  validar(body: unknown): DemandaDto {
    const v = new Validador(body);
    const titulo = v.texto('titulo', 'Título', { max: 200 });
    const descricao = v.texto('descricao', 'Descrição', { max: 5000 });
    const idArea = v.inteiro('idArea', 'Área de atuação');
    const idRegiao = v.inteiro('idRegiao', 'Região');
    const local = v.texto('local', 'Local', { max: 250 });
    const inicio = v.dataHora('dataInicio', 'Data/hora de início');
    const fim = v.dataHora('dataFim', 'Data/hora de término');
    const vagas = v.inteiro('vagas', 'Número de voluntários', { min: 1, max: 10000 });
    v.concluir();
    if (fim! <= inicio!) throw new UnprocessableEntityException('O término deve ser posterior ao início.');
    return {
      titulo: titulo!,
      descricao: descricao!,
      idArea: idArea!,
      idRegiao: idRegiao!,
      local: local!,
      inicio: inicio!,
      fim: fim!,
      vagas: vagas!,
    };
  }

  private async exigirCatalogoAtivo(db: Db, idArea: number, idRegiao: number) {
    const [r] = await db.query(
      `SELECT (SELECT ativo FROM area_atuacao WHERE id_area = $1) AS area,
              (SELECT ativo FROM regiao WHERE id_regiao = $2) AS regiao`,
      [idArea, idRegiao],
    );
    if (!r.area) throw new UnprocessableEntityException('Área de atuação inválida ou inativa.');
    if (!r.regiao) throw new UnprocessableEntityException('Região inválida ou inativa.');
  }

  // ---------- consultas ----------

  private mapear(l: any, u: UsuarioSessao) {
    const { sugeridas, confirmadas, selecionadas, compareceram, faltaram, ...resto } = l;
    return {
      ...resto,
      totais: { sugeridas, confirmadas, selecionadas, compareceram, faltaram },
      podeEditar: u.perfil === 'gestor' && l.idGestor === u.id && l.situacao === 'aberta',
    };
  }

  async obter(id: number, u: UsuarioSessao) {
    const [l] = await this.db.query(`${BASE_DEMANDA} WHERE d.id_demanda = $1`, [id]);
    if (!l) throw new NotFoundException('Demanda não encontrada.');
    return this.mapear(l, u);
  }

  async listar(u: UsuarioSessao, q: Record<string, any>) {
    const filtros: string[] = [];
    const params: any[] = [];
    const add = (sql: string, valor: any) => {
      params.push(valor);
      filtros.push(sql.replace('?', `$${params.length}`));
    };

    const idArea = inteiroOpcional(q.idArea);
    const idRegiao = inteiroOpcional(q.idRegiao);
    if (idArea) add('d.id_area = ?', idArea);
    if (idRegiao) add('d.id_regiao = ?', idRegiao);
    const de = diaOpcional(q.de);
    const ate = diaOpcional(q.ate);
    if (de) add('d.data_inicio >= ?', inicioDoDia(de));
    if (ate) add('d.data_inicio <= ?', fimDoDia(ate));
    if (typeof q.situacao === 'string' && SITUACOES_DEMANDA.includes(q.situacao)) add('d.situacao = ?', q.situacao);
    if (q.minhas === '1' || q.minhas === 'true') add('d.id_gestor = ?', u.id);
    if (typeof q.busca === 'string' && q.busca.trim()) {
      params.push(`%${escaparLike(q.busca.trim().slice(0, 100))}%`);
      filtros.push(`(d.titulo ILIKE $${params.length} OR d.descricao ILIKE $${params.length})`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const linhas = await this.db.query(`${BASE_DEMANDA} ${where} ORDER BY d.data_inicio DESC, d.id_demanda DESC LIMIT 300`, params);
    return linhas.map((l) => this.mapear(l, u));
  }

  /** UC15: compatíveis em ordem; contato só para quem confirmou (RN22). */
  async voluntarios(idDemanda: number) {
    const [d] = await this.db.query('SELECT id_regiao FROM demanda WHERE id_demanda = $1', [idDemanda]);
    if (!d) throw new NotFoundException('Demanda não encontrada.');
    const linhas = await this.db.query(
      `SELECT p.id_participacao AS "idParticipacao", p.id_voluntario AS "idVoluntario", u.nome,
              rg.nome AS regiao, (v.id_regiao = $2) AS "mesmaRegiao", p.situacao,
              p.pontuacao::float8 AS pontuacao, ${taxaComparecimentoSql('p.id_voluntario')} AS "taxaComparecimento",
              p.horas_realizadas::float8 AS "horasRealizadas", u.email, u.telefone
       FROM participacao p
       JOIN usuario u ON u.id_usuario = p.id_voluntario
       JOIN voluntario v ON v.id_usuario = p.id_voluntario
       LEFT JOIN regiao rg ON rg.id_regiao = v.id_regiao
       WHERE p.id_demanda = $1
       ORDER BY p.pontuacao DESC, COALESCE(${taxaComparecimentoSql('p.id_voluntario')}, 0) DESC, u.nome`,
      [idDemanda, d.id_regiao],
    );
    return linhas.map((l) => {
      const liberado = CONTATO_LIBERADO.includes(l.situacao);
      return { ...l, mesmaRegiao: !!l.mesmaRegiao, email: liberado ? l.email : null, telefone: liberado ? l.telefone : null };
    });
  }

  /** UC16 */
  async resumoVoluntario(idVoluntario: number) {
    const [v] = await this.db.query(
      `SELECT u.nome, ${taxaComparecimentoSql('u.id_usuario')} AS taxa,
              (SELECT COUNT(*)::int FROM participacao p WHERE p.id_voluntario = u.id_usuario AND p.situacao = 'compareceu') AS participacoes,
              (SELECT COALESCE(SUM(p.horas_realizadas), 0)::float8 FROM participacao p WHERE p.id_voluntario = u.id_usuario AND p.situacao = 'compareceu') AS horas,
              (SELECT COUNT(*)::int FROM participacao p WHERE p.id_voluntario = u.id_usuario AND p.situacao = 'faltou') AS faltas
       FROM usuario u WHERE u.id_usuario = $1 AND u.perfil = 'voluntario'`,
      [idVoluntario],
    );
    if (!v) throw new NotFoundException('Voluntário não encontrado.');
    const ultimas = await this.db.query(
      `SELECT d.titulo, d.data_inicio AS data, p.situacao, p.horas_realizadas::float8 AS horas
       FROM participacao p JOIN demanda d ON d.id_demanda = p.id_demanda
       WHERE p.id_voluntario = $1 AND p.situacao IN ('compareceu','faltou','selecionada')
       ORDER BY d.data_inicio DESC LIMIT 5`,
      [idVoluntario],
    );
    return {
      nome: v.nome,
      participacoes: v.participacoes,
      horas: v.horas,
      faltas: v.faltas,
      taxaComparecimento: v.taxa,
      ultimas,
    };
  }

  // ---------- UC12: cruzamento ----------

  private async buscarCompativeis(
    db: Db,
    d: { id: number; idArea: number; idRegiao: number; inicio: Date; fim: Date },
    cfg: Configuracao,
  ): Promise<Compativel[]> {
    const base = await db.query<Omit<Candidato, 'faixas'>>(
      `SELECT u.id_usuario AS "idVoluntario", u.nome, u.email, v.id_regiao AS "idRegiao",
              COALESCE(${taxaComparecimentoSql('u.id_usuario')}, 0)::float8 AS taxa
       FROM usuario u
       JOIN voluntario v ON v.id_usuario = u.id_usuario
       JOIN voluntario_area va ON va.id_usuario = u.id_usuario AND va.id_area = $1
       WHERE u.perfil = 'voluntario' AND u.situacao = 'ativo'
         AND EXISTS (SELECT 1 FROM consentimento c WHERE c.id_usuario = u.id_usuario AND c.data_revogacao IS NULL)
         AND NOT EXISTS (SELECT 1 FROM participacao p WHERE p.id_demanda = $2 AND p.id_voluntario = u.id_usuario
                         AND p.situacao IN ('recusada','cancelada'))`,
      [d.idArea, d.id],
    );
    if (!base.length) return [];
    const faixas = await db.query(
      `SELECT id_usuario AS "idUsuario", dia_semana AS "diaSemana",
              to_char(hora_inicio, 'HH24:MI') AS "horaInicio", to_char(hora_fim, 'HH24:MI') AS "horaFim"
       FROM disponibilidade WHERE id_usuario = ANY($1::int[])`,
      [base.map((b) => b.idVoluntario)],
    );
    const porUsuario = new Map<number, any[]>();
    for (const f of faixas) porUsuario.set(f.idUsuario, [...(porUsuario.get(f.idUsuario) ?? []), f]);
    const candidatos: Candidato[] = base.map((b) => ({ ...b, faixas: porUsuario.get(b.idVoluntario) ?? [] }));
    return cruzar(candidatos, { idRegiao: d.idRegiao, inicio: d.inicio, fim: d.fim }, cfg);
  }

  private async inserirSugeridas(db: Db, idDemanda: number, lista: Compativel[]) {
    if (!lista.length) return [] as { id: number; idVoluntario: number }[];
    return db.query<{ id: number; idVoluntario: number }>(
      `INSERT INTO participacao (id_demanda, id_voluntario, situacao, pontuacao)
       SELECT $1, x.id, 'sugerida', x.pont FROM unnest($2::int[], $3::numeric[]) AS x(id, pont)
       RETURNING id_participacao AS id, id_voluntario AS "idVoluntario"`,
      [idDemanda, lista.map((c) => c.idVoluntario), lista.map((c) => c.pontuacao)],
    );
  }

  private notificacaoOportunidade(d: DemandaDto, c: Compativel, idParticipacao: number): NovaNotificacao {
    return {
      idUsuario: c.idVoluntario,
      email: c.email,
      idDemanda: null, // preenchido pelo chamador
      tipo: 'oportunidade',
      assunto: `Nova oportunidade de voluntariado: ${d.titulo}`,
      mensagem: `Nova oportunidade compatível com o seu perfil: "${d.titulo}" em ${formatarDataHora(d.inicio)}, local: ${d.local}.`,
      rota: `/oportunidades/${idParticipacao}`,
    };
  }

  // ---------- UC11 ----------

  async criar(u: UsuarioSessao, body: unknown) {
    const dto = this.validar(body);
    if (dto.inicio <= new Date()) throw new UnprocessableEntityException('A data de início deve ser futura.');
    await this.exigirCatalogoAtivo(this.db, dto.idArea, dto.idRegiao);
    const cfg = await this.cfg.obter();

    const { id, avisos } = await this.db.tx(async (tx) => {
      const [{ id }] = await tx.query(
        `INSERT INTO demanda (id_gestor, id_area, id_regiao, titulo, descricao, local_acao, data_inicio, data_fim, vagas, situacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'aberta') RETURNING id_demanda AS id`,
        [u.id, dto.idArea, dto.idRegiao, dto.titulo, dto.descricao, dto.local, dto.inicio, dto.fim, dto.vagas],
      );
      const compativeis = await this.buscarCompativeis(tx, { id, ...dto }, cfg);
      const gravadas = await this.inserirSugeridas(tx, id, compativeis);
      const idPorVoluntario = new Map(gravadas.map((g) => [g.idVoluntario, g.id]));
      const avisos = compativeis.map((c) => ({
        ...this.notificacaoOportunidade(dto, c, idPorVoluntario.get(c.idVoluntario)!),
        idDemanda: id,
      }));
      return { id, avisos };
    });

    await this.notificacoes.notificar(avisos); // UC13
    return { demanda: await this.obter(id, u), compativeis: avisos.length };
  }

  // ---------- UC14 ----------

  private async carregarDoDono(tx: Db, id: number, u: UsuarioSessao) {
    const [d] = await tx.query(
      `SELECT id_demanda AS id, id_gestor AS "idGestor", id_area AS "idArea", id_regiao AS "idRegiao",
              data_inicio AS inicio, data_fim AS fim, local_acao AS "local", titulo, vagas, situacao
       FROM demanda WHERE id_demanda = $1 FOR UPDATE`,
      [id],
    );
    if (!d) throw new NotFoundException('Demanda não encontrada.');
    if (d.idGestor !== u.id) throw new ForbiddenException('Somente o gestor que cadastrou a demanda pode alterá-la.');
    return d;
  }

  async atualizar(u: UsuarioSessao, id: number, body: unknown) {
    const dto = this.validar(body);
    const cfg = await this.cfg.obter();

    const avisos = await this.db.tx(async (tx) => {
      const atual = await this.carregarDoDono(tx, id, u);
      if (atual.situacao !== 'aberta') throw new UnprocessableEntityException('Só é possível editar demandas abertas.');
      if (atual.idArea !== dto.idArea || atual.idRegiao !== dto.idRegiao) {
        await this.exigirCatalogoAtivo(tx, dto.idArea, dto.idRegiao);
      }
      const [{ n }] = await tx.query(
        `SELECT COUNT(*)::int AS n FROM participacao WHERE id_demanda = $1 AND situacao = 'selecionada'`,
        [id],
      );
      if (dto.vagas < n) {
        throw new UnprocessableEntityException(`Já há ${n} voluntário(s) selecionado(s); o número de vagas não pode ser menor.`);
      }

      await tx.query(
        `UPDATE demanda SET id_area=$2, id_regiao=$3, titulo=$4, descricao=$5, local_acao=$6,
                data_inicio=$7, data_fim=$8, vagas=$9 WHERE id_demanda=$1`,
        [id, dto.idArea, dto.idRegiao, dto.titulo, dto.descricao, dto.local, dto.inicio, dto.fim, dto.vagas],
      );

      const mudouCruzamento =
        atual.idArea !== dto.idArea ||
        atual.idRegiao !== dto.idRegiao ||
        atual.inicio.getTime() !== dto.inicio.getTime() ||
        atual.fim.getTime() !== dto.fim.getTime();
      const mudouLocal = atual.local !== dto.local;
      const avisos: NovaNotificacao[] = [];

      if (mudouCruzamento) {
        const compat = await this.buscarCompativeis(tx, { id, ...dto }, cfg);
        const existentes = await tx.query<{ idVoluntario: number }>(
          `SELECT id_voluntario AS "idVoluntario" FROM participacao WHERE id_demanda = $1`,
          [id],
        );
        const jaTem = new Set(existentes.map((e) => e.idVoluntario));
        const novos = compat.filter((c) => !jaTem.has(c.idVoluntario));
        const mantidos = compat.filter((c) => jaTem.has(c.idVoluntario));

        await tx.query(
          `UPDATE participacao p SET pontuacao = x.pont, data_atualizacao = now()
           FROM unnest($2::int[], $3::numeric[]) AS x(id, pont)
           WHERE p.id_demanda = $1 AND p.id_voluntario = x.id AND p.situacao IN ('sugerida','confirmada','selecionada')`,
          [id, mantidos.map((c) => c.idVoluntario), mantidos.map((c) => c.pontuacao)],
        );
        await tx.query(
          `DELETE FROM participacao WHERE id_demanda = $1 AND situacao = 'sugerida' AND id_voluntario <> ALL($2::int[])`,
          [id, compat.map((c) => c.idVoluntario)],
        );
        const gravadas = await this.inserirSugeridas(tx, id, novos);
        const idPorVoluntario = new Map(gravadas.map((g) => [g.idVoluntario, g.id]));
        for (const c of novos) {
          avisos.push({ ...this.notificacaoOportunidade(dto, c, idPorVoluntario.get(c.idVoluntario)!), idDemanda: id });
        }
      }

      if (mudouCruzamento || mudouLocal) {
        const envolvidos = await tx.query(
          `SELECT p.id_participacao AS id, u.id_usuario AS "idUsuario", u.email
           FROM participacao p JOIN usuario u ON u.id_usuario = p.id_voluntario
           WHERE p.id_demanda = $1 AND p.situacao IN ('confirmada','selecionada')`,
          [id],
        );
        for (const e of envolvidos) {
          avisos.push({
            idUsuario: e.idUsuario,
            email: e.email,
            idDemanda: id,
            tipo: 'alteracao',
            assunto: `Demanda alterada: ${dto.titulo}`,
            mensagem: `A demanda "${dto.titulo}" foi alterada. Novo horário: ${formatarDataHora(dto.inicio)} a ${formatarDataHora(dto.fim)}, local: ${dto.local}. Confira se ainda pode participar.`,
            rota: `/oportunidades/${e.id}`,
          });
        }
      }
      return avisos;
    });

    await this.notificacoes.notificar(avisos);
    return this.obter(id, u);
  }

  async cancelar(u: UsuarioSessao, id: number) {
    const avisos = await this.db.tx(async (tx) => {
      const d = await this.carregarDoDono(tx, id, u);
      if (d.situacao !== 'aberta') throw new UnprocessableEntityException('Só é possível cancelar demandas abertas.');
      await tx.query(`UPDATE demanda SET situacao = 'cancelada' WHERE id_demanda = $1`, [id]);
      const envolvidos = await tx.query(
        `UPDATE participacao p SET situacao = 'cancelada', data_atualizacao = now()
         FROM usuario u
         WHERE p.id_demanda = $1 AND p.situacao IN ('sugerida','confirmada','selecionada') AND u.id_usuario = p.id_voluntario
         RETURNING u.id_usuario AS "idUsuario", u.email`,
        [id],
      );
      return envolvidos.map(
        (e): NovaNotificacao => ({
          idUsuario: e.idUsuario,
          email: e.email,
          idDemanda: id,
          tipo: 'cancelamento',
          assunto: `Demanda cancelada: ${d.titulo}`,
          mensagem: `A demanda "${d.titulo}" foi cancelada pelo gestor.`,
        }),
      );
    });
    await this.notificacoes.notificar(avisos);
    return this.obter(id, u);
  }

  // ---------- UC17 ----------

  async selecionar(u: UsuarioSessao, id: number, body: unknown) {
    const v = new Validador(body);
    const ids = v.listaInteiros('idParticipacoes', 'Participações', 1);
    v.concluir();

    const avisos = await this.db.tx(async (tx) => {
      const d = await this.carregarDoDono(tx, id, u);
      if (d.situacao !== 'aberta') throw new UnprocessableEntityException('A demanda não está aberta.');
      const alvo = await tx.query(
        `SELECT p.id_participacao AS id, p.situacao, u.id_usuario AS "idUsuario", u.email
         FROM participacao p JOIN usuario u ON u.id_usuario = p.id_voluntario
         WHERE p.id_demanda = $1 AND p.id_participacao = ANY($2::int[])`,
        [id, ids],
      );
      if (alvo.length !== ids.length) throw new UnprocessableEntityException('Há participações que não pertencem a esta demanda.');
      if (alvo.some((a) => a.situacao !== 'confirmada')) {
        throw new UnprocessableEntityException('Só é possível selecionar voluntários que confirmaram participação.');
      }
      const [{ n }] = await tx.query(
        `SELECT COUNT(*)::int AS n FROM participacao WHERE id_demanda = $1 AND situacao = 'selecionada'`,
        [id],
      );
      if (n + ids.length > d.vagas) {
        const restam = Math.max(d.vagas - n, 0);
        throw new ConflictException(`Vagas esgotadas: a demanda tem ${d.vagas} vaga(s), ${n} já preenchida(s) e restam ${restam}.`);
      }
      await tx.query(
        `UPDATE participacao SET situacao = 'selecionada', data_atualizacao = now() WHERE id_participacao = ANY($1::int[])`,
        [ids],
      );
      return alvo.map(
        (a): NovaNotificacao => ({
          idUsuario: a.idUsuario,
          email: a.email,
          idDemanda: id,
          tipo: 'selecao',
          assunto: `Você foi selecionado(a): ${d.titulo}`,
          mensagem: `Você foi selecionado(a) para a ação "${d.titulo}" em ${formatarDataHora(d.inicio)}, local: ${d.local}.`,
          rota: `/oportunidades/${a.id}`,
        }),
      );
    });
    await this.notificacoes.notificar(avisos);
    return this.voluntarios(id);
  }

  async desselecionar(u: UsuarioSessao, id: number, body: unknown) {
    const v = new Validador(body);
    const idParticipacao = v.inteiro('idParticipacao', 'Participação');
    v.concluir();
    await this.db.tx(async (tx) => {
      const d = await this.carregarDoDono(tx, id, u);
      if (d.situacao !== 'aberta') throw new UnprocessableEntityException('A demanda não está aberta.');
      const r = await tx.query(
        `UPDATE participacao SET situacao = 'confirmada', data_atualizacao = now()
         WHERE id_participacao = $1 AND id_demanda = $2 AND situacao = 'selecionada' RETURNING id_participacao`,
        [idParticipacao, id],
      );
      if (!r.length) throw new UnprocessableEntityException('Participação não está selecionada nesta demanda.');
    });
    return this.voluntarios(id);
  }

  // ---------- UC18 ----------

  async registrarPresencas(u: UsuarioSessao, id: number, body: any) {
    if (!Array.isArray(body?.registros) || body.registros.length < 1 || body.registros.length > 500) {
      throw new UnprocessableEntityException('Informe os registros de presença.');
    }
    const registros: { id: number; compareceu: boolean; horas?: number }[] = [];
    for (const r of body.registros) {
      const v = new Validador(r);
      const idParticipacao = v.inteiro('idParticipacao', 'Participação');
      if (typeof r?.compareceu !== 'boolean') v.erro('Informe se o voluntário compareceu.');
      let horas: number | undefined;
      if (r?.horas !== undefined && r?.horas !== null && r?.horas !== '') {
        horas = Number(r.horas);
        if (!Number.isFinite(horas) || horas < 0 || horas > 999) v.erro('Horas inválidas.');
      }
      v.concluir();
      registros.push({ id: idParticipacao!, compareceu: r.compareceu, horas });
    }

    await this.db.tx(async (tx) => {
      const d = await this.carregarDoDono(tx, id, u);
      if (d.situacao !== 'aberta') throw new UnprocessableEntityException('Só é possível registrar presença em demandas abertas.');
      const previstas = Math.round(((d.fim.getTime() - d.inicio.getTime()) / 3_600_000) * 100) / 100;

      for (const r of registros) {
        const horas = r.compareceu ? (r.horas ?? previstas) : 0;
        const ok = await tx.query(
          `UPDATE participacao SET situacao = $3, horas_realizadas = $4, data_registro = now(), data_atualizacao = now()
           WHERE id_participacao = $1 AND id_demanda = $2 AND situacao IN ('selecionada','compareceu','faltou')
           RETURNING id_participacao`,
          [r.id, id, r.compareceu ? 'compareceu' : 'faltou', horas],
        );
        if (!ok.length) throw new UnprocessableEntityException('Só é possível registrar presença de voluntários selecionados.');
      }

      const [{ pendentes, registradas }] = await tx.query(
        `SELECT COUNT(*) FILTER (WHERE situacao = 'selecionada')::int AS pendentes,
                COUNT(*) FILTER (WHERE situacao IN ('compareceu','faltou'))::int AS registradas
         FROM participacao WHERE id_demanda = $1`,
        [id],
      );
      if (pendentes === 0 && registradas > 0) {
        await tx.query(`UPDATE demanda SET situacao = 'concluida' WHERE id_demanda = $1`, [id]);
      }
    });
    return this.obter(id, u);
  }
}
