"use server";

import { redirect } from "next/navigation";
import { destinoAposLogin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string; email?: string };

export async function entrar(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha.", email };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) return { erro: "E-mail ou senha incorretos.", email };

  const destino = await destinoAposLogin(supabase, data.user.id);
  if (!destino) {
    await supabase.auth.signOut();
    return { erro: "Sua conta não tem acesso ao painel. Procure a secretaria.", email };
  }
  redirect(destino);
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
