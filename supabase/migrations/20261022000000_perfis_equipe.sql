-- Perfis da equipe do painel: direção (tudo, inclusive a equipe), coordenação e secretaria.
-- O que coordenação e secretaria podem em cada área fica em perfil_permissoes (editável pela direção).
-- A checagem acontece no painel (telas e ações); no banco, toda a equipe continua "admin" (is_admin()).

alter table public.admins
  add column if not exists perfil text not null default 'direcao'
  check (perfil in ('direcao', 'coordenacao', 'secretaria'));

create table if not exists public.perfil_permissoes (
  perfil text not null check (perfil in ('coordenacao', 'secretaria')),
  area   text not null,
  nivel  text not null check (nivel in ('nenhum', 'ver', 'editar')),
  primary key (perfil, area)
);
alter table public.perfil_permissoes enable row level security;
drop policy if exists "equipe lê permissões" on public.perfil_permissoes;
create policy "equipe lê permissões" on public.perfil_permissoes for select to authenticated using (public.is_admin());
-- Escrita só pelo servidor do painel (service role), depois de conferir que quem pede é da direção.

insert into public.perfil_permissoes (perfil, area, nivel) values
  ('coordenacao', 'comunicacao', 'editar'),
  ('coordenacao', 'secretaria', 'ver'),
  ('coordenacao', 'estrutura', 'editar'),
  ('coordenacao', 'avaliacao', 'editar'),
  ('coordenacao', 'acompanhamento', 'editar'),
  ('secretaria', 'comunicacao', 'editar'),
  ('secretaria', 'secretaria', 'editar'),
  ('secretaria', 'estrutura', 'editar'),
  ('secretaria', 'avaliacao', 'ver'),
  ('secretaria', 'acompanhamento', 'ver')
on conflict (perfil, area) do nothing;
