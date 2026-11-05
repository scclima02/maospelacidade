// Carga inicial do banco (Neon).
//  - Sempre garante o administrador inicial (ADMIN_EMAIL / ADMIN_SENHA, ou o padrão abaixo).
//  - Sempre carrega as oportunidades reais de voluntariado de db/vagas-reais.json
//    (instituições de Porto Alegre e Canoas, com o link da página de origem).
//  - Com SEED_DEMO=1 cria também contas de demonstração (gestor e voluntários) para avaliação.
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

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@maospelacidade.org').toLowerCase();
const ADMIN_SENHA = process.env.ADMIN_SENHA ?? 'Admin@123';
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

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

async function idPorNome(tabela, pk, nome) {
  const r = await client.query(`SELECT ${pk} AS id FROM ${tabela} WHERE nome = $1`, [nome]);
  if (r.rows[0]) return r.rows[0].id;
  return (await client.query(`INSERT INTO ${tabela} (nome) VALUES ($1) RETURNING ${pk} AS id`, [nome])).rows[0].id;
}

const doisDigitos = (n) => String(n).padStart(2, '0');
const diaIso = (d) => `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
const emBrasilia = (dia, hhmm) => new Date(`${dia}T${hhmm}:00-03:00`);

/**
 * Atividades recorrentes viram a próxima ocorrência a partir de alguns dias à frente.
 * O deslocamento por índice espalha as ações pelas próximas semanas.
 */
function proximoPeriodo(v, indice) {
  let dia;
  if (v.dataEspecifica && emBrasilia(v.dataEspecifica, v.horaInicio) > new Date()) {
    dia = v.dataEspecifica;
  } else {
    const dias = v.diasSemana?.length ? v.diasSemana : [6];
    const d = new Date(Date.now() + (3 + (indice % 24)) * 86_400_000);
    while (!dias.includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    dia = diaIso(d);
  }
  const inicio = emBrasilia(dia, v.horaInicio);
  let fim = emBrasilia(dia, v.horaFim);
  if (fim <= inicio) fim = new Date(inicio.getTime() + 2 * 3_600_000);
  return { inicio, fim };
}

function descricaoCompleta(v) {
  const partes = [v.descricao.trim()];
  if (!v.dataEspecifica && v.diasSemana?.length) {
    const quando = v.diasSemana.map((d) => DIAS[d]).join(', ');
    partes.push(`Atividade recorrente (${quando}). A data abaixo é a próxima ocorrência.`);
  }
  if (v.horarioEstimado) partes.push('Horário estimado: confirme com a organização antes de ir.');
  partes.push(`Fonte: ${v.fonte}.`);
  return partes.join('\n\n');
}

async function carregarVagasReais(idResponsavel) {
  const arq = join(aqui, 'vagas-reais.json');
  if (!existsSync(arq)) return;
  const vagas = JSON.parse(readFileSync(arq, 'utf8'));
  let novas = 0;
  for (const [i, v] of vagas.entries()) {
    const existe = await client.query('SELECT 1 FROM demanda WHERE titulo = $1 AND organizacao = $2', [v.titulo, v.organizacao]);
    if (existe.rowCount) continue;
    const idArea = await idPorNome('area_atuacao', 'id_area', v.area);
    const idRegiao = await idPorNome('regiao', 'id_regiao', v.regiao);
    const { inicio, fim } = proximoPeriodo(v, i);
    await client.query(
      `INSERT INTO demanda (id_gestor, id_area, id_regiao, titulo, descricao, local_acao, data_inicio, data_fim, vagas,
                            organizacao, link_externo, latitude, longitude, situacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'aberta')`,
      [idResponsavel, idArea, idRegiao, v.titulo.slice(0, 200), descricaoCompleta(v), v.local.slice(0, 250),
       inicio, fim, Math.max(1, Number(v.vagas) || 5), v.organizacao.slice(0, 150), v.link?.slice(0, 500) ?? null,
       v.latitude ?? null, v.longitude ?? null],
    );
    novas++;
  }
  console.log(`Oportunidades reais: ${novas} nova(s) de ${vagas.length} no arquivo.`);
}

try {
  const admin = await usuario({ nome: 'Administrador do Sistema', email: ADMIN_EMAIL, senha: ADMIN_SENHA, telefone: null, perfil: 'administrador' });
  console.log(admin.novo ? `Administrador criado: ${ADMIN_EMAIL}` : `Administrador já existe: ${ADMIN_EMAIL}`);

  if (process.env.SEED_DEMO === '1') {
    const gestor = await usuario({ nome: 'Carla Gestora', email: 'gestor@maospelacidade.org', senha: 'Gestor@123', telefone: '(51) 3000-0000', perfil: 'gestor' });
    await client.query(
      `INSERT INTO gestor (id_usuario, organizacao, cargo) VALUES ($1, 'Rede Mãos pela Cidade', 'Coordenadora de Ações Comunitárias')
       ON CONFLICT (id_usuario) DO NOTHING`,
      [gestor.id],
    );

    const centro = await idPorNome('regiao', 'id_regiao', 'Porto Alegre – Centro');
    const canoas = await idPorNome('regiao', 'id_regiao', 'Canoas');
    const meioAmbiente = await idPorNome('area_atuacao', 'id_area', 'Meio ambiente');
    const educacao = await idPorNome('area_atuacao', 'id_area', 'Educação');

    // Contas de demonstração para a avaliação (as oportunidades são reais; estas pessoas não).
    const voluntarios = [
      { nome: 'Maria Silva', email: 'maria@exemplo.com', telefone: '(51) 90000-0001', regiao: centro, areas: [meioAmbiente, educacao], dias: [0, 1, 2, 3, 4, 5, 6], hi: '07:00', hf: '22:00' },
      { nome: 'João Souza', email: 'joao@exemplo.com', telefone: '(51) 90000-0002', regiao: canoas, areas: [meioAmbiente], dias: [0, 6], hi: '08:00', hf: '18:00' },
    ];
    for (const v of voluntarios) {
      const u = await usuario({ nome: v.nome, email: v.email, senha: 'Voluntario@123', telefone: v.telefone, perfil: 'voluntario' });
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
    console.log('Contas de demonstração carregadas.');
  }

  await carregarVagasReais(admin.id);
} finally {
  await client.end();
}
