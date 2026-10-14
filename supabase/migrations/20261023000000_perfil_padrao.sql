-- Quem for incluído em admins sem perfil (ex.: direto no SQL) entra com o menor acesso, não como direção.
-- A direção atual já tem perfil gravado; o painel sempre informa o perfil ao cadastrar.
alter table public.admins alter column perfil set default 'secretaria';
