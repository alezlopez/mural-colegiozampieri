-- Fase A do cadastro: dados pessoais e endereço do aluno, pais/responsáveis com dados completos.
-- Até a virada (Fase B), nome, turma e responsável financeiro do aluno continuam vindo da Mhund; estes campos são
-- do painel e a sincronização não os toca. Telefone e e-mail do aluno = os do responsável financeiro.

-- Dados pessoais ficam numa tabela à parte, só da equipe: o professor lê a linha de "alunos" dos alunos dele
-- (nome e turma) e não deve ver CPF, RG nem endereço.
create table if not exists public.aluno_dados (
  aluno_codigo text primary key references public.alunos (codigo) on update cascade on delete cascade,
  nome_social text,
  nascimento date,
  naturalidade text,
  nacionalidade text not null default 'Brasileira',
  cpf text unique check (cpf is null or cpf ~ '^[0-9]{11}$'),
  rg text,
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  atualizado_em timestamptz not null default now()
);
alter table public.aluno_dados enable row level security;
create policy "equipe gerencia dados dos alunos" on public.aluno_dados for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pessoa (pai, mãe ou outro responsável), cadastrada uma vez e ligada a cada filho (irmãos compartilham).
create table if not exists public.responsaveis (
  id bigint generated always as identity primary key,
  cpf text unique check (cpf is null or cpf ~ '^[0-9]{11}$'),
  rg text,
  nome text not null check (length(btrim(nome)) >= 3),
  nome_social text,
  nascimento date,
  naturalidade text,
  nacionalidade text not null default 'Brasileira',
  estado_civil text check (estado_civil is null or estado_civil in ('solteiro', 'casado', 'uniao_estavel', 'divorciado', 'separado', 'viuvo')),
  -- 55 + DDD + número, só dígitos (mesmo formato do login do app e da API do WhatsApp).
  celular text check (celular is null or celular ~ '^55[1-9][0-9]{9,10}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.aluno_vinculos (
  aluno_codigo text not null references public.alunos (codigo) on update cascade on delete cascade,
  responsavel_id bigint not null references public.responsaveis (id) on delete cascade,
  parentesco text not null check (parentesco in ('pai', 'mae', 'outro')),
  parentesco_descricao text,
  financeiro boolean not null default false,
  -- LDB art. 12, VII: a escola informa pai e mãe, convivendo ou não com o aluno. Desligar só com ordem judicial.
  acesso_app boolean not null default true,
  primary key (aluno_codigo, responsavel_id)
);
create index if not exists aluno_vinculos_responsavel_idx on public.aluno_vinculos (responsavel_id);
create unique index if not exists aluno_vinculos_um_financeiro on public.aluno_vinculos (aluno_codigo) where financeiro;

alter table public.responsaveis enable row level security;
alter table public.aluno_vinculos enable row level security;
create policy "equipe gerencia responsáveis" on public.responsaveis for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe gerencia vínculos" on public.aluno_vinculos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Quem deu acesso ao app: a sincronização com a Mhund só mexe nos que ela criou.
alter table public.aluno_responsaveis add column if not exists origem text not null default 'mhund' check (origem in ('mhund', 'painel'));

-- Limpeza: uma primeira versão desta migração pôs esses campos em "alunos" (vazios, nunca usados).
alter table public.alunos
  drop column if exists nome_social, drop column if exists nascimento, drop column if exists naturalidade,
  drop column if exists nacionalidade, drop column if exists cpf, drop column if exists rg, drop column if exists cep,
  drop column if exists logradouro, drop column if exists numero, drop column if exists complemento,
  drop column if exists bairro, drop column if exists cidade, drop column if exists uf, drop column if exists cadastro_atualizado_em;
