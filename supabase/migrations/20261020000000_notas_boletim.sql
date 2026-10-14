-- Notas e boletim. Regras de avaliação configuráveis por ano e segmento (nada fixo no código).
-- Família só vê as notas de bimestres com boletim publicado pela escola.

create table if not exists public.avaliacao_config (
  ano                   int not null,
  segmento              text not null check (segmento in ('infantil', 'fundamental1', 'fundamental2', 'medio')),
  -- [{"chave": "mensal", "nome": "Prova mensal", "peso": 1}, ...]
  avaliacoes            jsonb not null default '[]'::jsonb,
  media_aprovacao       numeric(4, 2) not null default 6,
  arredondamento        text not null default 'escola' check (arredondamento in ('escola', 'nenhum')),
  recuperacao_bimestral boolean not null default true,
  descritivo            boolean not null default false,   -- Infantil: parecer em texto, sem nota
  primary key (ano, segmento)
);

create table if not exists public.notas (
  aluno_codigo  text not null references public.alunos (codigo) on delete cascade on update cascade,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  ano           int not null,
  bimestre      int not null check (bimestre between 1 and 4),
  avaliacao     text not null,            -- chave da avaliação na configuração, ou 'rec' (recuperação bimestral)
  valor         numeric(4, 2) not null check (valor between 0 and 10),
  turma_id      bigint not null references public.turmas (id) on delete cascade,
  professor_id  bigint references public.professores (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (aluno_codigo, disciplina_id, ano, bimestre, avaliacao)
);
create index if not exists notas_turma_idx on public.notas (turma_id, disciplina_id, ano, bimestre);

create table if not exists public.pareceres (
  aluno_codigo  text not null references public.alunos (codigo) on delete cascade on update cascade,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  ano           int not null,
  bimestre      int not null check (bimestre between 1 and 4),
  texto         text not null check (char_length(texto) <= 6000),
  turma_id      bigint not null references public.turmas (id) on delete cascade,
  professor_id  bigint references public.professores (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (aluno_codigo, disciplina_id, ano, bimestre)
);

alter table public.bimestres add column if not exists boletim_publicado boolean not null default false;

-- O aluno está (ativo) nesta turma?
create or replace function public.aluno_na_turma(p_aluno text, p_turma bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.matriculas m where m.aluno_codigo = p_aluno and m.turma_id = p_turma and m.ativa);
$$;
revoke all on function public.aluno_na_turma(text, bigint) from public, anon;
grant execute on function public.aluno_na_turma(text, bigint) to authenticated;

-- Família: notas e pareceres do próprio filho, só de bimestre com boletim publicado.
create or replace function public.familia_ve_boletim(p_aluno text, p_ano int, p_bimestre int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.aluno_responsaveis r where r.aluno_codigo = p_aluno and r.telefone = public.meu_telefone())
     and exists (select 1 from public.bimestres b where b.ano = p_ano and b.numero = p_bimestre and b.boletim_publicado);
$$;
revoke all on function public.familia_ve_boletim(text, int, int) from public, anon;
grant execute on function public.familia_ve_boletim(text, int, int) to authenticated;

alter table public.avaliacao_config enable row level security;
alter table public.notas enable row level security;
alter table public.pareceres enable row level security;

drop policy if exists "logado lê avaliação" on public.avaliacao_config;
create policy "logado lê avaliação" on public.avaliacao_config for select to authenticated using (true);
drop policy if exists "admin gerencia avaliação" on public.avaliacao_config;
create policy "admin gerencia avaliação" on public.avaliacao_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['notas', 'pareceres'] loop
    execute format('drop policy if exists "lê %1$s" on public.%1$I', t);
    execute format(
      'create policy "lê %1$s" on public.%1$I for select to authenticated using ('
      'public.is_admin() or public.leciona(turma_id, disciplina_id) or public.familia_ve_boletim(aluno_codigo, ano, bimestre))', t);
    execute format('drop policy if exists "lança %1$s" on public.%1$I', t);
    execute format(
      'create policy "lança %1$s" on public.%1$I for all to authenticated '
      'using (public.is_admin() or public.leciona(turma_id, disciplina_id)) '
      'with check (public.is_admin() or (public.leciona(turma_id, disciplina_id) and public.aluno_na_turma(aluno_codigo, turma_id)))', t);
  end loop;
end $$;

-- Regras informadas pela escola para 2027 (editáveis no painel).
insert into public.avaliacao_config (ano, segmento, avaliacoes, descritivo) values
  (2027, 'infantil', '[]', true),
  (2027, 'fundamental1', '[{"chave":"mensal","nome":"Prova mensal","peso":1},{"chave":"bimestral","nome":"Prova bimestral","peso":1}]', false),
  (2027, 'fundamental2', '[{"chave":"mensal","nome":"Prova mensal","peso":1},{"chave":"bimestral","nome":"Prova bimestral","peso":1},{"chave":"avaliacao","nome":"Avaliação bimestral","peso":1}]', false),
  (2027, 'medio', '[{"chave":"mensal","nome":"Prova mensal","peso":1},{"chave":"bimestral","nome":"Prova bimestral","peso":1},{"chave":"avaliacao","nome":"Avaliação bimestral","peso":1}]', false)
on conflict (ano, segmento) do nothing;
