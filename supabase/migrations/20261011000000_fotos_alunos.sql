-- Foto do aluno na carteirinha: o responsável envia pelo app, a secretaria aprova no painel.
-- Só a foto aprovada aparece na carteirinha e na página de validação.
-- Arquivos num bucket PRIVADO (foto de criança nunca fica em link público fixo).

-- O usuário logado é responsável (telefone vinculado) deste aluno ativo?
create or replace function public.eh_responsavel(p_aluno text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.aluno_responsaveis r
    join public.alunos a on a.codigo = r.aluno_codigo and a.ativo
    where r.aluno_codigo = p_aluno and r.telefone = public.meu_telefone()
  );
$$;

revoke all on function public.eh_responsavel(text) from public, anon;
grant execute on function public.eh_responsavel(text) to authenticated;

create table if not exists public.aluno_fotos (
  id            uuid primary key default gen_random_uuid(),
  aluno_codigo  text not null references public.alunos (codigo) on delete cascade on update cascade,
  caminho       text not null unique,
  status        text not null default 'pendente'
                check (status in ('pendente', 'aprovada', 'recusada', 'substituida')),
  motivo_recusa text,
  enviado_por   uuid references auth.users (id) on delete set null,
  enviado_em    timestamptz not null default now(),
  revisado_por  uuid references auth.users (id) on delete set null,
  revisado_em   timestamptz
);

-- No máximo uma foto aprovada por aluno.
create unique index if not exists aluno_fotos_uma_aprovada on public.aluno_fotos (aluno_codigo) where status = 'aprovada';
create index if not exists aluno_fotos_pendentes on public.aluno_fotos (enviado_em) where status = 'pendente';
create index if not exists aluno_fotos_aluno on public.aluno_fotos (aluno_codigo, enviado_em desc);

alter table public.aluno_fotos enable row level security;

drop policy if exists "responsável vê fotos do filho" on public.aluno_fotos;
create policy "responsável vê fotos do filho"
  on public.aluno_fotos for select
  to authenticated
  using (public.eh_responsavel(aluno_codigo) or public.is_admin());

-- Escrita só pelas funções abaixo (envio do responsável e revisão do admin).

-- Registra uma foto já enviada ao bucket. Uma nova pendente substitui a pendente anterior.
create or replace function public.registrar_foto_aluno(p_aluno text, p_caminho text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.eh_responsavel(p_aluno) then
    raise exception 'Envio de foto indisponível para este aluno.' using errcode = '42501';
  end if;
  if split_part(p_caminho, '/', 1) <> p_aluno
     or p_caminho !~ '^[^/]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' then
    raise exception 'Caminho de foto inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'fotos-alunos' and o.name = p_caminho) then
    raise exception 'Arquivo da foto não encontrado.' using errcode = '22023';
  end if;
  if (select count(*) from public.aluno_fotos f
      where f.aluno_codigo = p_aluno and f.enviado_em > now() - interval '1 day') >= 5 then
    raise exception 'Limite de envios atingido. Tente novamente amanhã.' using errcode = '54000';
  end if;

  update public.aluno_fotos set status = 'substituida'
  where aluno_codigo = p_aluno and status = 'pendente';

  insert into public.aluno_fotos (aluno_codigo, caminho, enviado_por)
  values (p_aluno, p_caminho, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_foto_aluno(text, text) from public, anon;
grant execute on function public.registrar_foto_aluno(text, text) to authenticated;

-- Aprova ou recusa uma foto pendente (só admin). Aprovar substitui a aprovada anterior.
create or replace function public.revisar_foto_aluno(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns public.aluno_fotos
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_foto public.aluno_fotos;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores revisam fotos.' using errcode = '42501';
  end if;
  select * into v_foto from public.aluno_fotos where id = p_id and status = 'pendente' for update;
  if not found then
    raise exception 'Foto não está mais pendente.' using errcode = '22023';
  end if;

  if p_aprovar then
    update public.aluno_fotos set status = 'substituida'
    where aluno_codigo = v_foto.aluno_codigo and status = 'aprovada';
  end if;

  update public.aluno_fotos
  set status = case when p_aprovar then 'aprovada' else 'recusada' end,
      motivo_recusa = case when p_aprovar then null else left(nullif(trim(p_motivo), ''), 200) end,
      revisado_por = auth.uid(),
      revisado_em = now()
  where id = p_id
  returning * into v_foto;
  return v_foto;
end;
$$;

revoke all on function public.revisar_foto_aluno(uuid, boolean, text) from public, anon;
grant execute on function public.revisar_foto_aluno(uuid, boolean, text) to authenticated;

-- Bucket privado: JPEG até 2 MB (o app já envia a foto reduzida).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-alunos', 'fotos-alunos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "responsável envia foto do filho" on storage.objects;
create policy "responsável envia foto do filho"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos-alunos' and public.eh_responsavel((storage.foldername(name))[1]));

drop policy if exists "responsável e admin veem fotos de alunos" on storage.objects;
create policy "responsável e admin veem fotos de alunos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos-alunos' and (public.is_admin() or public.eh_responsavel((storage.foldername(name))[1])));

drop policy if exists "admin remove fotos de alunos" on storage.objects;
create policy "admin remove fotos de alunos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-alunos' and public.is_admin());
