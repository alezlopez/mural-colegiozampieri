-- Importação do cadastro da Mhund: liga cada responsável ao id dele lá (idDoResponsavel), para completar sem duplicar.
alter table public.responsaveis add column if not exists mhund_id bigint unique;
