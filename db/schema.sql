-- Esquema PostgreSQL (Neon). Modelo: specs/03-modelo-de-dados.md
-- Idempotente: pode ser executado mais de uma vez.

CREATE TABLE IF NOT EXISTS regiao (
  id_regiao SERIAL PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL UNIQUE,
  ativo     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS area_atuacao (
  id_area SERIAL PRIMARY KEY,
  nome    VARCHAR(100) NOT NULL UNIQUE,
  ativo   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario    SERIAL PRIMARY KEY,
  nome          VARCHAR(150) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  senha_hash    VARCHAR(100) NOT NULL,
  telefone      VARCHAR(30),
  perfil        VARCHAR(20) NOT NULL CHECK (perfil IN ('voluntario','gestor','administrador')),
  situacao      VARCHAR(10) NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo','excluido')),
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_exclusao TIMESTAMPTZ,
  ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voluntario (
  id_usuario INTEGER PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_regiao  INTEGER REFERENCES regiao(id_regiao)
);

CREATE TABLE IF NOT EXISTS gestor (
  id_usuario  INTEGER PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  organizacao VARCHAR(150),
  cargo       VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS voluntario_area (
  id_usuario INTEGER NOT NULL REFERENCES voluntario(id_usuario) ON DELETE CASCADE,
  id_area    INTEGER NOT NULL REFERENCES area_atuacao(id_area),
  PRIMARY KEY (id_usuario, id_area)
);

CREATE TABLE IF NOT EXISTS disponibilidade (
  id_disponibilidade SERIAL PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES voluntario(id_usuario) ON DELETE CASCADE,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim    TIME NOT NULL,
  CHECK (hora_fim > hora_inicio)
);

CREATE TABLE IF NOT EXISTS consentimento (
  id_consentimento SERIAL PRIMARY KEY,
  id_usuario      INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  versao_termo    VARCHAR(20) NOT NULL,
  finalidade      VARCHAR(200) NOT NULL,
  data_aceite     TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_revogacao  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS demanda (
  id_demanda  SERIAL PRIMARY KEY,
  id_gestor   INTEGER NOT NULL REFERENCES gestor(id_usuario),
  id_area     INTEGER NOT NULL REFERENCES area_atuacao(id_area),
  id_regiao   INTEGER NOT NULL REFERENCES regiao(id_regiao),
  titulo      VARCHAR(200) NOT NULL,
  descricao   TEXT NOT NULL,
  local_acao  VARCHAR(250) NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim    TIMESTAMPTZ NOT NULL,
  vagas       INTEGER NOT NULL CHECK (vagas >= 1),
  situacao    VARCHAR(10) NOT NULL DEFAULT 'aberta' CHECK (situacao IN ('aberta','concluida','cancelada')),
  CHECK (data_fim > data_inicio)
);

CREATE TABLE IF NOT EXISTS participacao (
  id_participacao   SERIAL PRIMARY KEY,
  id_demanda        INTEGER NOT NULL REFERENCES demanda(id_demanda) ON DELETE CASCADE,
  id_voluntario     INTEGER NOT NULL REFERENCES voluntario(id_usuario) ON DELETE CASCADE,
  situacao          VARCHAR(12) NOT NULL DEFAULT 'sugerida'
    CHECK (situacao IN ('sugerida','confirmada','recusada','selecionada','compareceu','faltou','cancelada')),
  pontuacao         NUMERIC(8,2) NOT NULL DEFAULT 0,
  horas_realizadas  NUMERIC(6,2),
  data_registro     TIMESTAMPTZ,
  data_atualizacao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_demanda, id_voluntario)
);

CREATE TABLE IF NOT EXISTS notificacao (
  id_notificacao SERIAL PRIMARY KEY,
  id_usuario     INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_demanda     INTEGER REFERENCES demanda(id_demanda) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL DEFAULT 'outro'
    CHECK (tipo IN ('oportunidade','selecao','alteracao','cancelamento','outro')),
  mensagem       TEXT NOT NULL,
  canal          VARCHAR(10) NOT NULL CHECK (canal IN ('sistema','email')),
  status_envio   VARCHAR(10) NOT NULL DEFAULT 'enviada' CHECK (status_envio IN ('enviada','falha','ignorada')),
  data_envio     TIMESTAMPTZ NOT NULL DEFAULT now(),
  lida           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS certificado (
  id_certificado   SERIAL PRIMARY KEY,
  id_participacao  INTEGER NOT NULL UNIQUE REFERENCES participacao(id_participacao) ON DELETE CASCADE,
  codigo_validacao VARCHAR(30) NOT NULL UNIQUE,
  data_emissao     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redefinicao_senha (
  id         SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expira_em  TIMESTAMPTZ NOT NULL,
  usado_em   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS configuracao (
  chave VARCHAR(50) PRIMARY KEY,
  valor VARCHAR(200) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_participacao_vol_sit ON participacao (id_voluntario, situacao);
CREATE INDEX IF NOT EXISTS ix_participacao_dem_sit ON participacao (id_demanda, situacao);
CREATE INDEX IF NOT EXISTS ix_demanda_sit_inicio   ON demanda (situacao, data_inicio);
CREATE INDEX IF NOT EXISTS ix_disp_usuario_dia     ON disponibilidade (id_usuario, dia_semana);
CREATE INDEX IF NOT EXISTS ix_notif_usuario_lida   ON notificacao (id_usuario, lida);
CREATE INDEX IF NOT EXISTS ix_vol_area_area        ON voluntario_area (id_area);
CREATE INDEX IF NOT EXISTS ix_consent_usuario      ON consentimento (id_usuario) WHERE data_revogacao IS NULL;

-- Valores iniciais (não sobrescrevem alterações feitas pelo administrador)
INSERT INTO configuracao (chave, valor) VALUES
  ('peso_base', '50'),
  ('peso_regiao', '50'),
  ('retencao_meses', '24'),
  ('nome_organizacao', 'Rede Mãos pela Cidade'),
  ('termo_versao', '1.0')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO area_atuacao (nome) VALUES
  ('Educação'), ('Meio ambiente'), ('Assistência social'), ('Saúde'), ('Eventos'), ('Esporte e lazer')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO regiao (nome) VALUES
  ('Centro'), ('Zona Norte'), ('Zona Sul'), ('Zona Leste'), ('Zona Oeste')
ON CONFLICT (nome) DO NOTHING;
