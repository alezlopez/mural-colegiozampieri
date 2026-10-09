-- Pedagógico (base): estrutura escolar, horários, calendário e diário do professor.
-- Estrutura (turmas, disciplinas, professores, vínculos e matrículas) é SINCRONIZADA da Mhund (só leitura lá);
-- horários, calendário e diário são criados aqui. Tudo editável pelo painel: nada de regra fixa no código.
-- Notas, recuperação e boletim entram numa migração própria, depois de fechadas as regras.

-- ---------------------------------------------------------------------------
-- Estrutura escolar
-- ---------------------------------------------------------------------------
create table if not exists public.anos_letivos (
  ano    int primary key,
  inicio date not null,
  fim    date not null,
  ativo  boolean not null default false,
  check (fim > inicio)
);

create table if not exists public.bimestres (
  ano    int not null references public.anos_letivos (ano) on delete cascade,
  numero int not null check (numero between 1 and 4),
  inicio date not null,
  fim    date not null,
  primary key (ano, numero),
  check (fim >= inicio)
);

-- Grade de horários editável: "Manhã" (7 aulas), "Tarde" (6 aulas), ou modelos especiais por turma.
create table if not exists public.modelos_horario (
  id   bigint generated always as identity primary key,
  nome text not null unique
);

create table if not exists public.modelo_horario_aulas (
  modelo_id    bigint not null references public.modelos_horario (id) on delete cascade,
  numero       int not null check (numero between 1 and 15),
  inicio       time not null,
  fim          time not null,
  eh_intervalo boolean not null default false,
  primary key (modelo_id, numero),
  check (fim > inicio)
);

create table if not exists public.turmas (
  id               bigint primary key,            -- idDoCurso da Mhund
  ano              int not null,
  nome             text not null,                 -- "Ensino Fundamental I - 1º Ano A" (= alunos.turma)
  nome_reduzido    text,
  serie            text,
  letra            text,
  turno            text check (turno in ('manha', 'tarde')),
  segmento         text not null check (segmento in ('infantil', 'fundamental1', 'fundamental2', 'medio')),
  modelo_horario_id bigint references public.modelos_horario (id) on delete set null,
  ativa            boolean not null default true,
  sincronizado_em  timestamptz
);
create index if not exists turmas_ano_idx on public.turmas (ano) where ativa;
create index if not exists turmas_nome_idx on public.turmas (nome);

create table if not exists public.disciplinas (
  id          bigint primary key,                 -- idDaDisciplina da Mhund
  nome        text not null,
  abreviacao  text,
  ativa       boolean not null default true
);

create table if not exists public.professores (
  id         bigint primary key,                  -- idDoProfessor da Mhund
  nome       text not null,
  email      text unique,
  user_id    uuid unique references auth.users (id) on delete set null,  -- login no painel
  ativo      boolean not null default true
);

-- Quem dá qual disciplina em qual turma (a "grade" da Mhund).
create table if not exists public.turma_disciplinas (
  turma_id      bigint not null references public.turmas (id) on delete cascade,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  professor_id  bigint references public.professores (id) on delete set null,
  primary key (turma_id, disciplina_id)
);
create index if not exists turma_disciplinas_prof_idx on public.turma_disciplinas (professor_id);

create table if not exists public.matriculas (
  aluno_codigo   text not null references public.alunos (codigo) on delete cascade on update cascade,
  turma_id       bigint not null references public.turmas (id) on delete cascade,
  ano            int not null,
  numero_chamada int,
  situacao       text,                            -- código da Mhund (ex.: "L")
  ativa          boolean not null default true,
  primary key (aluno_codigo, turma_id)
);
create index if not exists matriculas_turma_idx on public.matriculas (turma_id) where ativa;

-- Horário semanal da turma: em cada dia/aula, qual disciplina.
create table if not exists public.turma_horario (
  turma_id      bigint not null references public.turmas (id) on delete cascade,
  dia_semana    int not null check (dia_semana between 1 and 6),   -- 1 = segunda
  aula_numero   int not null,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  primary key (turma_id, dia_semana, aula_numero)
);

-- ---------------------------------------------------------------------------
-- Calendário anual
-- ---------------------------------------------------------------------------
create table if not exists public.calendario_eventos (
  id          bigint generated always as identity primary key,
  ano         int not null,
  inicio      date not null,
  fim         date not null,
  tipo        text not null check (tipo in ('feriado', 'recesso', 'sabado_letivo', 'avaliacao', 'evento', 'reuniao', 'conselho', 'outro')),
  titulo      text not null,
  descricao   text,
  -- false = suspende aulas nesses dias (feriado, recesso); true = conta como dia letivo (sábado letivo).
  letivo      boolean not null default true,
  turmas      bigint[],                            -- null = escola toda
  publico     boolean not null default true,       -- aparece para as famílias no app
  check (fim >= inicio)
);
create index if not exists calendario_eventos_periodo_idx on public.calendario_eventos (ano, inicio);

