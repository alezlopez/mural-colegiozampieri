-- Remove tudo o que instalacao_completa.sql cria, para reinstalar do zero.
-- ATENÇÃO: apaga publicações, alunos, responsáveis e aparelhos cadastrados. Use só em projeto novo
-- ou após uma instalação que falhou pela metade.
begin;

drop policy if exists "admin envia fotos" on storage.objects;
drop policy if exists "admin atualiza fotos" on storage.objects;
drop policy if exists "admin remove fotos" on storage.objects;
-- O bucket post-imagens fica: o Supabase bloqueia apagar buckets por SQL e a instalação o reaproveita.

drop table if exists
  public.push_tickets, public.push_tokens, public.post_imagens, public.posts,
  public.login_tentativas, public.aluno_responsaveis, public.alunos, public.admins
  cascade;

drop function if exists
  public.is_admin(), public.touch_updated_at(), public.registrar_push_token(text, text),
  public.meu_telefone(), public.minhas_turmas(), public.turmas_ativas(),
  public.tokens_para_publicacao(text[])
  cascade;

drop type if exists public.post_categoria, public.post_status cascade;

commit;
