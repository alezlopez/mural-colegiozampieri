-- Cadastro manual de turmas no painel.
-- O nome da turma é o elo com alunos.turma e posts.turmas (texto): renomear precisa mudar os três juntos.

alter table public.turmas add column if not exists editado_no_painel boolean not null default false;

create or replace function public.renomear_turma(p_id bigint, p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antigo text;
  v_ano int;
begin
  if not public.is_admin() then
    raise exception 'sem permissão';
  end if;
  p_nome := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  if p_nome = '' then
    raise exception 'nome vazio';
  end if;

  select nome, ano into v_antigo, v_ano from public.turmas where id = p_id for update;
  if v_antigo is null then
    raise exception 'turma não encontrada';
  end if;
  if v_antigo = p_nome then
    return;
  end if;

  update public.turmas set nome = p_nome, editado_no_painel = true where id = p_id;
  -- Só os alunos matriculados nesta turma (o mesmo nome pode existir em outro ano).
  update public.alunos set turma = p_nome
  where turma = v_antigo
    and codigo in (select aluno_codigo from public.matriculas where turma_id = p_id and ativa);
  -- Publicações segmentadas: só se nenhuma outra turma ativa ainda usa o nome antigo.
  if not exists (select 1 from public.turmas where nome = v_antigo and ativa and id <> p_id) then
    update public.posts set turmas = array_replace(turmas, v_antigo, p_nome) where turmas @> array[v_antigo];
  end if;
end;
$$;
revoke all on function public.renomear_turma(bigint, text) from public, anon;
grant execute on function public.renomear_turma(bigint, text) to authenticated;
