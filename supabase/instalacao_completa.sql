-- =====================================================================
-- Mural Colégio Zampieri — instalação completa do banco (projeto Supabase novo)
-- Cole tudo no SQL Editor do Supabase (Ctrl+A antes de Run: com texto selecionado o editor
-- executa só a seleção) e execute uma única vez. Roda numa transação: se der erro, nada fica pela metade.
-- Gerado a partir de supabase/migrations/ (mesmo conteúdo, na mesma ordem).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 20260930000000_mural_inicial.sql
-- ---------------------------------------------------------------------
-- Mural Colégio Zampieri — esquema inicial
-- Leitura pública (app sem login), escrita restrita a administradores.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;

create policy "admin vê o próprio registro"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Publicações
-- ---------------------------------------------------------------------------
create type public.post_categoria as enum ('comunicado', 'aviso', 'lembrete', 'evento', 'galeria');
create type public.post_status as enum ('rascunho', 'publicado');

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  categoria     public.post_categoria not null,
  titulo        text not null check (char_length(titulo) between 1 and 160),
  corpo         text not null default '' check (char_length(corpo) <= 10000),
  data_evento   timestamptz,
  fixado        boolean not null default false,
  status        public.post_status not null default 'rascunho',
  publicado_em  timestamptz,
  push_enviado_em timestamptz,
  push_dispositivos integer,
  autor_id      uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint publicado_tem_data check (status = 'rascunho' or publicado_em is not null)
);

create index posts_feed_idx on public.posts (fixado desc, publicado_em desc) where status = 'publicado';
create index posts_categoria_idx on public.posts (categoria, publicado_em desc) where status = 'publicado';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

create table public.post_imagens (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  largura      integer,
  altura       integer,
  posicao      integer not null default 0,
  created_at   timestamptz not null default now()
);

create index post_imagens_post_idx on public.post_imagens (post_id, posicao);

alter table public.posts enable row level security;
alter table public.post_imagens enable row level security;

create policy "público lê publicações publicadas"
  on public.posts for select
  to anon, authenticated
  using (status = 'publicado' and publicado_em <= now());

create policy "admin lê tudo"
  on public.posts for select
  to authenticated
  using (public.is_admin());

create policy "admin cria"
  on public.posts for insert
  to authenticated
  with check (public.is_admin());

create policy "admin edita"
  on public.posts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin exclui"
  on public.posts for delete
  to authenticated
  using (public.is_admin());

create policy "público lê imagens de publicações visíveis"
  on public.post_imagens for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'publicado' and p.publicado_em <= now()
    )
  );

create policy "admin gerencia imagens"
  on public.post_imagens for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Dispositivos para push (sem login: o app registra o token anonimamente)
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token          text primary key,
  plataforma     text not null check (plataforma in ('ios', 'android')),
  created_at     timestamptz not null default now(),
  ultimo_acesso  timestamptz not null default now(),
  desativado_em  timestamptz
);

-- RLS ligado e sem políticas: ninguém lê/escreve direto pela API pública.
-- O app só registra via função abaixo; o painel lê com a service role.
alter table public.push_tokens enable row level security;

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

  insert into public.push_tokens (token, plataforma)
  values (p_token, p_plataforma)
  on conflict (token) do update
    set ultimo_acesso = now(),
        plataforma    = excluded.plataforma,
        desativado_em = null;
end;
$$;

revoke all on function public.registrar_push_token(text, text) from public;
grant execute on function public.registrar_push_token(text, text) to anon, authenticated;

-- Tickets do Expo Push aguardando verificação de recibo (ver /api/cron/push-recibos no painel)
create table public.push_tickets (
  ticket_id  text primary key,
  token      text not null references public.push_tokens (token) on delete cascade,
  post_id    uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index push_tickets_created_idx on public.push_tickets (created_at);

alter table public.push_tickets enable row level security;

-- ---------------------------------------------------------------------------
-- Storage: fotos das publicações (leitura pública, escrita só admin)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-imagens', 'post-imagens', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admin envia fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-imagens' and public.is_admin());

create policy "admin atualiza fotos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'post-imagens' and public.is_admin());

create policy "admin remove fotos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-imagens' and public.is_admin());

-- ---------------------------------------------------------------------
-- 20261005000000_login_responsaveis.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 20261009000000_cpf_responsavel.sql
-- ---------------------------------------------------------------------
-- Login também pelo CPF do responsável financeiro (além do código do aluno).
-- Só dígitos; a validação dos dígitos verificadores acontece no n8n e no painel.
alter table public.aluno_responsaveis
  add column if not exists cpf text check (cpf ~ '^[0-9]{11}$');

create index if not exists aluno_responsaveis_cpf_idx on public.aluno_responsaveis (cpf);