-- ---------------------------------------------------------------------------
-- Diário do professor
-- ---------------------------------------------------------------------------
create table if not exists public.aulas (
  id             uuid primary key default gen_random_uuid(),
  turma_id       bigint not null references public.turmas (id) on delete cascade,
  disciplina_id  bigint not null references public.disciplinas (id) on delete cascade,
  data           date not null,
  aula_numero    int not null default 1,
  conteudo       text,
  tarefa         text,
  tarefa_entrega date,
  professor_id   bigint references public.professores (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (turma_id, disciplina_id, data, aula_numero)
);
create index if not exists aulas_turma_data_idx on public.aulas (turma_id, data desc);

create table if not exists public.frequencias (
  aula_id      uuid not null references public.aulas (id) on delete cascade,
  aluno_codigo text not null references public.alunos (codigo) on delete cascade on update cascade,
  status       text not null check (status in ('presente', 'falta', 'falta_justificada')),
  primary key (aula_id, aluno_codigo)
);
create index if not exists frequencias_aluno_idx on public.frequencias (aluno_codigo);

create table if not exists public.planejamentos (
  id            uuid primary key default gen_random_uuid(),
  turma_id      bigint not null references public.turmas (id) on delete cascade,
  disciplina_id bigint not null references public.disciplinas (id) on delete cascade,
  professor_id  bigint references public.professores (id) on delete set null,
  periodo       text not null check (periodo in ('semanal', 'mensal')),
  inicio        date not null,
  fim           date not null,
  texto         text not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim >= inicio)
);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
create or replace function public.meu_professor_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.professores where user_id = auth.uid() and ativo;
$$;
revoke all on function public.meu_professor_id() from public, anon;
grant execute on function public.meu_professor_id() to authenticated;

-- O professor logado leciona esta disciplina nesta turma?
create or replace function public.leciona(p_turma bigint, p_disciplina bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.turma_disciplinas td
    where td.turma_id = p_turma and td.disciplina_id = p_disciplina
      and td.professor_id = public.meu_professor_id()
  );
$$;
revoke all on function public.leciona(bigint, bigint) from public, anon;
grant execute on function public.leciona(bigint, bigint) to authenticated;

-- O responsável logado tem filho ativo nesta turma?
create or replace function public.familia_da_turma(p_turma bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matriculas m
    join public.aluno_responsaveis r on r.aluno_codigo = m.aluno_codigo
    where m.turma_id = p_turma and m.ativa and r.telefone = public.meu_telefone()
  );
$$;
revoke all on function public.familia_da_turma(bigint) from public, anon;
grant execute on function public.familia_da_turma(bigint) to authenticated;

alter table public.anos_letivos enable row level security;
alter table public.bimestres enable row level security;
alter table public.modelos_horario enable row level security;
alter table public.modelo_horario_aulas enable row level security;
alter table public.turmas enable row level security;
alter table public.disciplinas enable row level security;
alter table public.professores enable row level security;
alter table public.turma_disciplinas enable row level security;
alter table public.matriculas enable row level security;
alter table public.turma_horario enable row level security;
alter table public.calendario_eventos enable row level security;
alter table public.aulas enable row level security;
alter table public.frequencias enable row level security;
alter table public.planejamentos enable row level security;

-- Estrutura: leitura para qualquer usuário logado (equipe, professores e famílias); escrita só admin.
do $$
declare t text;
begin
  foreach t in array array['anos_letivos', 'bimestres', 'modelos_horario', 'modelo_horario_aulas', 'turmas',
                           'disciplinas', 'turma_disciplinas', 'turma_horario']
  loop
    execute format('drop policy if exists "logado lê %1$s" on public.%1$I', t);
    execute format('create policy "logado lê %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('drop policy if exists "admin gerencia %1$s" on public.%1$I', t);
    execute format('create policy "admin gerencia %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Professores: a equipe vê todos; cada professor vê o próprio cadastro. Famílias não veem e-mails.
drop policy if exists "professor vê o próprio cadastro" on public.professores;
create policy "professor vê o próprio cadastro" on public.professores for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
drop policy if exists "admin gerencia professores" on public.professores;
create policy "admin gerencia professores" on public.professores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Matrículas: equipe; professor das turmas em que leciona; família dos próprios filhos.
drop policy if exists "lê matrículas" on public.matriculas;
create policy "lê matrículas" on public.matriculas for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.turma_disciplinas td where td.turma_id = matriculas.turma_id and td.professor_id = public.meu_professor_id())
    or exists (select 1 from public.aluno_responsaveis r where r.aluno_codigo = matriculas.aluno_codigo and r.telefone = public.meu_telefone())
  );
