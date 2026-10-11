-- Turma de conclusão (última série oferecida pela escola): quem está nela e não volta no ano seguinte se formou,
-- não evadiu. Usado no relatório de rematrícula. Editável na tela da turma.
alter table public.turmas add column if not exists ultima_serie boolean not null default false;

update public.turmas set ultima_serie = true
where segmento = 'medio' and (serie ilike 'terceiro%' or nome ~* '3[ºª°o]? *(ano|s[ée]rie)');
