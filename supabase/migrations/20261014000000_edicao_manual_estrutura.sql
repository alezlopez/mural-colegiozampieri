-- Cadastro manual de professores, disciplinas e vínculos no painel.
-- Regra: o que a secretaria edita no painel vale mais que a Mhund. A sincronização noturna deixa de mexer em
-- registros marcados com editado_no_painel e não recria vínculos que foram removidos no painel.

alter table public.professores add column if not exists editado_no_painel boolean not null default false;
alter table public.disciplinas add column if not exists editado_no_painel boolean not null default false;
alter table public.turma_disciplinas add column if not exists editado_no_painel boolean not null default false;

-- Vínculos (turma × disciplina) apagados no painel: a sincronização não os traz de volta.
create table if not exists public.vinculos_removidos (
  turma_id      bigint not null references public.turmas (id) on delete cascade,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  removido_em   timestamptz not null default now(),
  primary key (turma_id, disciplina_id)
);
alter table public.vinculos_removidos enable row level security;
drop policy if exists "admin gerencia vínculos removidos" on public.vinculos_removidos;
create policy "admin gerencia vínculos removidos" on public.vinculos_removidos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
