-- =========================================================
-- MIGRAÇÃO v3 — adiciona a relação Lote <-> Peça
-- Rode isso se seu banco já tem o schema.sql anterior aplicado e você
-- só quer adicionar a tabela nova, sem perder dados existentes.
-- =========================================================

create table if not exists lote_peca (
  lote_id bigint references lotes(id) on delete cascade,
  peca_id bigint references pecas(id) on delete cascade,
  primary key (lote_id, peca_id)
);

alter table lote_peca enable row level security;

drop policy if exists "leitura publica lote_peca" on lote_peca;
create policy "leitura publica lote_peca" on lote_peca for select using (true);

-- Depois de rodar isso, use scripts/atualizar_lotes_pecas.py para
-- popular lotes, peças e os vínculos entre eles a partir do relatório
-- diário do sistema.
