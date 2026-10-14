"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirArea } from "@/lib/auth";

/** Visto da coordenação no planejamento (com comentário opcional, que o professor vê). */
export async function darVisto(formData: FormData) {
  const { supabase, userId } = await exigirArea("acompanhamento", "editar");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/planejamentos");
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 4000) || null;
  const retirar = formData.get("acao") === "retirar";
  const { error } = await supabase
    .from("planejamentos")
    .update(retirar ? { visto_em: null, visto_por: null, comentario_coordenacao: comentario } : { visto_em: new Date().toISOString(), visto_por: userId, comentario_coordenacao: comentario })
    .eq("id", id);
  revalidatePath("/planejamentos");
  const msg = error ? "Não foi possível salvar." : retirar ? "Visto retirado." : "Visto registrado.";
  redirect(`/planejamentos/${id}?${error ? "erro" : "salvo"}=${encodeURIComponent(msg)}`);
}
