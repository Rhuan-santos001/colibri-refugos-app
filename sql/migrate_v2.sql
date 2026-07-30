-- =========================================================
-- MIGRAÇÃO (alternativa ao reset.sql) — use isso SÓ SE você já tem
-- solicitações reais salvas e não quer perder. Ajusta as tabelas
-- antigas para o formato novo, sem apagar nada.
-- =========================================================

-- motivos: adiciona coluna codigo (se não existir) e ajusta unicidade
alter table motivos add column if not exists codigo text;
alter table motivos drop constraint if exists motivos_descricao_key;
alter table motivos add constraint motivos_codigo_key unique (codigo);

-- maquinas: adiciona vínculo com setor
alter table maquinas add column if not exists setor_id bigint references setores(id);

-- tabela de relação motivo <-> setor
create table if not exists motivo_setor (
  motivo_id bigint references motivos(id) on delete cascade,
  setor_id bigint references setores(id) on delete cascade,
  primary key (motivo_id, setor_id)
);
alter table motivo_setor enable row level security;
drop policy if exists "leitura publica motivo_setor" on motivo_setor;
create policy "leitura publica motivo_setor" on motivo_setor for select using (true);

-- Depois de rodar isso, rode sql/seed_data.sql para popular os
-- motivos/máquinas/setores reais da planilha.
