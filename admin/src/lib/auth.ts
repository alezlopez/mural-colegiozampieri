import "server-only";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "./supabase/server";

/** Garante que quem está logado é administrador; caso contrário, volta ao login. */
export async function exigirAdmin() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: admin } = await supabase.from("admins").select("nome").eq("user_id", userId).maybeSingle();
  if (!admin) redirect("/login?erro=sem-permissao");

  return { supabase, userId, nome: admin.nome as string };
}
