import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role: ignora RLS. Usado apenas para ler/atualizar
 * push_tokens e push_tickets, que não têm nenhuma política pública.
 */
export function criarClienteServico() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
