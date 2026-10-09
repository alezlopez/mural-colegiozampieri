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
-- Além da RLS sem políticas, tira o acesso padrão que o Supabase dá às tabelas novas.
revoke all on table public.segredos from anon, authenticated;

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
