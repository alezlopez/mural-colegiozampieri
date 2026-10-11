-- Matriz curricular por série: quais disciplinas cada série tem no ano, e quantas aulas por semana.
-- Aplicada às turmas da série (cria/retira linhas em turma_disciplinas). Série = segmento + turmas.serie.
create table if not exists public.matriz_curricular (
  ano           int not null,
  segmento      text not null check (segmento in ('infantil', 'fundamental1', 'fundamental2', 'medio')),
  serie         text not null,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  aulas_semanais int check (aulas_semanais between 1 and 20),
  primary key (ano, segmento, serie, disciplina_id)
);

alter table public.matriz_curricular enable row level security;
drop policy if exists "logado lê matriz" on public.matriz_curricular;
create policy "logado lê matriz" on public.matriz_curricular for select to authenticated using (true);
drop policy if exists "admin gerencia matriz" on public.matriz_curricular;
create policy "admin gerencia matriz" on public.matriz_curricular for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
