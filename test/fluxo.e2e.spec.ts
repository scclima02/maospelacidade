process.env.USE_PGLITE = '1';
delete process.env.DATABASE_URL;
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { hashSenha } from '../src/auth/auth.service';
import { configurarApp } from '../src/configurar-app';
import { DatabaseService } from '../src/common/database.service';
import { MailService } from '../src/common/mail.service';

// Data de uma ação futura (10 dias à frente, em Brasília) e o dia da semana correspondente
const alvo = new Date(Date.now() + 10 * 86_400_000 - 3 * 3_600_000);
const DIA = alvo.toISOString().slice(0, 10);
const DOW = new Date(`${DIA}T12:00:00Z`).getUTCDay();

describe('Fluxo completo do sistema', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const emails: { para: string; assunto: string; corpo: string }[] = [];

  type Agente = ReturnType<typeof request.agent>;
  const http = () => request.agent(app.getHttpServer());
  let admin: Agente;
  let gestor: Agente;
  let ana: Agente; // compatível, mesma região
  let bia: Agente; // compatível, outra região
  let cris: Agente; // disponibilidade não cobre
  let davi: Agente; // outra área

  let idArea: number;
  let idOutraArea: number;
  let idRegiao: number;
  let idOutraRegiao: number;
  let idDemanda: number;
  let partAna: number;
  let partBia: number;
  let idAna: number;

  const faixa = (hi: string, hf: string) => [{ diaSemana: DOW, horaInicio: hi, horaFim: hf }];
  const cadastro = (nome: string, email: string, regiao: number, area: number, disp: any[]) => ({
    nome,
    email,
    telefone: '(11) 98888-7777',
    senha: 'Senha1234',
    idRegiao: regiao,
    areas: [area],
    disponibilidades: disp,
    aceiteTermo: true,
  });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configurarApp(app);
    await app.init();
    [admin, gestor, ana, bia, cris, davi] = [http(), http(), http(), http(), http(), http()];
    db = app.get(DatabaseService);
    jest.spyOn(app.get(MailService), 'enviar').mockImplementation(async (para, assunto, corpo) => {
      emails.push({ para, assunto, corpo });
      return 'ignorada';
    });
    await db.query(
      `INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES ('Admin', 'admin@teste.com', $1, 'administrador')`,
      [await hashSenha('Admin1234')],
    );
    [{ id: idArea }, { id: idOutraArea }] = await db.query('SELECT id_area AS id FROM area_atuacao ORDER BY id_area LIMIT 2');
    [{ id: idRegiao }, { id: idOutraRegiao }] = await db.query('SELECT id_regiao AS id FROM regiao ORDER BY id_regiao LIMIT 2');
  });

  afterAll(async () => {
    await app.close();
  });

  it('saúde, configuração pública e catálogos abertos', async () => {
    await http().get('/api/saude').expect(200).expect({ status: 'ok', banco: 'ok' });
    const cfg = await http().get('/api/publico/config').expect(200);
    expect(cfg.body.nomeOrganizacao).toBeTruthy();
    expect(cfg.body.termo.finalidade).toMatch(/voluntariado/i);
    expect((await http().get('/api/catalogos/areas').expect(200)).body.length).toBeGreaterThan(2);
  });

  it('exige sessão e respeita perfis (RNF06)', async () => {
    await http().get('/api/auth/me').expect(401);
    await http().get('/api/demandas').expect(401);
    await admin.post('/api/auth/login').send({ email: 'admin@teste.com', senha: 'Admin1234' }).expect(200);
    await admin.get('/api/auth/me').expect(200);
  });

  it('login falho não revela qual dado está errado (RN01)', async () => {
    const a = await http().post('/api/auth/login').send({ email: 'admin@teste.com', senha: 'errada123' }).expect(401);
    const b = await http().post('/api/auth/login').send({ email: 'ninguem@teste.com', senha: 'errada123' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('UC19: administrador cadastra gestor; e-mail duplicado dá 409', async () => {
    const corpo = { nome: 'Gestora Teste', email: 'gestor@teste.com', senha: 'Gestor1234', perfil: 'gestor', organizacao: 'ONG X' };
    await admin.post('/api/admin/usuarios').send(corpo).expect(201);
    await admin.post('/api/admin/usuarios').send(corpo).expect(409);
    await admin.post('/api/admin/usuarios').send({ ...corpo, email: 'x@teste.com', senha: '123' }).expect(400);
    await gestor.post('/api/auth/login').send({ email: 'gestor@teste.com', senha: 'Gestor1234' }).expect(200);
  });

  it('UC03/UC04: cadastro de voluntário com consentimento e validações', async () => {
    const r = await ana.post('/api/voluntarios/cadastro').send(cadastro('Ana Souza', 'ana@teste.com', idRegiao, idArea, faixa('08:00', '18:00'))).expect(201);
    idAna = r.body.usuario.id;
    await ana.get('/api/auth/me').expect(200); // login automático
    await bia.post('/api/voluntarios/cadastro').send(cadastro('Bia Lima', 'bia@teste.com', idOutraRegiao, idArea, faixa('08:00', '18:00'))).expect(201);
    await cris.post('/api/voluntarios/cadastro').send(cadastro('Cris Dias', 'cris@teste.com', idRegiao, idArea, faixa('14:00', '18:00'))).expect(201);
    await davi.post('/api/voluntarios/cadastro').send(cadastro('Davi Reis', 'davi@teste.com', idRegiao, idOutraArea, faixa('08:00', '18:00'))).expect(201);

    await http().post('/api/voluntarios/cadastro').send(cadastro('Ana 2', 'ana@teste.com', idRegiao, idArea, faixa('08:00', '18:00'))).expect(409);
    await http().post('/api/voluntarios/cadastro').send({ ...cadastro('Sem Termo', 'semtermo@teste.com', idRegiao, idArea, faixa('08:00', '18:00')), aceiteTermo: false }).expect(422);
    const vazio = await http().post('/api/voluntarios/cadastro').send({}).expect(400);
    expect(Array.isArray(vazio.body.message)).toBe(true);
    expect((await db.query(`SELECT 1 FROM usuario WHERE email = 'semtermo@teste.com'`)).length).toBe(0);

    const perfil = (await ana.get('/api/voluntarios/me').expect(200)).body;
    expect(perfil.consentimento.vigente).toBe(true);
    expect(perfil.areas).toEqual([idArea]);
    expect(perfil.disponibilidades[0]).toMatchObject({ diaSemana: DOW, horaInicio: '08:00', horaFim: '18:00' });
  });

  it('UC11/UC12/UC13: demanda gera compatíveis ordenados e notifica', async () => {
    await ana.post('/api/demandas').send({}).expect(403);
    await gestor.post('/api/demandas').send({ titulo: 'x' }).expect(400);

    const corpo = {
      titulo: 'Mutirão de teste',
      descricao: 'Descrição da ação',
      idArea,
      idRegiao,
      local: 'Praça Central',
      dataInicio: `${DIA}T10:00`,
      dataFim: `${DIA}T12:00`,
      vagas: 1,
    };
    await gestor.post('/api/demandas').send({ ...corpo, dataFim: `${DIA}T09:00` }).expect(422);
    await gestor.post('/api/demandas').send({ ...corpo, vagas: 0 }).expect(400);

    const r = await gestor.post('/api/demandas').send(corpo).expect(201);
    idDemanda = r.body.demanda.id;
    expect(r.body.compativeis).toBe(2); // Ana e Bia; Cris (horário) e Davi (área) ficam de fora

    const lista = (await gestor.get(`/api/demandas/${idDemanda}/voluntarios`).expect(200)).body;
    expect(lista.map((v: any) => [v.nome, v.pontuacao, v.situacao])).toEqual([
      ['Ana Souza', 100, 'sugerida'],
      ['Bia Lima', 50, 'sugerida'],
    ]);
    expect(lista[0].mesmaRegiao).toBe(true);
    expect(lista.every((v: any) => v.email === null && v.telefone === null)).toBe(true); // RN22

    expect((await ana.get('/api/notificacoes').expect(200)).body).toHaveLength(1);
    expect((await ana.get('/api/notificacoes/contagem').expect(200)).body.naoLidas).toBe(1);
    expect(emails.filter((e) => e.assunto.includes('Nova oportunidade'))).toHaveLength(2);
    const registrados = await db.query(`SELECT canal FROM notificacao WHERE id_usuario = $1 ORDER BY canal`, [idAna]);
    expect(registrados.map((n) => n.canal)).toEqual(['email', 'sistema']);
  });

  it('UC06/UC07: voluntário vê oportunidades, lê notificação e responde', async () => {
    const ops = (await ana.get('/api/oportunidades').expect(200)).body;
    expect(ops).toHaveLength(1);
    partAna = ops[0].idParticipacao;
    partBia = (await bia.get('/api/oportunidades').expect(200)).body[0].idParticipacao;
    expect((await ana.get(`/api/oportunidades?idArea=${idOutraArea}`).expect(200)).body).toHaveLength(0);
    await cris.get(`/api/oportunidades/${partAna}`).expect(404); // não é dele

    const notif = (await ana.get('/api/notificacoes').expect(200)).body[0];
    const lida = (await ana.post(`/api/notificacoes/${notif.id}/ler`).expect(200)).body;
    expect(lida.idParticipacao).toBe(partAna);
    expect((await ana.get('/api/notificacoes/contagem').expect(200)).body.naoLidas).toBe(0);

    await ana.post(`/api/participacoes/${partAna}/cancelar`).expect(422); // ainda sugerida
    expect((await ana.post(`/api/participacoes/${partAna}/confirmar`).expect(200)).body.situacao).toBe('confirmada');
    await bia.post(`/api/participacoes/${partBia}/confirmar`).expect(200);
  });

  it('UC15/UC16/UC17: contato liberado só para confirmados; limite de vagas', async () => {
    const lista = (await gestor.get(`/api/demandas/${idDemanda}/voluntarios`).expect(200)).body;
    expect(lista.every((v: any) => v.email && v.telefone)).toBe(true);

    const resumo = (await gestor.get(`/api/voluntarios/${idAna}/resumo`).expect(200)).body;
    expect(resumo).toMatchObject({ nome: 'Ana Souza', participacoes: 0, faltas: 0 });

    await gestor.post(`/api/demandas/${idDemanda}/selecionar`).send({ idParticipacoes: [partAna, partBia] }).expect(409); // 2 > 1 vaga
    await ana.post(`/api/demandas/${idDemanda}/selecionar`).send({ idParticipacoes: [partAna] }).expect(403);
    await gestor.post(`/api/demandas/${idDemanda}/selecionar`).send({ idParticipacoes: [partAna] }).expect(200);
    await gestor.post(`/api/demandas/${idDemanda}/selecionar`).send({ idParticipacoes: [partBia] }).expect(409); // vagas esgotadas
    expect(emails.some((e) => e.para === 'ana@teste.com' && e.assunto.includes('selecionado'))).toBe(true);
  });

  it('UC14: editar refaz o cruzamento e avisa os envolvidos', async () => {
    await davi.put(`/api/demandas/${idDemanda}`).send({}).expect(403); // voluntário não edita demanda
    const corpo = {
      titulo: 'Mutirão de teste',
      descricao: 'Descrição da ação',
      idArea,
      idRegiao,
      local: 'Praça Central',
      dataInicio: `${DIA}T14:00`,
      dataFim: `${DIA}T16:00`,
      vagas: 1,
    };
    await gestor.put(`/api/demandas/${idDemanda}`).send(corpo).expect(200);
    const nomes = (await gestor.get(`/api/demandas/${idDemanda}/voluntarios`).expect(200)).body.map((v: any) => v.nome);
    expect(nomes).toContain('Cris Dias'); // agora a disponibilidade dela cobre
    expect(emails.filter((e) => e.assunto.startsWith('Demanda alterada')).map((e) => e.para).sort()).toEqual(['ana@teste.com', 'bia@teste.com']);
    expect((await cris.get('/api/oportunidades').expect(200)).body).toHaveLength(1);
  });

  it('UC18: presença conclui a demanda; UC08/UC09: histórico e certificado', async () => {
    await gestor.post(`/api/demandas/${idDemanda}/presencas`).send({ registros: [{ idParticipacao: partBia, compareceu: true }] }).expect(422); // Bia não foi selecionada
    const r = await gestor.post(`/api/demandas/${idDemanda}/presencas`).send({ registros: [{ idParticipacao: partAna, compareceu: true }] }).expect(200);
    expect(r.body.situacao).toBe('concluida');
    expect(r.body.totais.compareceram).toBe(1);
    await gestor.put(`/api/demandas/${idDemanda}`).send({}).expect(400); // validação antes da regra

    const h = (await ana.get('/api/voluntarios/me/historico').expect(200)).body;
    expect(h.totais).toEqual({ acoes: 1, horas: 2, faltas: 0 });

    const pdf = await ana.get(`/api/participacoes/${partAna}/certificado`).expect(200).expect('Content-Type', /pdf/);
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe('%PDF');
    await bia.get(`/api/participacoes/${partBia}/certificado`).expect(422); // sem presença
    const [{ codigo }] = await db.query('SELECT codigo_validacao AS codigo FROM certificado');
    expect(codigo).toMatch(/^VOL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    const v = (await http().get(`/api/certificados/validar/${codigo}`).expect(200)).body;
    expect(v).toMatchObject({ valido: true, nome: 'Ana Souza', horas: 2 });
    await http().get('/api/certificados/validar/VOL-0000-0000-0000').expect(404);
    await ana.get(`/api/participacoes/${partAna}/certificado`).expect(200); // reemitir mantém o código
    expect((await db.query('SELECT 1 FROM certificado')).length).toBe(1);
  });

  it('vitrine: voluntário vê demandas abertas da sua área, explora outras e se inscreve sozinho', async () => {
    const corpo = {
      titulo: 'Ação em outra área', descricao: 'Texto', idArea: idOutraArea, idRegiao: idOutraRegiao, local: 'Parque',
      dataInicio: `${DIA}T09:00`, dataFim: `${DIA}T10:00`, vagas: 3,
      organizacao: 'ONG Real', link: 'https://exemplo.org/vaga',
    };
    await gestor.post('/api/demandas').send({ ...corpo, link: 'ftp://x' }).expect(400);
    await gestor.post('/api/demandas').send({ ...corpo, latitude: -30.03 }).expect(400); // precisa das duas
    const comMapa = (await gestor.post('/api/demandas').send({ ...corpo, titulo: 'Com mapa', latitude: -30.0346, longitude: -51.2177 }).expect(201)).body.demanda;
    expect(comMapa).toMatchObject({ latitude: -30.0346, longitude: -51.2177 });
    await admin.delete(`/api/demandas/${comMapa.id}`).expect(200);
    const dem = (await gestor.post('/api/demandas').send(corpo).expect(201)).body.demanda;
    expect(dem).toMatchObject({ organizacao: 'ONG Real', link: 'https://exemplo.org/vaga' });

    // Bia (área idArea) não vê nas recomendadas, mas vê em "todas"
    const rec = (await bia.get('/api/oportunidades/explorar').expect(200)).body;
    expect(rec.some((o: any) => o.idDemanda === dem.id)).toBe(false);
    const todas = (await bia.get('/api/oportunidades/explorar?escopo=todas').expect(200)).body;
    const item = todas.find((o: any) => o.idDemanda === dem.id);
    expect(item).toMatchObject({ idParticipacao: null, situacao: null, mesmaArea: false, organizacao: 'ONG Real' });
    expect(todas[todas.length - 1].idDemanda).toBe(dem.id); // fora da área vem por último
    expect((await bia.get(`/api/oportunidades/explorar?escopo=todas&busca=ONG%20Real`).expect(200)).body).toHaveLength(1);

    // Davi (área idOutraArea, mesma região? não) vê nas recomendadas
    expect((await davi.get('/api/oportunidades/explorar').expect(200)).body.map((o: any) => o.idDemanda)).toContain(dem.id);

    const det = (await bia.get(`/api/oportunidades/demanda/${dem.id}`).expect(200)).body;
    expect(det.situacao).toBeNull();
    const insc = (await bia.post(`/api/oportunidades/demanda/${dem.id}/participar`).expect(200)).body;
    expect(insc.situacao).toBe('confirmada');
    await bia.post(`/api/oportunidades/demanda/${dem.id}/participar`).expect(200); // idempotente
    const vols = (await gestor.get(`/api/demandas/${dem.id}/voluntarios`).expect(200)).body;
    expect(vols.find((v: any) => v.nome === 'Bia Lima')).toMatchObject({ situacao: 'confirmada', email: 'bia@teste.com' });
    // Gestor e administrador também se inscrevem como voluntários
    expect((await gestor.get('/api/oportunidades/explorar?escopo=todas').expect(200)).body.map((o: any) => o.idDemanda)).toContain(dem.id);
    const doGestor = (await gestor.post(`/api/oportunidades/demanda/${dem.id}/participar`).expect(200)).body;
    expect(doGestor.situacao).toBe('confirmada');
    const doAdmin = (await admin.post(`/api/oportunidades/demanda/${dem.id}/participar`).expect(200)).body;
    expect(doAdmin.situacao).toBe('confirmada');
    expect((await gestor.get('/api/oportunidades').expect(200)).body.map((o: any) => o.idDemanda)).toContain(dem.id);
    await admin.post(`/api/participacoes/${doAdmin.idParticipacao}/cancelar`).expect(200);
    await gestor.get('/api/voluntarios/me/historico').expect(200);
    await gestor.get('/api/voluntarios/me').expect(403);
    const comEquipe = (await gestor.get(`/api/demandas/${dem.id}/voluntarios`).expect(200)).body;
    const gestorInscrito = comEquipe.find((v: any) => v.nome === 'Gestora Teste');
    expect(gestorInscrito).toMatchObject({ situacao: 'confirmada' });
    await gestor.get(`/api/voluntarios/${gestorInscrito.idVoluntario}/resumo`).expect(200);

    // Responsável não aprova uma inscrição (ex.: vagas esgotadas), o voluntário é avisado, e pode reconsiderar
    const partBiaVitrine = insc.idParticipacao;
    await gestor.post(`/api/demandas/${dem.id}/nao-aprovar`).send({ idParticipacao: partBiaVitrine, motivo: 'qualquer' }).expect(400);
    await bia.post(`/api/demandas/${dem.id}/nao-aprovar`).send({ idParticipacao: partBiaVitrine, motivo: 'vagas' }).expect(403);
    const aposNao = (await gestor.post(`/api/demandas/${dem.id}/nao-aprovar`)
      .send({ idParticipacao: partBiaVitrine, motivo: 'vagas', mensagem: 'Obrigado!' }).expect(200)).body;
    expect(aposNao.find((v: any) => v.nome === 'Bia Lima').situacao).toBe('nao_aprovada');
    await gestor.post(`/api/demandas/${dem.id}/nao-aprovar`).send({ idParticipacao: partBiaVitrine, motivo: 'vagas' }).expect(422);
    const avisoBia = (await bia.get('/api/notificacoes').expect(200)).body.find((n: any) => n.mensagem.includes('não foi aprovada'));
    expect(avisoBia.mensagem).toContain('As vagas desta ação já foram preenchidas.');
    expect(avisoBia.mensagem).toContain('Obrigado!');
    expect((await bia.post(`/api/oportunidades/demanda/${dem.id}/participar`).expect(200)).body.situacao).toBe('nao_aprovada');
    expect((await bia.get('/api/oportunidades').expect(200)).body.find((o: any) => o.idDemanda === dem.id).situacao).toBe('nao_aprovada');
    await bia.post(`/api/participacoes/${partBiaVitrine}/cancelar`).expect(422);
    const aposReconsiderar = (await gestor.post(`/api/demandas/${dem.id}/reconsiderar`).send({ idParticipacao: partBiaVitrine }).expect(200)).body;
    expect(aposReconsiderar.find((v: any) => v.nome === 'Bia Lima').situacao).toBe('confirmada');
    await gestor.post(`/api/demandas/${dem.id}/reconsiderar`).send({ idParticipacao: partBiaVitrine }).expect(422);

    // Admin cria, edita, cancela e exclui qualquer demanda
    const daAdmin = (await admin.post('/api/demandas').send({ ...corpo, titulo: 'Criada pelo admin' }).expect(201)).body.demanda;
    expect(daAdmin.podeEditar).toBe(true);
    await admin.put(`/api/demandas/${dem.id}`).send({ ...corpo, vagas: 5 }).expect(200);
    await gestor.delete(`/api/demandas/${dem.id}`).expect(403);
    await admin.delete(`/api/demandas/${dem.id}`).expect(200);
    await admin.delete(`/api/demandas/${daAdmin.id}`).expect(200);
    await admin.get(`/api/demandas/${dem.id}`).expect(404);
    await admin.delete(`/api/demandas/${dem.id}`).expect(404);
  });

  it('UC14: cancelar demanda notifica; demanda concluída não pode ser cancelada', async () => {
    await gestor.post(`/api/demandas/${idDemanda}/cancelar`).expect(422);
    const corpo = {
      titulo: 'Outra ação', descricao: 'Texto', idArea, idRegiao, local: 'Escola', dataInicio: `${DIA}T10:00`, dataFim: `${DIA}T11:00`, vagas: 2,
    };
    const nova = (await gestor.post('/api/demandas').send(corpo).expect(201)).body.demanda.id;
    const cancelada = await gestor.post(`/api/demandas/${nova}/cancelar`).expect(200);
    expect(cancelada.body.situacao).toBe('cancelada');
    expect(emails.some((e) => e.assunto.startsWith('Demanda cancelada'))).toBe(true);
    expect((await ana.get('/api/oportunidades').expect(200)).body).toHaveLength(0);
  });

  it('UC21/UC22/UC20: indicadores, relatório (JSON e PDF), catálogos e configuração', async () => {
    const ind = (await admin.get('/api/admin/indicadores').expect(200)).body;
    expect(ind).toMatchObject({ voluntariosAtivos: 4, demandasConcluidas: 1, participacoes: 1, horas: 2, taxaComparecimento: 1 });
    expect(ind.voluntariosPorArea.length).toBeGreaterThan(0);
    expect(ind.demandasPorMes.length).toBeGreaterThan(0);

    const rel = (await admin.get(`/api/admin/relatorios/engajamento?idArea=${idArea}`).expect(200)).body;
    expect(rel.totais).toMatchObject({ demandas: 1, presencas: 1, faltas: 0, horas: 2 });
    const pdf = await admin.get('/api/admin/relatorios/engajamento.pdf').expect(200).expect('Content-Type', /pdf/);
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe('%PDF');
    await ana.get('/api/admin/indicadores').expect(403);

    await admin.post('/api/admin/areas').send({ nome: 'Música' }).expect(201);
    await admin.post('/api/admin/areas').send({ nome: 'Música' }).expect(409);
    const novaRegiao = (await admin.post('/api/admin/regioes').send({ nome: 'Distrito Industrial' }).expect(201)).body;
    await admin.put(`/api/admin/regioes/${novaRegiao.id}`).send({ ativo: false }).expect(200);
    expect((await http().get('/api/catalogos/regioes').expect(200)).body.some((r: any) => r.id === novaRegiao.id)).toBe(false);

    const cfg = (await admin.put('/api/admin/config').send({ pesoRegiao: 30, nomeOrganizacao: 'ONG de Teste' }).expect(200)).body;
    expect(cfg).toMatchObject({ pesoBase: 50, pesoRegiao: 30, nomeOrganizacao: 'ONG de Teste' });
    await admin.put('/api/admin/config').send({ pesoBase: -1 }).expect(400);
  });

  it('UC19: admin não altera o próprio perfil; redefine acesso com senha temporária', async () => {
    const lista = (await admin.get('/api/admin/usuarios?perfil=gestor').expect(200)).body;
    expect(lista).toHaveLength(1);
    const [{ id: idAdmin }] = await db.query(`SELECT id_usuario AS id FROM usuario WHERE email = 'admin@teste.com'`);
    await admin.put(`/api/admin/usuarios/${idAdmin}`).send({ situacao: 'inativo' }).expect(422);
    const { senhaTemporaria } = (await admin.post(`/api/admin/usuarios/${lista[0].id}/redefinir-acesso`).expect(200)).body;
    await http().post('/api/auth/login').send({ email: 'gestor@teste.com', senha: senhaTemporaria }).expect(200);
    await admin.put(`/api/admin/usuarios/${lista[0].id}`).send({ situacao: 'inativo' }).expect(200);
    await http().post('/api/auth/login').send({ email: 'gestor@teste.com', senha: senhaTemporaria }).expect(401);
    await gestor.get('/api/demandas').expect(401); // sessão antiga deixa de valer com a conta inativa
  });

  it('admin exclui itens de catálogo sem uso e usuários', async () => {
    const area = (await admin.post('/api/admin/areas').send({ nome: 'Área temporária' }).expect(201)).body;
    await admin.delete(`/api/admin/areas/${area.id}`).expect(200);
    await admin.delete(`/api/admin/areas/${idArea}`).expect(409); // usada em demandas
    const reg = (await admin.post('/api/admin/regioes').send({ nome: 'Região temporária' }).expect(201)).body;
    await admin.delete(`/api/admin/regioes/${reg.id}`).expect(200);
    await ana.delete(`/api/admin/regioes/${idRegiao}`).expect(403);

    const g = (await admin.post('/api/admin/usuarios').send({ nome: 'Gestor Temp', email: 'temp@teste.com', senha: 'Temp12345', perfil: 'gestor' }).expect(201)).body;
    const [{ id: idAdmin }] = await db.query(`SELECT id_usuario AS id FROM usuario WHERE email = 'admin@teste.com'`);
    await admin.delete(`/api/admin/usuarios/${idAdmin}`).expect(422);
    await admin.delete(`/api/admin/usuarios/${g.id}`).expect(200);
    await admin.delete(`/api/admin/usuarios/${g.id}`).expect(404);
  });

  it('UC02: recuperação de senha com link de uso único', async () => {
    emails.length = 0;
    const r = (await http().post('/api/auth/recuperar-senha').send({ email: 'bia@teste.com' }).expect(200)).body;
    const r2 = (await http().post('/api/auth/recuperar-senha').send({ email: 'naoexiste@teste.com' }).expect(200)).body;
    expect(r.mensagem).toBe(r2.mensagem);
    expect(emails).toHaveLength(1);
    const token = emails[0].corpo.match(/token=([0-9a-f]{64})/)![1];
    await http().post('/api/auth/redefinir-senha').send({ token, senha: 'fraca' }).expect(400);
    await http().post('/api/auth/redefinir-senha').send({ token, senha: 'NovaSenha99' }).expect(200);
    await http().post('/api/auth/redefinir-senha').send({ token, senha: 'OutraSenha99' }).expect(422); // uso único
    await http().post('/api/auth/login').send({ email: 'bia@teste.com', senha: 'NovaSenha99' }).expect(200);
  });

  it('UC04/UC05: revogar consentimento tira o voluntário dos próximos cruzamentos; editar perfil', async () => {
    const perfil = (await ana.get('/api/voluntarios/me').expect(200)).body;
    const salvo = (await ana.put('/api/voluntarios/me').send({
      nome: 'Ana Souza Lima', email: 'ana@teste.com', telefone: '(11) 97777-6666', idRegiao: idRegiao, areas: perfil.areas,
      disponibilidades: perfil.disponibilidades,
    }).expect(200)).body;
    expect(salvo.nome).toBe('Ana Souza Lima');
    await ana.put('/api/voluntarios/me').send({ ...salvo, email: 'bia@teste.com' }).expect(409);

    expect((await ana.delete('/api/voluntarios/me/consentimento').expect(200)).body.vigente).toBe(false);
    const corpo = {
      titulo: 'Ação sem Ana', descricao: 'Texto', idArea, idRegiao, local: 'Local', dataInicio: `${DIA}T10:00`, dataFim: `${DIA}T11:00`, vagas: 2,
    };
    const r = await gestorNovo().then((g) => g.post('/api/demandas').send(corpo).expect(201));
    const nomes = (await db.query(`SELECT u.nome FROM participacao p JOIN usuario u ON u.id_usuario = p.id_voluntario WHERE p.id_demanda = $1`, [r.body.demanda.id])).map((x) => x.nome);
    expect(nomes).not.toContain('Ana Souza Lima');
    expect((await ana.post('/api/voluntarios/me/consentimento').send({ aceite: true }).expect(200)).body.vigente).toBe(true);
  });

  async function gestorNovo() {
    const g = http();
    await db.query(`UPDATE usuario SET situacao = 'ativo' WHERE email = 'gestor@teste.com'`);
    const { senhaTemporaria } = (await admin.post(`/api/admin/usuarios/${(await db.query(`SELECT id_usuario AS id FROM usuario WHERE email = 'gestor@teste.com'`))[0].id}/redefinir-acesso`).expect(200)).body;
    await g.post('/api/auth/login').send({ email: 'gestor@teste.com', senha: senhaTemporaria }).expect(200);
    return g;
  }

  it('UC10: exclusão exige senha e anonimiza preservando dados agregados', async () => {
    await ana.post('/api/voluntarios/me/excluir').send({ senha: 'errada123' }).expect(401);
    await ana.post('/api/voluntarios/me/excluir').send({ senha: 'Senha1234' }).expect(200);
    const [u] = await db.query('SELECT nome, email, telefone, situacao FROM usuario WHERE id_usuario = $1', [idAna]);
    expect(u).toMatchObject({ nome: 'Voluntário removido', telefone: null, situacao: 'excluido' });
    expect(u.email).toMatch(/@anonimo\.invalid$/);
    expect((await db.query('SELECT 1 FROM disponibilidade WHERE id_usuario = $1', [idAna])).length).toBe(0);
    await http().post('/api/auth/login').send({ email: 'ana@teste.com', senha: 'Senha1234' }).expect(401);
    const ind = (await admin.get('/api/admin/indicadores').expect(200)).body;
    expect(ind.horas).toBe(2); // horas agregadas permanecem nos indicadores
  });

  it('rotina de retenção exige segredo', async () => {
    await http().get('/api/cron/retencao').expect(403);
    process.env.CRON_SECRET = 'segredo-cron';
    await http().get('/api/cron/retencao').set('Authorization', 'Bearer errado').expect(403);
    await db.query(`UPDATE usuario SET ultimo_acesso = now() - interval '5 years' WHERE email = 'cris@teste.com'`);
    const r = await http().get('/api/cron/retencao').set('Authorization', 'Bearer segredo-cron').expect(200);
    expect(r.body.anonimizados).toBe(1);
  });
});