drop policy if exists "admin gerencia matrículas" on public.matriculas;
create policy "admin gerencia matrículas" on public.matriculas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Calendário: eventos públicos para quem está logado (e da turma do filho); equipe vê e edita tudo.
drop policy if exists "lê calendário" on public.calendario_eventos;
create policy "lê calendário" on public.calendario_eventos for select to authenticated
  using (
    public.is_admin() or public.meu_professor_id() is not null
    or (publico and (turmas is null or exists (select 1 from unnest(turmas) t where public.familia_da_turma(t))))
  );
drop policy if exists "admin gerencia calendário" on public.calendario_eventos;
create policy "admin gerencia calendário" on public.calendario_eventos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Diário: professor lança e edita as aulas das suas turmas/disciplinas; famílias leem as da turma do filho.
drop policy if exists "lê aulas" on public.aulas;
create policy "lê aulas" on public.aulas for select to authenticated
  using (public.is_admin() or public.leciona(turma_id, disciplina_id) or public.familia_da_turma(turma_id));
drop policy if exists "professor lança aulas" on public.aulas;
create policy "professor lança aulas" on public.aulas for insert to authenticated
  with check (public.is_admin() or public.leciona(turma_id, disciplina_id));
drop policy if exists "professor edita aulas" on public.aulas;
create policy "professor edita aulas" on public.aulas for update to authenticated
  using (public.is_admin() or public.leciona(turma_id, disciplina_id))
  with check (public.is_admin() or public.leciona(turma_id, disciplina_id));
drop policy if exists "professor remove aulas" on public.aulas;
create policy "professor remove aulas" on public.aulas for delete to authenticated
  using (public.is_admin() or public.leciona(turma_id, disciplina_id));

-- Frequência: professor da aula lança; família vê só a do próprio filho.
drop policy if exists "lê frequência" on public.frequencias;
create policy "lê frequência" on public.frequencias for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.aulas a where a.id = aula_id and public.leciona(a.turma_id, a.disciplina_id))
    or exists (select 1 from public.aluno_responsaveis r where r.aluno_codigo = frequencias.aluno_codigo and r.telefone = public.meu_telefone())
  );
drop policy if exists "professor lança frequência" on public.frequencias;
create policy "professor lança frequência" on public.frequencias for all to authenticated
  using (public.is_admin() or exists (select 1 from public.aulas a where a.id = aula_id and public.leciona(a.turma_id, a.disciplina_id)))
  with check (public.is_admin() or exists (select 1 from public.aulas a where a.id = aula_id and public.leciona(a.turma_id, a.disciplina_id)));

-- Planejamento: só equipe e o próprio professor (não aparece para famílias).
drop policy if exists "professor gerencia planejamentos" on public.planejamentos;
create policy "professor gerencia planejamentos" on public.planejamentos for all to authenticated
  using (public.is_admin() or public.leciona(turma_id, disciplina_id))
  with check (public.is_admin() or public.leciona(turma_id, disciplina_id));

-- Horários padrão da escola (editáveis no painel).
insert into public.modelos_horario (nome) values ('Manhã'), ('Tarde') on conflict (nome) do nothing;
insert into public.modelo_horario_aulas (modelo_id, numero, inicio, fim)
select m.id, a.numero, a.inicio::time, a.fim::time
from public.modelos_horario m
join (values
  ('Manhã', 1, '07:15', '08:00'), ('Manhã', 2, '08:00', '08:45'), ('Manhã', 3, '08:45', '09:30'),
  ('Manhã', 4, '09:50', '10:35'), ('Manhã', 5, '10:35', '11:20'), ('Manhã', 6, '11:20', '12:05'),
  ('Manhã', 7, '12:05', '12:50'),
  ('Tarde', 1, '13:05', '13:50'), ('Tarde', 2, '13:50', '14:35'), ('Tarde', 3, '14:35', '15:20'),
  ('Tarde', 4, '15:40', '16:25'), ('Tarde', 5, '16:25', '17:10'), ('Tarde', 6, '17:10', '17:55')
) as a(modelo, numero, inicio, fim) on a.modelo = m.nome
on conflict (modelo_id, numero) do nothing;
