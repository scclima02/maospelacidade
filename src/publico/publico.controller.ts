import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Publico } from '../auth/auth.decorators';
import { ConfiguracaoService } from '../common/configuracao.service';
import { DatabaseService } from '../common/database.service';
import { formatarData } from '../common/datas';
import { FINALIDADE_CONSENTIMENTO } from '../voluntarios/voluntarios.service';

@Controller()
@Publico()
export class PublicoController {
  constructor(
    private readonly db: DatabaseService,
    private readonly cfg: ConfiguracaoService,
  ) {}

  @Get('publico/config')
  async config() {
    const c = await this.cfg.obter();
    return {
      nomeOrganizacao: c.nomeOrganizacao,
      termoVersao: c.termoVersao,
      termo: {
        titulo: 'Termo de uso e política de privacidade',
        finalidade: FINALIDADE_CONSENTIMENTO,
        dadosColetados: [
          'Nome, e-mail e telefone',
          'Região de residência',
          'Áreas de interesse',
          'Disponibilidade (dias da semana e faixas de horário)',
          'Histórico de participação e horas voluntariadas',
        ],
        quemAcessa: [
          'Gestores públicos e responsáveis por ações comunitárias (telefone e e-mail apenas de quem confirmou participação na ação)',
          'Administradores do sistema',
        ],
        retencao: `Seus dados são mantidos enquanto a conta estiver ativa e por até ${c.retencaoMeses} meses de inatividade; depois disso são anonimizados. Você pode revogar o consentimento ou excluir sua conta a qualquer momento.`,
        texto: `Ao se cadastrar, você autoriza o tratamento dos seus dados pessoais pela ${c.nomeOrganizacao} exclusivamente para a finalidade de mobilização para ações de voluntariado, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
      },
    };
  }

  /** Números agregados e sem identificação, exibidos na página inicial. */
  @Get('publico/estatisticas')
  async estatisticas() {
    const [r] = await this.db.query(
      `SELECT (SELECT COUNT(*)::int FROM usuario WHERE perfil = 'voluntario' AND situacao = 'ativo') AS voluntarios,
              (SELECT COUNT(*)::int FROM demanda WHERE situacao = 'concluida') AS acoes,
              (SELECT COALESCE(SUM(horas_realizadas), 0)::float8 FROM participacao WHERE situacao = 'compareceu') AS horas,
              (SELECT COUNT(*)::int FROM area_atuacao WHERE ativo) AS areas`,
    );
    return { ...r, horas: Math.round(r.horas) };
  }

  @Get('catalogos/areas')
  areas() {
    return this.db.query('SELECT id_area AS id, nome FROM area_atuacao WHERE ativo ORDER BY nome');
  }

  @Get('catalogos/regioes')
  regioes() {
    return this.db.query('SELECT id_regiao AS id, nome FROM regiao WHERE ativo ORDER BY nome');
  }

  @Get('certificados/validar/:codigo')
  async validar(@Param('codigo') codigo: string) {
    const [c] = await this.db.query(
      `SELECT u.nome, d.titulo AS acao, d.data_inicio AS data, p.horas_realizadas::float8 AS horas
       FROM certificado c
       JOIN participacao p ON p.id_participacao = c.id_participacao
       JOIN demanda d ON d.id_demanda = p.id_demanda
       JOIN usuario u ON u.id_usuario = p.id_voluntario
       WHERE c.codigo_validacao = $1`,
      [codigo.trim().toUpperCase().slice(0, 30)],
    );
    if (!c) throw new NotFoundException('Código de validação não encontrado.');
    return { valido: true, nome: c.nome, acao: c.acao, data: c.data, horas: c.horas ?? 0, dataFormatada: formatarData(c.data) };
  }

  @Get('saude')
  async saude() {
    await this.db.query('SELECT 1');
    return { status: 'ok', banco: 'ok' };
  }
}
