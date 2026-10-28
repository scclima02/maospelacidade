import { Injectable } from '@nestjs/common';
import { ConfiguracaoService } from '../common/configuracao.service';
import { DatabaseService } from '../common/database.service';
import { fimDoDia, formatarData, inicioDoDia } from '../common/datas';
import { PdfService } from '../common/pdf.service';
import { diaOpcional, inteiroOpcional } from '../common/validador';

interface Filtros {
  de?: string;
  ate?: string;
  idArea?: number;
  idRegiao?: number;
}

const lerFiltros = (q: Record<string, any>): Filtros => ({
  de: diaOpcional(q.de),
  ate: diaOpcional(q.ate),
  idArea: inteiroOpcional(q.idArea),
  idRegiao: inteiroOpcional(q.idRegiao),
});

const fmtHoras = (h: number) => String(Math.round(h * 100) / 100).replace('.', ',');

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cfg: ConfiguracaoService,
    private readonly pdf: PdfService,
  ) {}

  /** UC21 (RN31) */
  async indicadores(q: Record<string, any>) {
    const f = lerFiltros(q);
    const p = [f.de ? inicioDoDia(f.de) : null, f.ate ? fimDoDia(f.ate) : null];
    const periodo = `($1::timestamptz IS NULL OR d.data_inicio >= $1) AND ($2::timestamptz IS NULL OR d.data_inicio <= $2)`;

    const [{ ativos }] = await this.db.query(
      `SELECT COUNT(*)::int AS ativos FROM usuario WHERE perfil = 'voluntario' AND situacao = 'ativo'`,
    );
    const [dem] = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE d.situacao = 'aberta')::int AS abertas,
              COUNT(*) FILTER (WHERE d.situacao = 'concluida')::int AS concluidas
       FROM demanda d WHERE ${periodo}`,
      p,
    );
    const [par] = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE pa.situacao = 'compareceu')::int AS presencas,
              COUNT(*) FILTER (WHERE pa.situacao = 'faltou')::int AS faltas,
              COALESCE(SUM(pa.horas_realizadas) FILTER (WHERE pa.situacao = 'compareceu'), 0)::float8 AS horas
       FROM participacao pa JOIN demanda d ON d.id_demanda = pa.id_demanda WHERE ${periodo}`,
      p,
    );
    const porMes = await this.db.query(
      `SELECT to_char(d.data_inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes, COUNT(*)::int AS total
       FROM demanda d WHERE d.situacao <> 'cancelada' AND ${periodo} GROUP BY 1 ORDER BY 1`,
      p,
    );
    const porArea = await this.db.query(
      `SELECT a.nome AS area, COUNT(u.id_usuario)::int AS total
       FROM area_atuacao a
       LEFT JOIN voluntario_area va ON va.id_area = a.id_area
       LEFT JOIN usuario u ON u.id_usuario = va.id_usuario AND u.situacao = 'ativo'
       WHERE a.ativo GROUP BY a.nome ORDER BY a.nome`,
    );
    const registradas = par.presencas + par.faltas;
    return {
      voluntariosAtivos: ativos,
      demandasAbertas: dem.abertas,
      demandasConcluidas: dem.concluidas,
      participacoes: par.presencas,
      horas: Math.round(par.horas * 100) / 100,
      taxaComparecimento: registradas ? par.presencas / registradas : null,
      demandasPorMes: porMes,
      voluntariosPorArea: porArea,
    };
  }

  /** UC22 (RN32) */
  async engajamento(q: Record<string, any>) {
    const f = lerFiltros(q);

    const params1: any[] = [];
    const filtros1: string[] = [`u.situacao = 'ativo'`, `a.ativo`];
    if (f.idArea) {
      params1.push(f.idArea);
      filtros1.push(`va.id_area = $${params1.length}`);
    }
    if (f.idRegiao) {
      params1.push(f.idRegiao);
      filtros1.push(`v.id_regiao = $${params1.length}`);
    }
    const porAreaRegiao = await this.db.query(
      `SELECT a.nome AS area, COALESCE(r.nome, 'Sem região') AS regiao, COUNT(*)::int AS voluntarios
       FROM voluntario_area va
       JOIN voluntario v ON v.id_usuario = va.id_usuario
       JOIN usuario u ON u.id_usuario = va.id_usuario
       JOIN area_atuacao a ON a.id_area = va.id_area
       LEFT JOIN regiao r ON r.id_regiao = v.id_regiao
       WHERE ${filtros1.join(' AND ')}
       GROUP BY a.nome, r.nome ORDER BY a.nome, r.nome`,
      params1,
    );

    const params2: any[] = [];
    const filtros2: string[] = [`d.situacao = 'concluida'`];
    if (f.de) {
      params2.push(inicioDoDia(f.de));
      filtros2.push(`d.data_inicio >= $${params2.length}`);
    }
    if (f.ate) {
      params2.push(fimDoDia(f.ate));
      filtros2.push(`d.data_inicio <= $${params2.length}`);
    }
    if (f.idArea) {
      params2.push(f.idArea);
      filtros2.push(`d.id_area = $${params2.length}`);
    }
    if (f.idRegiao) {
      params2.push(f.idRegiao);
      filtros2.push(`d.id_regiao = $${params2.length}`);
    }
    const acoes = await this.db.query(
      `SELECT d.id_demanda AS "idDemanda", d.titulo, d.data_inicio AS data, a.nome AS area, r.nome AS regiao,
              COALESCE(SUM(p.horas_realizadas) FILTER (WHERE p.situacao = 'compareceu'), 0)::float8 AS horas,
              (COUNT(*) FILTER (WHERE p.situacao = 'compareceu'))::int AS presencas,
              (COUNT(*) FILTER (WHERE p.situacao = 'faltou'))::int AS faltas
       FROM demanda d
       JOIN area_atuacao a ON a.id_area = d.id_area
       JOIN regiao r ON r.id_regiao = d.id_regiao
       LEFT JOIN participacao p ON p.id_demanda = d.id_demanda
       WHERE ${filtros2.join(' AND ')}
       GROUP BY d.id_demanda, a.nome, r.nome ORDER BY d.data_inicio DESC`,
      params2,
    );

    const totais = {
      demandas: acoes.length,
      presencas: acoes.reduce((s, a) => s + a.presencas, 0),
      faltas: acoes.reduce((s, a) => s + a.faltas, 0),
      horas: Math.round(acoes.reduce((s, a) => s + a.horas, 0) * 100) / 100,
    };
    return { filtros: f, porAreaRegiao, acoes, totais };
  }

  async engajamentoPdf(q: Record<string, any>): Promise<Uint8Array> {
    const r = await this.engajamento(q);
    const { nomeOrganizacao } = await this.cfg.obter();
    const [area] = r.filtros.idArea ? await this.db.query('SELECT nome FROM area_atuacao WHERE id_area = $1', [r.filtros.idArea]) : [];
    const [regiao] = r.filtros.idRegiao ? await this.db.query('SELECT nome FROM regiao WHERE id_regiao = $1', [r.filtros.idRegiao]) : [];
    const periodo = `${r.filtros.de ? formatarData(inicioDoDia(r.filtros.de)!) : 'início'} a ${r.filtros.ate ? formatarData(fimDoDia(r.filtros.ate)!) : 'hoje'}`;

    return this.pdf.relatorio(
      'Relatório de engajamento',
      `${nomeOrganizacao} | Período: ${periodo} | Área: ${area?.nome ?? 'todas'} | Região: ${regiao?.nome ?? 'todas'}`,
      [
        `Ações concluídas: ${r.totais.demandas}`,
        `Presenças: ${r.totais.presencas}   Faltas: ${r.totais.faltas}`,
        `Horas voluntariadas: ${fmtHoras(r.totais.horas)}`,
      ],
      [
        {
          titulo: 'Voluntários por área e região',
          cabecalho: ['Área', 'Região', 'Voluntários'],
          larguras: [4, 4, 2],
          linhas: r.porAreaRegiao.map((l) => [l.area, l.regiao, String(l.voluntarios)]),
        },
        {
          titulo: 'Horas por ação',
          cabecalho: ['Ação', 'Data', 'Área', 'Região', 'Horas', 'Pres.', 'Faltas'],
          larguras: [5, 2, 3, 3, 1.5, 1.3, 1.5],
          linhas: r.acoes.map((a) => [a.titulo, formatarData(a.data), a.area, a.regiao, fmtHoras(a.horas), String(a.presencas), String(a.faltas)]),
        },
      ],
    );
  }
}
