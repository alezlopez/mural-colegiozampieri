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
  if (!admin) {
    // Professor que caiu no painel administrativo vai para a área dele.
    if (await professorDoUsuario(supabase, userId)) redirect("/professor");
    redirect("/login?erro=sem-permissao");
  }

  return { supabase, userId, nome: admin.nome as string };
}

type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;

async function professorDoUsuario(supabase: ClienteSupabase, userId: string) {
  const { data } = await supabase
    .from("professores")
    .select("id,nome")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  return data as { id: number; nome: string } | null;
}

/** Garante que quem está logado é professor ativo. Primeiro acesso: obriga a trocar a senha provisória. */
export async function exigirProfessor({ permitirTrocaPendente = false } = {}) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (!userId) redirect("/login");

  const professor = await professorDoUsuario(supabase, userId);
  if (!professor) redirect("/login?erro=sem-permissao");

  const metadados = (claims?.user_metadata ?? {}) as { trocar_senha?: boolean };
  if (metadados.trocar_senha && !permitirTrocaPendente) redirect("/professor/senha");

  return { supabase, userId, professor };
}

/** Para onde mandar o usuário logo após o login. */
export async function destinoAposLogin(supabase: ClienteSupabase, userId: string) {
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (admin) return "/";
  if (await professorDoUsuario(supabase, userId)) return "/professor";
  return null;
}
