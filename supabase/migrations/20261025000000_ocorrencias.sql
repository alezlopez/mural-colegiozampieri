-- Ocorrências do aluno, registradas pela coordenação ou pelo professor e vistas pela família no app.
-- Fluxo: professor registra → fica "pendente" até a coordenação revisar → "publicada" (família vê e recebe aviso)
-- ou "interna" (só a escola vê). A coordenação pode registrar já publicando e pedir ciência nas mais graves.

create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  aluno_codigo text not null references public.alunos (codigo) on update cascade on delete cascade,
  turma_id bigint references public.turmas (id) on delete set null,
  ano int not null,
  data date not null,
  tipo text not null check (tipo in ('disciplinar', 'pedagogica', 'outra')),
  descricao text not null check (length(btrim(descricao)) between 3 and 4000),
  providencia text check (providencia is null or length(providencia) <= 2000),
  disciplina_id bigint references public.disciplinas (id) on delete set null,
  professor_id bigint references public.professores (id) on delete set null,
  registrado_por uuid references auth.users (id) on delete set null,
  registrado_por_nome text not null,
  status text not null default 'pendente' check (status in ('pendente', 'publicada', 'interna')),
  exige_ciencia boolean not null default false,
  publicada_em timestamptz,
  revisado_por uuid references auth.users (id) on delete set null,
  ciencia_em timestamptz,
  ciencia_telefone text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ocorrencias_aluno_idx on public.ocorrencias (aluno_codigo, data desc);
create index if not exists ocorrencias_status_idx on public.ocorrencias (status, ano);

alter table public.ocorrencias enable row level security;

-- Equipe do painel: tudo.
create policy "equipe gerencia ocorrências" on public.ocorrencias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Professor: registra para aluno das turmas dele, sempre como pendente e sem pedir ciência; vê e ajusta as dele
-- enquanto a coordenação não revisou.
create policy "professor registra ocorrência" on public.ocorrencias for insert to authenticated
  with check (
    public.meu_professor_id() is not null
    and professor_id = public.meu_professor_id()
    and registrado_por = auth.uid()
    and status = 'pendente' and not exige_ciencia and publicada_em is null and ciencia_em is null
    and public.aluno_das_minhas_turmas(aluno_codigo)
  );
create policy "professor vê as que registrou" on public.ocorrencias for select to authenticated
  using (registrado_por = auth.uid() and public.meu_professor_id() is not null);
create policy "professor ajusta pendente" on public.ocorrencias for update to authenticated
  using (registrado_por = auth.uid() and status = 'pendente' and public.meu_professor_id() is not null)
  with check (
    registrado_por = auth.uid() and professor_id = public.meu_professor_id()
    and status = 'pendente' and not exige_ciencia and publicada_em is null and ciencia_em is null
    and public.aluno_das_minhas_turmas(aluno_codigo)
  );
create policy "professor apaga pendente" on public.ocorrencias for delete to authenticated
  using (registrado_por = auth.uid() and status = 'pendente' and public.meu_professor_id() is not null);

-- Família: só as publicadas dos próprios filhos.
create policy "família vê ocorrências publicadas" on public.ocorrencias for select to authenticated
  using (status = 'publicada' and public.eh_responsavel(aluno_codigo));

create or replace function public.ocorrencias_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
drop trigger if exists ocorrencias_atualizado_em on public.ocorrencias;
create trigger ocorrencias_atualizado_em before update on public.ocorrencias
  for each row execute function public.ocorrencias_atualizado_em();

-- "Li e estou ciente" do responsável (só quando a coordenação pediu ciência).
create or replace function public.dar_ciencia_ocorrencia(p_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v public.ocorrencias;
begin
  select * into v from public.ocorrencias where id = p_id for update;
  if not found or v.status <> 'publicada' or not public.eh_responsavel(v.aluno_codigo) then
    raise exception 'Ocorrência não encontrada.' using errcode = '42501';
  end if;
  if not v.exige_ciencia then
    raise exception 'Esta ocorrência não pede ciência.' using errcode = '22023';
  end if;
  if v.ciencia_em is null then
    update public.ocorrencias set ciencia_em = now(), ciencia_telefone = public.meu_telefone() where id = p_id
      returning ciencia_em into v.ciencia_em;
  end if;
  return v.ciencia_em;
end;
$$;
revoke execute on function public.dar_ciencia_ocorrencia(uuid) from public, anon;
grant execute on function public.dar_ciencia_ocorrencia(uuid) to authenticated;

-- Aparelhos dos responsáveis de um aluno (aviso de ocorrência publicada). Só o servidor do painel chama.
create or replace function public.tokens_do_aluno(p_aluno text)
returns table (token text) language sql stable security definer set search_path = public as $$
  select t.token
  from public.push_tokens t
  join auth.users u on u.id = t.user_id
  join public.aluno_responsaveis r on r.telefone = u.phone
  where t.desativado_em is null and r.aluno_codigo = p_aluno;
$$;
revoke execute on function public.tokens_do_aluno(text) from public, anon, authenticated;
grant execute on function public.tokens_do_aluno(text) to service_role;
