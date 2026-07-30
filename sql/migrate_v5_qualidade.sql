-- =========================================================
-- MIGRAÇÃO v5 — Perfil Qualidade (aprovação de estoque assistência)
-- Rode isso se seu banco já tem o schema.sql anterior aplicado.
-- =========================================================

-- Campos da aprovação da Qualidade
alter table solicitacoes add column if not exists status_qualidade text not null default 'pendente';
alter table solicitacoes drop constraint if exists solicitacoes_status_qualidade_check;
alter table solicitacoes add constraint solicitacoes_status_qualidade_check
  check (status_qualidade in ('pendente','aprovado','rejeitado','consumido_99'));

alter table solicitacoes add column if not exists qualidade_revisado_por text;
alter table solicitacoes add column if not exists qualidade_revisado_em timestamptz;
alter table solicitacoes add column if not exists quantidade_consumida_estoque numeric;

create index if not exists idx_solicitacoes_status_qualidade on solicitacoes(status_qualidade);

-- Permitir o tipo 'qualidade' na tabela de usuários
alter table usuarios drop constraint if exists usuarios_tipo_check;
alter table usuarios add constraint usuarios_tipo_check check (tipo in ('inspetor','ppcp','qualidade','admin'));

-- Usuário Qualidade de teste (troque a senha depois!)
insert into usuarios (usuario, senha, tipo) values ('qualidade', 'qualidade123', 'qualidade')
  on conflict do nothing;