-- ---------------------------------------------------------------------
-- 20261010000000_carteirinha.sql
-- ---------------------------------------------------------------------
-- Carteirinha digital do aluno: QR assinado que muda a cada 30 segundos.
-- O app pede o código (só o responsável do aluno consegue); quem escaneia abre a página
-- de validação do painel, que confere a assinatura aqui no banco e registra a leitura.
-- Formato do código: <tipo>.<referência>.<janela de 30 s>.<assinatura>
--   tipo "a" = aluno (o tipo "c", assinante do Clube, entra depois com a mesma estrutura).

-- Segredos internos: sem nenhuma política, só funções security definer leem.
create table if not exists public.segredos (
  nome  text primary key,
  valor text not null
);
alter table public.segredos enable row level security;

insert into public.segredos (nome, valor)
-- gen_random_uuid() e sha256() são do próprio Postgres: não dependem de onde o pgcrypto foi instalado.
values ('carteirinha', encode(sha256((gen_random_uuid()::text || gen_random_uuid()::text)::bytea), 'hex'))
on conflict (nome) do nothing;

create table if not exists public.carteirinha_validacoes (
  id          bigint generated always as identity primary key,
  tipo        text not null,
  referencia  text,
  valido      boolean not null,
  motivo      text,
  validado_em timestamptz not null default now()
);
alter table public.carteirinha_validacoes enable row level security;

create index if not exists carteirinha_validacoes_ref_idx
  on public.carteirinha_validacoes (tipo, referencia, validado_em desc);

drop policy if exists "admin lê validações de carteirinha" on public.carteirinha_validacoes;
create policy "admin lê validações de carteirinha"
  on public.carteirinha_validacoes for select
  to authenticated
  using (public.is_admin());

create or replace function public.carteirinha_assinatura(p_conteudo text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select left(encode(hmac(p_conteudo, (select valor from public.segredos where nome = 'carteirinha'), 'sha256'), 'hex'), 24);
$$;

revoke all on function public.carteirinha_assinatura(text) from public, anon, authenticated;

-- Código atual da carteirinha de um aluno. Só o responsável (telefone vinculado) de aluno ativo recebe.
create or replace function public.carteirinha_aluno_token(p_aluno text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  janela bigint := floor(extract(epoch from now()) / 30);
  conteudo text;
begin
  if not exists (
    select 1
    from public.aluno_responsaveis r
    join public.alunos a on a.codigo = r.aluno_codigo and a.ativo
    where r.aluno_codigo = p_aluno and r.telefone = public.meu_telefone()
  ) then
    raise exception 'Carteirinha indisponível para este aluno.' using errcode = '42501';
  end if;
  conteudo := 'a.' || p_aluno || '.' || janela;
  return conteudo || '.' || public.carteirinha_assinatura(conteudo);
end;
$$;

revoke all on function public.carteirinha_aluno_token(text) from public, anon;
grant execute on function public.carteirinha_aluno_token(text) to authenticated;

-- Confere um código lido e registra a leitura. Aceita a janela atual e a anterior (até ~60 s).
-- Chamada só pelo painel (service role).
create or replace function public.validar_carteirinha(p_token text)
returns table (valido boolean, motivo text, nome text, turma text, codigo text, ano_letivo int)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  partes text[] := string_to_array(coalesce(p_token, ''), '.');
  agora bigint := floor(extract(epoch from now()) / 30);
  v_tipo text;
  v_ref text;
  v_janela bigint;
  v_aluno public.alunos%rowtype;
  v_motivo text;
begin
  if array_length(partes, 1) = 4 and partes[3] ~ '^[0-9]{1,12}$' then
    v_tipo := partes[1];
    v_ref := partes[2];
    v_janela := partes[3]::bigint;
  end if;

  if v_tipo is distinct from 'a' then
    v_motivo := 'invalido';
  elsif public.carteirinha_assinatura(v_tipo || '.' || v_ref || '.' || v_janela) <> partes[4] then
    v_motivo := 'invalido';
  elsif v_janela not in (agora, agora - 1) then
    v_motivo := 'expirado';
  else
    select * into v_aluno from public.alunos a where a.codigo = v_ref;
    if not found or not v_aluno.ativo then
      v_motivo := 'inativo';
    end if;
  end if;

  insert into public.carteirinha_validacoes (tipo, referencia, valido, motivo)
  values (coalesce(left(v_tipo, 10), '?'), case when v_motivo = 'invalido' then null else v_ref end,
          v_motivo is null, v_motivo);

  if v_motivo is null then
    return query select true, null::text, v_aluno.nome, v_aluno.turma, v_aluno.codigo,
                        extract(year from now())::int;
  else
    return query select false, v_motivo, null::text, null::text, null::text, null::int;
  end if;
end;
$$;

revoke all on function public.validar_carteirinha(text) from public, anon, authenticated;
grant execute on function public.validar_carteirinha(text) to service_role;

commit;
