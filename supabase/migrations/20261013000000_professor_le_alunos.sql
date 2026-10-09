-- Professor vê os alunos das turmas em que leciona (para a chamada e o diário).
-- Só leitura; famílias continuam vendo apenas os próprios filhos e o admin, todos.

create or replace function public.aluno_das_minhas_turmas(p_aluno text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matriculas m
    join public.turma_disciplinas td on td.turma_id = m.turma_id
    where m.aluno_codigo = p_aluno and m.ativa and td.professor_id = public.meu_professor_id()
  );
$$;
revoke all on function public.aluno_das_minhas_turmas(text) from public, anon;
grant execute on function public.aluno_das_minhas_turmas(text) to authenticated;

drop policy if exists "professor vê alunos das suas turmas" on public.alunos;
create policy "professor vê alunos das suas turmas"
  on public.alunos for select
  to authenticated
  using (public.aluno_das_minhas_turmas(codigo));
