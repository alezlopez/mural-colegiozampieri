import { createBrowserClient } from "@supabase/ssr";
import type { ConfigSupabase } from "../config";

// URL e chave chegam do servidor por props (lidas em tempo de execução), não do build.
export function criarClienteNavegador({ url, anonKey }: ConfigSupabase) {
  return createBrowserClient(url, anonKey);
}
