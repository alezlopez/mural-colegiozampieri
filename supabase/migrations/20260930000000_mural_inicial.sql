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
