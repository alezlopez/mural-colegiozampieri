import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { alcanca, permissoesDe, type Area, type Nivel, type Perfil } from "./permissoes";
import { criarClienteServidor } from "./supabase/server";

/**
 * Garante que quem está logado é da equipe (direção, coordenação ou secretaria); caso contrário, volta ao login.
 * Uma consulta por requisição (cache), mesmo chamada pelo layout e pela página.
 */
export const exigirAdmin = cache(async () => {
  const ctx = await carregarEquipe();
  // Primeiro acesso de quem a direção cadastrou em Equipe: troca a senha provisória antes de usar o painel.
  if (ctx.trocarSenha) redirect("/senha");
  return ctx;
});

/** Mesma checagem, sem exigir a troca da senha provisória (usada pela própria tela /senha). */
export async function carregarEquipe() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const trocarSenha = Boolean((data?.claims?.user_metadata as { trocar_senha?: boolean } | undefined)?.trocar_senha);

  const { data: admin } = await supabase.from("admins").select("nome,perfil").eq("user_id", userId).maybeSingle();
  if (!admin) {
    // Professor que caiu no painel administrativo vai para a área dele.
    if (await professorDoUsuario(supabase, userId)) redirect("/professor");
    redirect("/login?erro=sem-permissao");
  }

  const perfil = (admin.perfil ?? "direcao") as Perfil;
  const { data: linhas } = perfil === "direcao" ? { data: [] } : await supabase.from("perfil_permissoes").select("area,nivel").eq("perfil", perfil);
  return { supabase, userId, trocarSenha, nome: admin.nome as string, perfil, permissoes: permissoesDe(perfil, linhas ?? []) };
}

/**
 * Exige o perfil com acesso à área: "ver" nas páginas, "editar" nas ações que gravam.
 * Sem acesso, vai para /sem-permissao (o painel mostra só o que o perfil pode).
 */
export async function exigirArea(area: Area, nivel: Exclude<Nivel, "nenhum"> = "ver") {
  const ctx = await exigirAdmin();
  if (!alcanca(ctx.permissoes[area], nivel)) redirect(`/sem-permissao?area=${area}&nivel=${nivel}`);
  return { ...ctx, podeEditar: alcanca(ctx.permissoes[area], "editar") };
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
