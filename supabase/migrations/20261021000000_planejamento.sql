-- Planejamento do professor (semanal e mensal): campos estruturados e visto da coordenação.
-- "texto" (já existente, obrigatório) passa a ser os conteúdos.
alter table public.planejamentos
  add column if not exists objetivos text,
  add column if not exists metodologia text,
  add column if not exists recursos text,
  add column if not exists avaliacao text,
  add column if not exists comentario_coordenacao text,
  add column if not exists visto_em timestamptz,
  add column if not exists visto_por uuid references auth.users (id) on delete set null;

create index if not exists planejamentos_turma_idx on public.planejamentos (turma_id, disciplina_id, inicio desc);
create index if not exists planejamentos_inicio_idx on public.planejamentos (inicio);

-- Só a coordenação dá o visto. Se o professor muda o conteúdo depois do visto, o visto cai (precisa de nova leitura).
create or replace function public.planejamento_protege_visto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.visto_em := null;
    new.visto_por := null;
    new.comentario_coordenacao := null;
    return new;
  end if;
  new.visto_em := old.visto_em;
  new.visto_por := old.visto_por;
  new.comentario_coordenacao := old.comentario_coordenacao;
  if (new.texto, new.objetivos, new.metodologia, new.recursos, new.avaliacao, new.inicio, new.fim, new.periodo)
     is distinct from (old.texto, old.objetivos, old.metodologia, old.recursos, old.avaliacao, old.inicio, old.fim, old.periodo) then
    new.visto_em := null;
    new.visto_por := null;
  end if;
  return new;
end;
$$;

drop trigger if exists planejamento_protege_visto on public.planejamentos;
create trigger planejamento_protege_visto
  before insert or update on public.planejamentos
  for each row execute function public.planejamento_protege_visto();
