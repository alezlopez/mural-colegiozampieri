"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServico } from "@/lib/supabase/servico";

export type EstadoAcesso = { professorId?: number; senha?: string; erro?: string };

// Sem caracteres que se confundem (0/O, 1/l/I) para ditar ou copiar sem erro.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function senhaProvisoria(tamanho = 10) {
  return Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}

/** Cria o login do professor (ou gera nova senha provisória, se já tiver). A senha aparece uma única vez. */
export async function gerarAcesso(_: EstadoAcesso, formData: FormData): Promise<EstadoAcesso> {
  await exigirAdmin();
  const professorId = Number(formData.get("professor_id"));
  if (!Number.isInteger(professorId)) return { erro: "Professor inválido." };

  const db = criarClienteServico();
  const { data: professor } = await db.from("professores").select("id,nome,email,user_id").eq("id", professorId).maybeSingle();
  if (!professor) return { professorId, erro: "Professor não encontrado." };
  if (!professor.email) return { professorId, erro: "Professor sem e-mail na Mhund. Cadastre o e-mail lá e sincronize." };

  const senha = senhaProvisoria();
  if (professor.user_id) {
    const { error } = await db.auth.admin.updateUserById(professor.user_id, {
      password: senha,
      user_metadata: { trocar_senha: true },
    });
    if (error) return { professorId, erro: `Não foi possível redefinir a senha: ${error.message}` };
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: professor.email,
      password: senha,
      email_confirm: true,
      user_metadata: { trocar_senha: true, nome: professor.nome },
    });
    if (error || !data.user) {
      const jaExiste = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
      return {
        professorId,
        erro: jaExiste
          ? "Já existe um usuário com esse e-mail (ex.: alguém da equipe). Use outro e-mail para o professor."
          : `Não foi possível criar o acesso: ${error?.message}`,
      };
    }
    const { error: erroVinculo } = await db.from("professores").update({ user_id: data.user.id }).eq("id", professorId);
    if (erroVinculo) return { professorId, erro: `Acesso criado, mas não vinculado: ${erroVinculo.message}` };
  }

  revalidatePath("/professores");
  return { professorId, senha };
}

export async function alternarAtivo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const professorId = Number(formData.get("professor_id"));
  const ativo = formData.get("ativo") === "true";
  if (!Number.isInteger(professorId)) return;
  await supabase.from("professores").update({ ativo }).eq("id", professorId);
  revalidatePath("/professores");
}
