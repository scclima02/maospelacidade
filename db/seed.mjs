// Carga inicial do banco (Neon).
//  - Sempre garante o administrador inicial (ADMIN_EMAIL / ADMIN_SENHA, ou o padrão abaixo).
//  - Com SEED_DEMO=1 carrega também gestor, voluntários e demandas de demonstração.
// Idempotente: pode ser executado mais de uma vez.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const aqui = dirname(fileURLToPath(import.meta.url));

function carregarEnv() {
  const arq = join(aqui, '..', '.env');
  if (!existsSync(arq)) return;
  for (const linha of readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

carregarEnv();
if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL (arquivo .env ou variável de ambiente).');
  process.exit(1);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@prefeitura.gov.br').toLowerCase();
const ADMIN_SENHA = process.env.ADMIN_SENHA ?? 'Admin@123';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function usuario({ nome, email, senha, telefone, perfil }) {
  const hash = await bcrypt.hash(senha, 10);
  const r = await client.query(
    `INSERT INTO usuario (nome, email, senha_hash, telefone, perfil) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO NOTHING RETURNING id_usuario`,
    [nome, email, hash, telefone, perfil],
  );
  if (r.rows[0]) return { id: r.rows[0].id_usuario, novo: true };
  const e = await client.query('SELECT id_usuario FROM usuario WHERE email = $1', [email]);
  return { id: e.rows[0].id_usuario, novo: false };
}

const idPorNome = async (tabela, pk, nome) =>
  (await client.query(`SELECT ${pk} AS id FROM ${tabela} WHERE nome = $1`, [nome])).rows[0].id;

try {
  const admin = await usuario({ nome: 'Administrador do Sistema', email: ADMIN_EMAIL, senha: ADMIN_SENHA, telefone: null, perfil: 'administrador' });
  console.log(admin.novo ? `Administrador criado: ${ADMIN_EMAIL}` : `Administrador já existe: ${ADMIN_EMAIL}`);

  if (process.env.SEED_DEMO === '1') {
    const gestor = await usuario({ nome: 'Carla Gestora', email: 'gestor@prefeitura.gov.br', senha: 'Gestor@123', telefone: '(11) 3000-0000', perfil: 'gestor' });
    await client.query(
      `INSERT INTO gestor (id_usuario, organizacao, cargo) VALUES ($1, 'Secretaria de Desenvolvimento Social', 'Coordenadora de Ações Comunitárias')
       ON CONFLICT (id_usuario) DO NOTHING`,
      [gestor.id],
    );

    const centro = await idPorNome('regiao', 'id_regiao', 'Centro');
    const zonaSul = await idPorNome('regiao', 'id_regiao', 'Zona Sul');
    const meioAmbiente = await idPorNome('area_atuacao', 'id_area', 'Meio ambiente');
    const educacao = await idPorNome('area_atuacao', 'id_area', 'Educação');

    const voluntarios = [
      { nome: 'Maria Silva', email: 'maria@exemplo.com', telefone: '(11) 90000-0001', regiao: centro, areas: [meioAmbiente, educacao], dias: [0, 1, 2, 3, 4, 5, 6], hi: '07:00', hf: '22:00' },
      { nome: 'João Souza', email: 'joao@exemplo.com', telefone: '(11) 90000-0002', regiao: zonaSul, areas: [meioAmbiente], dias: [0, 6], hi: '08:00', hf: '18:00' },
    ];
    const ids = [];
    for (const v of voluntarios) {
      const u = await usuario({ nome: v.nome, email: v.email, senha: 'Voluntario@123', telefone: v.telefone, perfil: 'voluntario' });
      ids.push(u.id);
      if (!u.novo) continue;
      await client.query('INSERT INTO voluntario (id_usuario, id_regiao) VALUES ($1, $2)', [u.id, v.regiao]);
      for (const a of v.areas) await client.query('INSERT INTO voluntario_area (id_usuario, id_area) VALUES ($1, $2)', [u.id, a]);
      for (const d of v.dias) {
        await client.query(
          'INSERT INTO disponibilidade (id_usuario, dia_semana, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4)',
          [u.id, d, v.hi, v.hf],
        );
      }
      await client.query(
        `INSERT INTO consentimento (id_usuario, versao_termo, finalidade) VALUES ($1, '1.0', 'Mobilização para ações de voluntariado')`,
        [u.id],
      );
    }
    const [maria, joao] = ids;

    const jaTem = async (titulo) => (await client.query('SELECT 1 FROM demanda WHERE titulo = $1', [titulo])).rowCount > 0;

    // Ação já concluída (alimenta histórico, certificado, indicadores e relatórios)
    if (!(await jaTem('Mutirão de limpeza da praça central'))) {
      const inicio = new Date(Date.now() - 14 * 86_400_000);
      inicio.setUTCHours(12, 0, 0, 0); // 09:00 em Brasília
      const fim = new Date(inicio.getTime() + 4 * 3_600_000);
      const d = await client.query(
        `INSERT INTO demanda (id_gestor, id_area, id_regiao, titulo, descricao, local_acao, data_inicio, data_fim, vagas, situacao)
         VALUES ($1,$2,$3,'Mutirão de limpeza da praça central','Limpeza e plantio de mudas na praça central.','Praça central',$4,$5,5,'concluida')
         RETURNING id_demanda`,
        [gestor.id, meioAmbiente, centro, inicio, fim],
      );
      const idDemanda = d.rows[0].id_demanda;
      await client.query(
        `INSERT INTO participacao (id_demanda, id_voluntario, situacao, pontuacao, horas_realizadas, data_registro) VALUES ($1,$2,'compareceu',100,4,now())`,
        [idDemanda, maria],
      );
      await client.query(
        `INSERT INTO participacao (id_demanda, id_voluntario, situacao, pontuacao, horas_realizadas, data_registro) VALUES ($1,$2,'faltou',50,0,now())`,
        [idDemanda, joao],
      );
    }

    // Ação aberta: próximo sábado, com a voluntária compatível já sugerida
    if (!(await jaTem('Oficina de reforço escolar'))) {
      const dia = new Date(Date.now() + 5 * 86_400_000);
      while (dia.getUTCDay() !== 6) dia.setUTCDate(dia.getUTCDate() + 1);
      dia.setUTCHours(13, 0, 0, 0); // 10:00 em Brasília
      const fim = new Date(dia.getTime() + 2 * 3_600_000);
      const d = await client.query(
        `INSERT INTO demanda (id_gestor, id_area, id_regiao, titulo, descricao, local_acao, data_inicio, data_fim, vagas, situacao)
         VALUES ($1,$2,$3,'Oficina de reforço escolar','Apoio em leitura e matemática para crianças do ensino fundamental.','Escola Municipal Centro',$4,$5,3,'aberta')
         RETURNING id_demanda`,
        [gestor.id, educacao, centro, dia, fim],
      );
      await client.query(
        `INSERT INTO participacao (id_demanda, id_voluntario, situacao, pontuacao) VALUES ($1,$2,'sugerida',100)`,
        [d.rows[0].id_demanda, maria],
      );
    }
    console.log('Dados de demonstração carregados.');
  }
} finally {
  await client.end();
}
