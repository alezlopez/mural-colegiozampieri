-- Sábado letivo segue o horário de um dia da semana (1 = segunda … 5 = sexta). Sem isso, não há como saber
-- quais aulas acontecem no sábado (o professor escolhe a turma manualmente).
alter table public.calendario_eventos
  add column if not exists segue_dia_semana int check (segue_dia_semana between 1 and 5);
