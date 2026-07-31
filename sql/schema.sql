-- =========================================================
-- Sistema de Solicitação de Refugos
-- Schema para Supabase (Postgres)
-- Rode este script inteiro em: Supabase > SQL Editor > New query
-- =========================================================

-- ---------- Tabelas de apoio (usadas nos dropdowns) ----------

create table if not exists setores (
  id bigint generated always as identity primary key,
  nome text not null unique
);

create table if not exists maquinas (
  id bigint generated always as identity primary key,
  codigo text not null,          -- ex: "1110"
  nome text not null,            -- ex: "SEC.GIBEN"
  setor_id bigint references setores(id),   -- cada máquina pertence a 1 setor
  unique (codigo, nome)
);

create table if not exists pecas (
  id bigint generated always as identity primary key,
  codigo text not null unique    -- ex: "1882A0.004.110"
);

create table if not exists motivos (
  id bigint generated always as identity primary key,
  codigo text unique,             -- ex: "35" (código do motivo de refugo)
  descricao text not null         -- ex: "FALHA NA OPERAÇÃO"
);

-- Um motivo pode valer para vários setores (muitos são genéricos e
-- se repetem em todos os setores; alguns são específicos de um setor)
create table if not exists motivo_setor (
  motivo_id bigint references motivos(id) on delete cascade,
  setor_id bigint references setores(id) on delete cascade,
  primary key (motivo_id, setor_id)
);

create table if not exists lotes (
  id bigint generated always as identity primary key,
  numero text not null unique    -- ex: "6025"
);

-- Um lote pode ter várias peças, e uma peça pode aparecer em vários
-- lotes ao longo do tempo (relação N:N, confirmado no relatório real
-- de ordens de produção)
create table if not exists lote_peca (
  lote_id bigint references lotes(id) on delete cascade,
  peca_id bigint references pecas(id) on delete cascade,
  primary key (lote_id, peca_id)
);

-- ---------- Usuários (login simples do Inspetor) ----------
-- Observação de segurança: isso guarda a senha em texto puro por
-- simplicidade, igual ao app original. Não é recomendado para produção
-- real. Se quiser evoluir depois, dá para trocar por Supabase Auth.

create table if not exists usuarios (
  id bigint generated always as identity primary key,
  usuario text not null unique,
  senha text not null,
  tipo text not null default 'inspetor' check (tipo in ('inspetor','ppcp','qualidade','admin')),
  created_at timestamptz not null default now()
);

-- ---------- Solicitações de refugo ----------

create table if not exists solicitacoes (
  id bigint generated always as identity primary key,
  lote_id bigint references lotes(id),
  peca_id bigint references pecas(id),
  maquina_id bigint references maquinas(id),
  setor_id bigint references setores(id),
  motivo_id bigint references motivos(id),
  quantidade numeric not null check (quantidade > 0),
  data_solicitacao date not null default current_date,
  solicitante text not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  foto_url text,
  revisado_por text,
  revisado_em timestamptz,
  numero_ordem text,              -- ordem de fabricação (1 por registro, gerada pelo PPCP)
  ordem_gerada_por text,
  ordem_gerada_em timestamptz,
  -- Aprovação da Qualidade: verifica se há saldo no estoque da
  -- assistência antes do PPCP gerar a ordem de fabricação.
  -- 'aprovado'     = sem saldo -> PPCP PRECISA gerar ordem
  -- 'rejeitado'    = fluxo bloqueado, não segue pro PPCP
  -- 'consumido_99' = havia saldo/sobra, foi consumido do estoque -> bloqueia o PPCP
  status_qualidade text not null default 'pendente'
    check (status_qualidade in ('pendente','aprovado','rejeitado','consumido_99')),
  qualidade_revisado_por text,
  qualidade_revisado_em timestamptz,
  quantidade_consumida_estoque numeric,   -- só preenchido quando status_qualidade = 'consumido_99'
  created_at timestamptz not null default now()
);

-- ---------- Índices úteis ----------
create index if not exists idx_solicitacoes_status on solicitacoes(status);
create index if not exists idx_solicitacoes_created on solicitacoes(created_at desc);
create index if not exists idx_solicitacoes_numero_ordem on solicitacoes(numero_ordem);
create index if not exists idx_solicitacoes_status_qualidade on solicitacoes(status_qualidade);

