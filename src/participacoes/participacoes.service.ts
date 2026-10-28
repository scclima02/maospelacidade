import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../common/database.service';
import { ConfiguracaoService } from '../common/configuracao.service';
import { fimDoDia, formatarData, inicioDoDia } from '../common/datas';
import { PdfService } from '../common/pdf.service';
import { diaOpcional, inteiroOpcional } from '../common/validador';

const SITUACOES_VISIVEIS = ['sugerida', 'confirmada', 'selecionada', 'recusada', 'cancelada'];

const BASE_OPORTUNIDADE = `
  SELECT p.id_participacao AS "idParticipacao", d.id_demanda AS "idDemanda", d.titulo, d.descricao,
         a.nome AS area, r.nome AS regiao, d.local_acao AS "local", d.data_inicio AS "dataInicio",
         d.data_fim AS "dataFim", d.vagas, p.situacao, p.pontuacao::float8 AS pontuacao,
         d.situacao AS "situacaoDemanda"
  FROM participacao p
  JOIN demanda d ON d.id_demanda = p.id_demanda
  JOIN area_atuacao a ON a.id_area = d.id_area
  JOIN regiao r ON r.id_regiao = d.id_regiao`;

type Acao = 'confirmar' | 'recusar' | 'cancelar';

// RN21: situações de origem permitidas e destino de cada ação
const TRANSICOES: Record<Acao, { de: string[]; para: string }> = {
  confirmar: { de: ['sugerida', 'cancelada'], para: 'confirmada' },
  recusar: { de: ['sugerida'], para: 'recusada' },
  cancelar: { de: ['confirmada', 'selecionada'], para: 'cancelada' },
};

@Injectable()
export class ParticipacoesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cfg: ConfiguracaoService,
    private readonly pdf: PdfService,
  ) {}

  /** UC06: oportunidades abertas do voluntário, com filtros opcionais. */
  listar(idVoluntario: number, q: Record<string, any>) {
    const filtros = [`p.id_voluntario = $1`, `d.situacao = 'aberta'`, `(d.data_fim >= now() OR p.situacao = 'selecionada')`];
    const params: any[] = [idVoluntario];
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
    if (typeof q.situacao === 'string' && SITUACOES_VISIVEIS.includes(q.situacao)) {
      add('p.situacao = ?', q.situacao);
    } else {
      filtros.push(`p.situacao IN ('sugerida','confirmada','selecionada')`);
    }
    return this.db.query(`${BASE_OPORTUNIDADE} WHERE ${filtros.join(' AND ')} ORDER BY d.data_inicio ASC LIMIT 300`, params);
  }

  async obter(idVoluntario: number, idParticipacao: number) {
    const [o] = await this.db.query(`${BASE_OPORTUNIDADE} WHERE p.id_participacao = $1 AND p.id_voluntario = $2`, [
      idParticipacao,
      idVoluntario,
    ]);
    if (!o) throw new NotFoundException('Oportunidade não encontrada.');
    return o;
  }

  /** UC07 */
  async responder(idVoluntario: number, idParticipacao: number, acao: Acao) {
    await this.db.tx(async (tx) => {
      const [p] = await tx.query(
        `SELECT p.situacao, d.situacao AS "situacaoDemanda", d.data_inicio AS inicio
         FROM participacao p JOIN demanda d ON d.id_demanda = p.id_demanda
         WHERE p.id_participacao = $1 AND p.id_voluntario = $2 FOR UPDATE OF p`,
        [idParticipacao, idVoluntario],
      );
      if (!p) throw new NotFoundException('Oportunidade não encontrada.');
      if (p.situacaoDemanda !== 'aberta' || p.inicio <= new Date()) {
        throw new UnprocessableEntityException('Esta oportunidade não aceita mais respostas.');
      }
      const t = TRANSICOES[acao];
      if (!t.de.includes(p.situacao)) {
        throw new UnprocessableEntityException(`Não é possível ${acao} uma participação na situação "${p.situacao}".`);
      }
      await tx.query(`UPDATE participacao SET situacao = $2, data_atualizacao = now() WHERE id_participacao = $1`, [
        idParticipacao,
        t.para,
      ]);
    });
    return this.obter(idVoluntario, idParticipacao);
  }

  /** UC09: só para presença registrada; reemitir devolve o mesmo código. */
  async certificado(idVoluntario: number, idParticipacao: number): Promise<Uint8Array> {
    const [p] = await this.db.query(
      `SELECT p.situacao, p.horas_realizadas::float8 AS horas, d.titulo, d.data_inicio AS data, u.nome
       FROM participacao p
       JOIN demanda d ON d.id_demanda = p.id_demanda
       JOIN usuario u ON u.id_usuario = p.id_voluntario
       WHERE p.id_participacao = $1 AND p.id_voluntario = $2`,
      [idParticipacao, idVoluntario],
    );
    if (!p) throw new NotFoundException('Participação não encontrada.');
    if (p.situacao !== 'compareceu') {
      throw new UnprocessableEntityException('O certificado só é emitido para ações com presença registrada.');
    }

    const bruto = randomBytes(6).toString('hex').toUpperCase();
    const novoCodigo = `VOL-${bruto.slice(0, 4)}-${bruto.slice(4, 8)}-${bruto.slice(8, 12)}`;
    await this.db.query(
      `INSERT INTO certificado (id_participacao, codigo_validacao) VALUES ($1, $2) ON CONFLICT (id_participacao) DO NOTHING`,
      [idParticipacao, novoCodigo],
    );
    const [{ codigo }] = await this.db.query(
      'SELECT codigo_validacao AS codigo FROM certificado WHERE id_participacao = $1',
      [idParticipacao],
    );

    const { nomeOrganizacao } = await this.cfg.obter();
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return this.pdf.certificado({
      organizacao: nomeOrganizacao,
      nome: p.nome,
      acao: p.titulo,
      data: formatarData(p.data),
      horas: p.horas ?? 0,
      codigo,
      urlValidacao: `${base}/#/validar?codigo=${codigo}`,
    });
  }
}
