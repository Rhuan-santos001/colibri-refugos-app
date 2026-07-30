-- =========================================================
-- MIGRAÇÃO v4 — Perfil PPCP + Ordem de Fabricação
-- Rode isso se seu banco já tem o schema.sql anterior aplicado.
-- =========================================================

-- Campos da ordem de fabricação na solicitação
alter table solicitacoes add column if not exists numero_ordem text;
alter table solicitacoes add column if not exists ordem_gerada_por text;
alter table solicitacoes add column if not exists ordem_gerada_em timestamptz;

create index if not exists idx_solicitacoes_numero_ordem on solicitacoes(numero_ordem);

-- Permitir o tipo 'ppcp' na tabela de usuários
alter table usuarios drop constraint if exists usuarios_tipo_check;
alter table usuarios add constraint usuarios_tipo_check check (tipo in ('inspetor','ppcp','admin'));

-- Nova função de login que retorna o TIPO do usuário (pra redirecionar
-- pra tela certa: inspetor -> lista.html, ppcp -> producao.html)
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

-- Usuário PPCP de teste (troque a senha depois!)
insert into usuarios (usuario, senha, tipo) values ('ppcp', 'ppcp123', 'ppcp')
  on conflict do nothing;
