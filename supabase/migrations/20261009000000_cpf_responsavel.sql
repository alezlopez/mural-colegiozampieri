-- Login também pelo CPF do responsável financeiro (além do código do aluno).
-- Só dígitos; a validação dos dígitos verificadores acontece no n8n e no painel.
alter table public.aluno_responsaveis
  add column if not exists cpf text check (cpf ~ '^[0-9]{11}$');

create index if not exists aluno_responsaveis_cpf_idx on public.aluno_responsaveis (cpf);
