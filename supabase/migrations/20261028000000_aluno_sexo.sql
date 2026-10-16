-- Sexo do aluno (Censo Escolar/INEP), vindo do CSV da Mhund ou digitado no cadastro.
alter table public.aluno_dados add column if not exists sexo text check (sexo is null or sexo in ('M', 'F'));
