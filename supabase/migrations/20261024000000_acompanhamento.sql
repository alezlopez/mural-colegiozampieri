-- Acompanhamento da coordenação: resumos calculados no banco (frequência e notas têm muitas linhas).
-- security invoker: cada função respeita o RLS de quem chama (equipe vê tudo; professor, só o dele).

create index if not exists frequencias_aluno_idx on public.frequencias (aluno_codigo);
create index if not exists notas_ano_bimestre_idx on public.notas (ano, bimestre);

-- Chamadas registradas por aluno, turma e disciplina no ano (opcional: só um aluno).
create or replace function public.acomp_frequencia(p_ano int, p_aluno text default null)
returns table (aluno_codigo text, turma_id bigint, disciplina_id bigint, aulas int, faltas int, justificadas int)
language sql stable security invoker set search_path = public as $$
  select f.aluno_codigo, a.turma_id, a.disciplina_id,
         count(*)::int,
         count(*) filter (where f.status = 'falta')::int,
         count(*) filter (where f.status = 'falta_justificada')::int
  from public.frequencias f
  join public.aulas a on a.id = f.aula_id
  where a.data between make_date(p_ano, 1, 1) and make_date(p_ano, 12, 31)
    and (p_aluno is null or f.aluno_codigo = p_aluno)
  group by 1, 2, 3;
$$;

-- Notas do ano agrupadas por aluno/disciplina/bimestre, só onde alguma avaliação ficou abaixo do limite
-- (média ponderada abaixo do limite exige ao menos uma nota abaixo dele). A média exata é calculada no painel.
create or replace function public.acomp_notas_baixas(p_ano int, p_limite numeric)
returns table (aluno_codigo text, turma_id bigint, disciplina_id bigint, bimestre int, notas jsonb)
language sql stable security invoker set search_path = public as $$
  select n.aluno_codigo, max(n.turma_id), n.disciplina_id, n.bimestre, jsonb_object_agg(n.avaliacao, n.valor)
  from public.notas n
  where n.ano = p_ano
  group by n.aluno_codigo, n.disciplina_id, n.bimestre
  having min(n.valor) filter (where n.avaliacao <> 'rec') < p_limite;
$$;

-- Por turma/disciplina: aulas lançadas no período, aulas lançadas sem chamada, último lançamento e notas do bimestre.
create or replace function public.acomp_turma_disciplina(p_ano int, p_de date, p_ate date, p_bimestre int)
returns table (turma_id bigint, disciplina_id bigint, aulas_lancadas int, aulas_sem_chamada int, ultimo_lancamento timestamptz, notas_lancadas int)
language sql stable security invoker set search_path = public as $$
  with a as (
    select a.turma_id, a.disciplina_id,
           count(*) filter (where a.data between p_de and p_ate and a.conteudo is not null)::int as lancadas,
           count(*) filter (where a.data between p_de and p_ate and a.conteudo is not null
                            and not exists (select 1 from public.frequencias f where f.aula_id = a.id))::int as sem_chamada,
           max(coalesce(a.atualizado_em, a.criado_em)) as ultimo
    from public.aulas a
    where a.turma_id in (select id from public.turmas where ano = p_ano)
    group by 1, 2
  ), n as (
    select turma_id, disciplina_id, count(*)::int as c
    from public.notas
    where ano = p_ano and bimestre = p_bimestre and avaliacao <> 'rec'
    group by 1, 2
  )
  select coalesce(a.turma_id, n.turma_id), coalesce(a.disciplina_id, n.disciplina_id),
         coalesce(a.lancadas, 0), coalesce(a.sem_chamada, 0), a.ultimo, coalesce(n.c, 0)
  from a full join n on n.turma_id = a.turma_id and n.disciplina_id = a.disciplina_id;
$$;

revoke execute on function public.acomp_frequencia(int, text) from public, anon;
revoke execute on function public.acomp_notas_baixas(int, numeric) from public, anon;
revoke execute on function public.acomp_turma_disciplina(int, date, date, int) from public, anon;
grant execute on function public.acomp_frequencia(int, text) to authenticated;
grant execute on function public.acomp_notas_baixas(int, numeric) to authenticated;
grant execute on function public.acomp_turma_disciplina(int, date, date, int) to authenticated;
