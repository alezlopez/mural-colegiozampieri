"use server";

import { redirect } from "next/navigation";
import { exigirProfessor } from "@/lib/auth";

export type EstadoSenha = { erro?: string };

export async function trocarSenha(_: EstadoSenha, formData: FormData): Promise<EstadoSenha> {
  const { supabase } = await exigirProfessor({ permitirTrocaPendente: true });
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "As duas senhas não são iguais." };

  const { error } = await supabase.auth.updateUser({ password: senha, data: { trocar_senha: false } });
  if (error) {
    return { erro: error.code === "same_password" ? "Escolha uma senha diferente da provisória." : "Não foi possível salvar a senha." };
  }
  // Renova a sessão para o cookie já refletir trocar_senha = false.
  await supabase.auth.refreshSession();
  redirect("/professor");
}
