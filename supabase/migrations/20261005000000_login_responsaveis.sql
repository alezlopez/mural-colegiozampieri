-- Login de responsáveis (código do aluno + telefone, código por WhatsApp)
-- e publicações segmentadas por turma.

-- ---------------------------------------------------------------------------
-- Alunos e responsáveis
-- Telefones em E.164 sem "+", como o Supabase Auth guarda: 55 + DDD + número.
-- ---------------------------------------------------------------------------
create table public.alunos (
  codigo     text primary key check (char_length(codigo) between 1 and 40),
  nome       text not null,
  turma      text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index alunos_turma_idx on public.alunos (turma) where ativo;

create trigger alunos_updated_at
  before update on public.alunos
  for each row execute function public.touch_updated_at();

create table public.aluno_responsaveis (
  aluno_codigo text not null references public.alunos (codigo) on delete cascade on update cascade,
  telefone     text not null check (telefone ~ '^55[1-9][0-9]{9,10}$'),
  nome         text,
  created_at   timestamptz not null default now(),
  primary key (aluno_codigo, telefone)
);

create index aluno_responsaveis_telefone_idx on public.aluno_responsaveis (telefone);

alter table public.alunos enable row level security;
alter table public.aluno_responsaveis enable row level security;

-- Telefone do usuário logado, lido de auth.users (não confia em dado vindo do cliente).
create or replace function public.meu_telefone()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone from auth.users where id = auth.uid();
$$;

revoke all on function public.meu_telefone() from public;
grant execute on function public.meu_telefone() to authenticated;

-- Turmas dos filhos ativos do responsável logado (vazio para visitante).
create or replace function public.minhas_turmas()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct a.turma), '{}')
  from public.aluno_responsaveis r
  join public.alunos a on a.codigo = r.aluno_codigo and a.ativo
  where auth.uid() is not null
    and r.telefone = (select phone from auth.users where id = auth.uid());
$$;

revoke all on function public.minhas_turmas() from public;
grant execute on function public.minhas_turmas() to anon, authenticated;

create policy "responsável vê os próprios filhos"
  on public.alunos for select
  to authenticated
  using (
    ativo and exists (
      select 1 from public.aluno_responsaveis r
      where r.aluno_codigo = codigo and r.telefone = public.meu_telefone()
    )
  );

create policy "responsável vê o próprio vínculo"
  on public.aluno_responsaveis for select
  to authenticated
  using (telefone = public.meu_telefone());

create policy "admin gerencia alunos"
  on public.alunos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin gerencia responsáveis"
  on public.aluno_responsaveis for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lista de turmas existentes, para o painel montar o seletor de público.
create or replace function public.turmas_ativas()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct turma from public.alunos where ativo and public.is_admin() order by turma;
$$;

revoke all on function public.turmas_ativas() from public;
grant execute on function public.turmas_ativas() to authenticated;

-- ---------------------------------------------------------------------------
-- Controle de tentativas de login (anti-enumeração de código + telefone)
-- ---------------------------------------------------------------------------
create table public.login_tentativas (
  id         bigint generated always as identity primary key,
  telefone   text not null,
  ip         text,
  sucesso    boolean not null,
  created_at timestamptz not null default now()
);

create index login_tentativas_telefone_idx on public.login_tentativas (telefone, created_at desc);
create index login_tentativas_ip_idx on public.login_tentativas (ip, created_at desc);

alter table public.login_tentativas enable row level security;

-- ---------------------------------------------------------------------------
-- Publicações por turma: turmas = null → todos (público); senão só as famílias dessas turmas.
-- ---------------------------------------------------------------------------
alter table public.posts add column turmas text[]
  check (turmas is null or cardinality(turmas) > 0);

create index posts_turmas_idx on public.posts using gin (turmas);

drop policy "público lê publicações publicadas" on public.posts;
create policy "lê publicações gerais ou da turma dos filhos"
  on public.posts for select
  to anon, authenticated
  using (
    status = 'publicado'
    and publicado_em <= now()
    and (turmas is null or turmas && public.minhas_turmas())
  );

drop policy "público lê imagens de publicações visíveis" on public.post_imagens;
create policy "lê imagens de publicações visíveis"
  on public.post_imagens for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.status = 'publicado'
        and p.publicado_em <= now()
        and (p.turmas is null or p.turmas && public.minhas_turmas())
    )
  );

-- ---------------------------------------------------------------------------
-- Push: o aparelho fica associado ao responsável enquanto ele estiver logado.
-- ---------------------------------------------------------------------------
alter table public.push_tokens
  add column user_id uuid references auth.users (id) on delete set null;

create index push_tokens_user_idx on public.push_tokens (user_id) where desativado_em is null;

-- Mesmo contrato de antes; agora grava quem está logado (ou limpa, se for visitante).
create or replace function public.registrar_push_token(p_token text, p_plataforma text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'token inválido' using errcode = '22023';
  end if;
  if p_plataforma not in ('ios', 'android') then
    raise exception 'plataforma inválida' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, plataforma, user_id)
  values (p_token, p_plataforma, auth.uid())
  on conflict (token) do update
    set ultimo_acesso = now(),
        plataforma    = excluded.plataforma,
        user_id       = excluded.user_id,
        desativado_em = null;
end;
$$;

-- Tokens que devem receber o push de uma publicação. Uso exclusivo do servidor (service_role).
create or replace function public.tokens_para_publicacao(p_turmas text[])
returns table (token text)
language sql
stable
security definer
set search_path = public
as $$
  select t.token
  from public.push_tokens t
  where t.desativado_em is null
    and (
      p_turmas is null
      or exists (
        select 1
        from auth.users u
        join public.aluno_responsaveis r on r.telefone = u.phone
        join public.alunos a on a.codigo = r.aluno_codigo and a.ativo
        where u.id = t.user_id and a.turma = any (p_turmas)
      )
    );
$$;

revoke all on function public.tokens_para_publicacao(text[]) from public, anon, authenticated;
grant execute on function public.tokens_para_publicacao(text[]) to service_role;
