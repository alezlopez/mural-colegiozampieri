"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";

const SEGMENTOS = new Set(["infantil", "fundamental1", "fundamental2", "medio"]);

function voltar(ano: number, chave: "salvo" | "erro", msg: string, ancora = ""): never {
  redirect(`/matriz?ano=${ano}&${chave}=${encodeURIComponent(msg)}${ancora ? `#${ancora}` : ""}`);
}

/**
 * Salva a matriz de uma série e aplica às turmas ativas dela: cria as disciplinas que faltam (sem professor) e,
 * se marcado, retira as que não estão na matriz — menos as que já têm aula lançada (o histórico não se perde).
 */
export async function salvarMatriz(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const ano = Number(formData.get("ano"));
  const segmento = String(formData.get("segmento") ?? "");
  const serie = String(formData.get("serie") ?? "").trim();
  const ancora = String(formData.get("ancora") ?? "");
  if (!Number.isInteger(ano) || !SEGMENTOS.has(segmento) || !serie) redirect("/matriz");

  const linhas = formData
    .getAll("disciplina")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d > 0)
    .map((d) => {
      const aulas = Number(formData.get(`aulas_${d}`));
      return { ano, segmento, serie, disciplina_id: d, aulas_semanais: Number.isInteger(aulas) && aulas >= 1 && aulas <= 20 ? aulas : null };
    });
  const escolhidas = new Set(linhas.map((l) => l.disciplina_id));

  // Matriz: grava as marcadas e apaga as desmarcadas.
  if (linhas.length > 0) {
    const { error } = await supabase.from("matriz_curricular").upsert(linhas, { onConflict: "ano,segmento,serie,disciplina_id" });
    if (error) {
      console.error("[matriz] salvar", error);
      voltar(ano, "erro", "Não foi possível salvar a matriz.", ancora);
    }
  }
  const { data: antigas } = await supabase
    .from("matriz_curricular")
    .select("disciplina_id")
    .eq("ano", ano)
    .eq("segmento", segmento)
    .eq("serie", serie);
  for (const a of antigas ?? []) {
    if (escolhidas.has(a.disciplina_id as number)) continue;
    await supabase.from("matriz_curricular").delete().eq("ano", ano).eq("segmento", segmento).eq("serie", serie).eq("disciplina_id", a.disciplina_id);
  }

  // Aplica às turmas da série.
  const { data: turmas } = await supabase.from("turmas").select("id").eq("ano", ano).eq("segmento", segmento).eq("serie", serie).eq("ativa", true);
  const ids = (turmas ?? []).map((t) => t.id as number);
  const retirarExtras = formData.get("retirar_extras") === "on";
  let incluidas = 0;
  let retiradas = 0;
  let mantidasComAula = 0;

  if (ids.length > 0) {
    const { data: atuais } = await supabase.from("turma_disciplinas").select("turma_id,disciplina_id").in("turma_id", ids);
    const tem = new Set((atuais ?? []).map((v) => `${v.turma_id}:${v.disciplina_id}`));
    const novas = ids.flatMap((t) =>
      [...escolhidas].filter((d) => !tem.has(`${t}:${d}`)).map((d) => ({ turma_id: t, disciplina_id: d, professor_id: null, editado_no_painel: true })),
    );
    if (novas.length > 0) {
      const { error } = await supabase.from("turma_disciplinas").insert(novas);
      if (error) {
        console.error("[matriz] aplicar", error);
        voltar(ano, "erro", "Matriz salva, mas não foi possível aplicar às turmas.", ancora);
      }
      for (const n of novas) await supabase.from("vinculos_removidos").delete().eq("turma_id", n.turma_id).eq("disciplina_id", n.disciplina_id);
      incluidas = novas.length;
    }

    if (retirarExtras) {
      for (const v of (atuais ?? []).filter((x) => !escolhidas.has(x.disciplina_id as number))) {
        const { count } = await supabase
          .from("aulas")
          .select("id", { count: "exact", head: true })
          .eq("turma_id", v.turma_id)
          .eq("disciplina_id", v.disciplina_id);
        if (count) {
          mantidasComAula++;
          continue;
        }
        await supabase.from("vinculos_removidos").upsert({ turma_id: v.turma_id, disciplina_id: v.disciplina_id }, { onConflict: "turma_id,disciplina_id" });
        await supabase.from("turma_disciplinas").delete().eq("turma_id", v.turma_id).eq("disciplina_id", v.disciplina_id);
        await supabase.from("turma_horario").delete().eq("turma_id", v.turma_id).eq("disciplina_id", v.disciplina_id);
        retiradas++;
      }
    }
  }

  revalidatePath("/", "layout");
  const partes = [`Matriz de ${serie} salva (${escolhidas.size} disciplinas)`];
  if (ids.length) partes.push(`aplicada a ${ids.length} turma(s): ${incluidas} incluída(s), ${retiradas} retirada(s)`);
  if (mantidasComAula) partes.push(`${mantidasComAula} mantida(s) por já ter aula lançada`);
  voltar(ano, "salvo", `${partes.join("; ")}.`, ancora);
}
