"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirArea } from "@/lib/auth";
import { AREAS, PERFIS, type Area, type Perfil } from "@/lib/permissoes";
import { criarClienteServico } from "@/lib/supabase/servico";

export type EstadoMembro = { userId?: string; email?: string; senha?: string; erro?: string };

// Sem caracteres que se confundem (0/O, 1/l/I) para ditar ou copiar sem erro.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const senhaProvisoria = (tamanho = 10) => Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const ehPerfil = (v: unknown): v is Perfil => typeof v === "string" && v in PERFIS;
const BLOQUEIO = "876000h"; // ~100 anos: acesso removido sem apagar o usuário (o histórico de autoria fica)

function voltar(chave: "salvo" | "erro", msg: string): never {
  redirect(`/equipe?${chave}=${encodeURIComponent(msg)}`);
}

/** Procura um usuário já existente pelo e-mail (ex.: professor que também é da coordenação, ou alguém removido antes). */
async function usuarioPorEmail(db: SupabaseClient, email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const achado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ehProfessor(db: SupabaseClient, userId: string) {
  const { count } = await db.from("professores").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("ativo", true);
  return Boolean(count);
}

async function totalDirecao(db: SupabaseClient) {
  const { count } = await db.from("admins").select("user_id", { count: "exact", head: true }).eq("perfil", "direcao");
  return count ?? 0;
}

/**
 * Cadastra alguém da equipe. Usuário novo recebe senha provisória (mostrada uma vez) e troca no primeiro acesso.
 * Se o e-mail já tem login (professor ou alguém removido antes), reaproveita: professor mantém a senha dele.
 */
export async function adicionarMembro(_: EstadoMembro, formData: FormData): Promise<EstadoMembro> {
  await exigirArea("equipe", "editar");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const perfil = formData.get("perfil");
  if (!nome) return { erro: "Informe o nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "E-mail inválido." };
  if (!ehPerfil(perfil)) return { erro: "Escolha o perfil." };

  const db = criarClienteServico();
  const existente = await usuarioPorEmail(db, email);
  let userId: string;
  let senha: string | undefined;

  if (existente) {
    const { data: jaEquipe } = await db.from("admins").select("user_id").eq("user_id", existente.id).maybeSingle();
    if (jaEquipe) return { erro: "Esse e-mail já é da equipe. Mude o perfil na lista abaixo." };
    userId = existente.id;
    if (await ehProfessor(db, userId)) {
      // Professor que passa a ter acesso ao painel: entra com a mesma senha do diário.
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) return { erro: `Não foi possível liberar o acesso: ${error.message}` };
    } else {
      senha = senhaProvisoria();
      const { error } = await db.auth.admin.updateUserById(userId, {
        password: senha,
        ban_duration: "none",
        user_metadata: { trocar_senha: true, nome },
      });
      if (error) return { erro: `Não foi possível liberar o acesso: ${error.message}` };
    }
  } else {
    senha = senhaProvisoria();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { trocar_senha: true, nome },
    });
    if (error || !data.user) return { erro: `Não foi possível criar o acesso: ${error?.message}` };
    userId = data.user.id;
  }

  const { error } = await db.from("admins").insert({ user_id: userId, nome, perfil });
  if (error) return { erro: `Acesso criado, mas não foi possível incluir na equipe: ${error.message}` };

  revalidatePath("/equipe");
  return { userId, email, senha };
}

/** Gera nova senha provisória para alguém da equipe que esqueceu a dele. */
export async function novaSenhaMembro(_: EstadoMembro, formData: FormData): Promise<EstadoMembro> {
  const { userId: eu } = await exigirArea("equipe", "editar");
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { erro: "Usuário inválido." };
  if (userId === eu) return { userId, erro: "Para a sua própria senha, peça a outra pessoa da direção." };

  const db = criarClienteServico();
  const { data: membro } = await db.from("admins").select("nome").eq("user_id", userId).maybeSingle();
  if (!membro) return { userId, erro: "Não é da equipe." };
  if (await ehProfessor(db, userId)) return { userId, erro: "É professor: gere a senha em Professores (vale para o diário e o painel)." };

  const senha = senhaProvisoria();
  const { error } = await db.auth.admin.updateUserById(userId, { password: senha, user_metadata: { trocar_senha: true } });
  if (error) return { userId, erro: `Não foi possível gerar a senha: ${error.message}` };
  return { userId, senha };
}

export async function mudarPerfil(formData: FormData) {
  const { userId: eu } = await exigirArea("equipe", "editar");
  const userId = String(formData.get("user_id") ?? "");
  const perfil = formData.get("perfil");
  if (!userId || !ehPerfil(perfil)) voltar("erro", "Dados inválidos.");

  const db = criarClienteServico();
  const { data: atual } = await db.from("admins").select("nome,perfil").eq("user_id", userId).maybeSingle();
  if (!atual) voltar("erro", "Não é da equipe.");
  if (atual.perfil === perfil) voltar("salvo", "Nada mudou.");
  if (atual.perfil === "direcao" && (await totalDirecao(db)) <= 1) voltar("erro", "É a única pessoa da direção: cadastre outra antes de mudar este perfil.");

  const { error } = await db.from("admins").update({ perfil }).eq("user_id", userId);
  if (error) voltar("erro", "Não foi possível mudar o perfil.");
  revalidatePath("/", "layout");
  if (userId === eu) redirect("/"); // perdeu a Equipe; volta ao início do novo perfil
  voltar("salvo", `${atual.nome} agora é ${PERFIS[perfil]}.`);
}

/** Tira do painel. Quem também é professor continua com o diário; os demais têm o login bloqueado (não apagado). */
export async function removerMembro(formData: FormData) {
  const { userId: eu } = await exigirArea("equipe", "editar");
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) voltar("erro", "Usuário inválido.");
  if (userId === eu) voltar("erro", "Você não pode remover o seu próprio acesso.");

  const db = criarClienteServico();
  const { data: atual } = await db.from("admins").select("nome,perfil").eq("user_id", userId).maybeSingle();
  if (!atual) voltar("erro", "Não é da equipe.");
  if (atual.perfil === "direcao" && (await totalDirecao(db)) <= 1) voltar("erro", "É a única pessoa da direção.");

  const { error } = await db.from("admins").delete().eq("user_id", userId);
  if (error) voltar("erro", "Não foi possível remover.");
  const professor = await ehProfessor(db, userId);
  if (!professor) await db.auth.admin.updateUserById(userId, { ban_duration: BLOQUEIO });

  revalidatePath("/equipe");
  voltar("salvo", `${atual.nome} saiu da equipe${professor ? " (continua com o acesso de professor)" : " e o login foi bloqueado"}.`);
}

/** Matriz de permissões de coordenação e secretaria por área. */
export async function salvarPermissoes(formData: FormData) {
  await exigirArea("equipe", "editar");
  const linhas = (["coordenacao", "secretaria"] as const).flatMap((perfil) =>
    (Object.keys(AREAS) as Area[])
      .filter((a) => a !== "equipe")
      .map((area) => {
        const v = String(formData.get(`${perfil}:${area}`) ?? "nenhum");
        return { perfil, area, nivel: v === "ver" || v === "editar" ? v : "nenhum" };
      }),
  );
  const { error } = await criarClienteServico().from("perfil_permissoes").upsert(linhas, { onConflict: "perfil,area" });
  if (error) voltar("erro", "Não foi possível salvar as permissões.");
  revalidatePath("/", "layout");
  voltar("salvo", "Permissões salvas. Valem a partir da próxima tela que cada pessoa abrir.");
}