-- =========================================================
-- ROW LEVEL SECURITY
-- Como o site (GitHub Pages) usa a chave "anon" pública, habilitamos
-- RLS e liberamos apenas as ações que o app precisa. Isso evita que
-- alguém use a anon key para, por exemplo, apagar tabelas.
-- =========================================================

alter table setores enable row level security;
alter table maquinas enable row level security;
alter table pecas enable row level security;
alter table motivos enable row level security;
alter table motivo_setor enable row level security;
alter table lotes enable row level security;
alter table lote_peca enable row level security;
alter table usuarios enable row level security;
alter table solicitacoes enable row level security;

-- Leitura pública das tabelas de apoio (para preencher os dropdowns)
create policy "leitura publica setores" on setores for select using (true);
create policy "leitura publica maquinas" on maquinas for select using (true);
create policy "leitura publica pecas" on pecas for select using (true);
create policy "leitura publica motivos" on motivos for select using (true);
create policy "leitura publica motivo_setor" on motivo_setor for select using (true);
create policy "leitura publica lotes" on lotes for select using (true);
create policy "leitura publica lote_peca" on lote_peca for select using (true);

-- Usuarios: ninguém lê a tabela toda pelo cliente (login é validado
-- via função RPC abaixo, que roda com privilégio de definidor)
-- então não criamos policy de select público aqui.

-- Solicitações: colaborador pode inserir e ver, inspetor pode
-- ler tudo e atualizar status
create policy "qualquer um insere solicitacao" on solicitacoes
  for insert with check (true);

create policy "qualquer um le solicitacoes" on solicitacoes
  for select using (true);

create policy "qualquer um atualiza status" on solicitacoes
  for update using (true);

-- =========================================================
-- FUNÇÃO DE LOGIN (evita expor a tabela usuarios via select público)
-- Retorna o TIPO do usuário ('inspetor', 'ppcp', 'admin') se a senha
-- bater, ou NULL se usuário/senha inválidos. O app usa esse tipo pra
-- decidir pra qual tela redirecionar.
-- =========================================================
create or replace function login_usuario(p_usuario text, p_senha text)
returns text
language sql
security definer
set search_path = public
as $$
  select tipo from usuarios
  where usuario = p_usuario and senha = p_senha
  limit 1;
$$;

grant execute on function login_usuario(text, text) to anon;

-- Mantido por compatibilidade com versões antigas do site publicado
create or replace function login_inspetor(p_usuario text, p_senha text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios
    where usuario = p_usuario and senha = p_senha
  );
$$;

grant execute on function login_inspetor(text, text) to anon;

-- =========================================================
-- DADOS REAIS DE SETOR / MÁQUINA / MOTIVO
-- Rode o arquivo sql/seed_data.sql (gerado a partir da sua planilha
-- SETOR_MOTIV_REFUGO_E_RECURSO.xlsx) logo depois deste script.
--
-- Lotes e peças NÃO têm dados de exemplo aqui — eles são importados
-- todo dia pelo script scripts/atualizar_lotes_pecas.py, a partir do
-- relatório exportado do sistema. Veja o README, seção "Importação
-- diária de lotes e peças".
-- =========================================================

-- Usuário inspetor de teste (troque a senha depois!)
insert into usuarios (usuario, senha, tipo) values ('inspetor', 'inspetor123', 'inspetor')
  on conflict do nothing;

-- Usuário PPCP de teste (troque a senha depois!)
insert into usuarios (usuario, senha, tipo) values ('ppcp', 'ppcp123', 'ppcp')
  on conflict do nothing;

-- Usuário Qualidade de teste (troque a senha depois!)
insert into usuarios (usuario, senha, tipo) values ('qualidade', 'qualidade123', 'qualidade')
  on conflict do nothing;

-- =========================================================
-- STORAGE (fotos anexadas na aprovação)
-- O bucket é criado pela tela do Supabase (ver README), mas a policy
-- de acesso público de leitura + upload fica aqui para referência.
-- Depois de criar o bucket "fotos-refugo" (público), rode:
-- =========================================================
-- insert into storage.buckets (id, name, public) values ('fotos-refugo','fotos-refugo', true)
--   on conflict (id) do nothing;

-- create policy "upload publico fotos" on storage.objects
--   for insert with check (bucket_id = 'fotos-refugo');

-- create policy "leitura publica fotos" on storage.objects
--   for select using (bucket_id = 'fotos-refugo');
