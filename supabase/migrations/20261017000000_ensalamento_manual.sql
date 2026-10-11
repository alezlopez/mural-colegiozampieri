-- Ensalamento manual: a secretaria coloca, troca e retira alunos das turmas no painel.
-- Aluno com matrícula editada no painel num ano não tem a enturmação desse ano alterada pela sincronização.
alter table public.matriculas add column if not exists editado_no_painel boolean not null default false;
