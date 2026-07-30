-- =========================================================
-- RESET — use isso SOMENTE se seu projeto Supabase ainda não tem
-- dados reais que você queira manter (ex: você só rodou o schema
-- antigo por engano e quer recomeçar do zero).
--
-- Isso apaga TODAS as tabelas do app (solicitações incluídas!).
-- Rode este script primeiro, depois rode schema.sql e seed_data.sql
-- de novo, nessa ordem.
-- =========================================================

drop table if exists solicitacoes cascade;
drop table if exists motivo_setor cascade;
drop table if exists motivos cascade;
drop table if exists lote_peca cascade;
drop table if exists maquinas cascade;
drop table if exists pecas cascade;
drop table if exists lotes cascade;
drop table if exists setores cascade;
drop table if exists usuarios cascade;

drop function if exists login_inspetor(text, text);
drop function if exists login_usuario(text, text);
