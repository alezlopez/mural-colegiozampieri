"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { MOTIVOS_RECUSA_FOTO } from "@/lib/fotos";
import { enviarPushParaUsuario } from "@/lib/push";

export async function revisarFoto(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  const aprovar = formData.get("acao") === "aprovar";
  const motivoBruto = String(formData.get("motivo") ?? "");
  const motivo = MOTIVOS_RECUSA_FOTO.includes(motivoBruto) ? motivoBruto : null;
  if (!/^[0-9a-f-]{36}$/.test(id)) return;

  const { data, error } = await supabase.rpc("revisar_foto_aluno", { p_id: id, p_aprovar: aprovar, p_motivo: motivo });
  if (error) {
    console.error("[fotos] revisão", error);
    return;
  }

  // Avisa quem enviou; falha no push não desfaz a revisão.
  const foto = data as { aluno_codigo: string; enviado_por: string | null };
  if (foto.enviado_por) {
    const { data: aluno } = await supabase.from("alunos").select("nome").eq("codigo", foto.aluno_codigo).maybeSingle();
    const primeiroNome = (aluno?.nome ?? "do aluno").split(" ")[0];
    await enviarPushParaUsuario(
      foto.enviado_por,
      aprovar ? "Foto aprovada" : "Foto não aprovada",
      aprovar
        ? `A foto de ${primeiroNome} já aparece na carteirinha.`
        : `A foto de ${primeiroNome} não foi aprovada${motivo ? `: ${motivo.toLowerCase()}` : ""}. Envie outra pelo app.`,
      `/carteirinha/${foto.aluno_codigo}`,
    ).catch((e) => console.error("[fotos] push", e));
  }

  revalidatePath("/fotos");
  revalidatePath("/", "layout");
}
