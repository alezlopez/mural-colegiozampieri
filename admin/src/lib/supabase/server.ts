import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "../config";

/** Cliente Supabase com a sessão do administrador logado (respeita RLS). */
export async function criarClienteServidor() {
  const cookieStore = await cookies();
  const { url, anonKey } = configSupabase();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component: o proxy.ts já renova a sessão.
          }
        },
      },
    },
  );
}
