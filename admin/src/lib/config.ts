// Configuração do Supabase lida em TEMPO DE EXECUÇÃO (não no build).
// O Next.js embute no código, durante o build, qualquer `process.env.NEXT_PUBLIC_*` escrito
// literalmente; o Easypanel não repassa variáveis para o build com Dockerfile. Ler por nome
// dinâmico evita isso: a mesma imagem funciona com as variáveis definidas só no container.
function lerEnv(...nomes: string[]) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor) return valor;
  }
  throw new Error(`Variável de ambiente ausente: ${nomes.join(" ou ")}`);
}

export type ConfigSupabase = { url: string; anonKey: string };

/** URL e chave anon (públicas por natureza). Aceita SUPABASE_* ou NEXT_PUBLIC_SUPABASE_*. */
export function configSupabase(): ConfigSupabase {
  return {
    url: lerEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: lerEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
