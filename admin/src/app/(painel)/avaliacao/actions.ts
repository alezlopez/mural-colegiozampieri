"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirArea } from "@/lib/auth";

const SEGMENTOS = new Set(["infantil", "fundamental1", "fundamental2", "medio"]);

function voltar(ano: number, chave: "salvo" | "erro", msg: string): never {
  redirect(`/avaliacao?ano=${ano}&${chave}=${encodeURIComponent(msg)}`);
}

const chaveDe = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30) || "avaliacao";

export async function salvarRegra(formData: FormData) {
  const { supabase } = await exigirArea("avaliacao", "editar");
  const ano = Number(formData.get("ano"));
  const segmento = String(formData.get("segmento") ?? "");
  if (!Number.isInteger(ano) || !SEGMENTOS.has(segmento)) redirect("/avaliacao");

  const descritivo = formData.get("descritivo") === "on";
  const nomes = formData.getAll("nome").map((v) => String(v).trim());
  const pesos = formData.getAll("peso").map(Number);
  const chaves = formData.getAll("chave").map(String);
  const usadas = new Set<string>(["rec"]);
  const avaliacoes: { chave: string; nome: string; peso: number }[] = [];
  nomes.forEach((nome, i) => {
    if (!nome) return;
    // Avaliação já existente mantém a chave (as notas lançadas ficam ligadas a ela).
    let chave = chaves[i] || chaveDe(nome);
    while (usadas.has(chave)) chave = `${chave}_2`;
    usadas.add(chave);
    const peso = Number.isFinite(pesos[i]) && pesos[i] > 0 && pesos[i] <= 10 ? pesos[i] : 1;
    avaliacoes.push({ chave, nome: nome.slice(0, 60), peso });
  });
  if (!descritivo && avaliacoes.length === 0) voltar(ano, "erro", "Informe ao menos uma avaliação (ou marque como descritivo).");

  const media = Number(String(formData.get("media_aprovacao") ?? "").replace(",", "."));
  if (!Number.isFinite(media) || media <= 0 || media > 10) voltar(ano, "erro", "Média de aprovação inválida.");

  const { error } = await supabase.from("avaliacao_config").upsert(
    {
      ano,
      segmento,
      avaliacoes,
      media_aprovacao: media,
      arredondamento: formData.get("arredondamento") === "nenhum" ? "nenhum" : "escola",
      recuperacao_bimestral: formData.get("recuperacao_bimestral") === "on",
      descritivo,
    },
    { onConflict: "ano,segmento" },
  );
  if (error) {
    console.error("[avaliação] salvar", error);
    voltar(ano, "erro", "Não foi possível salvar.");
  }
  revalidatePath("/", "layout");
  voltar(ano, "salvo", "Regras de avaliação salvas.");
}

/** Publica (ou recolhe) o boletim do bimestre para as famílias. */
export async function publicarBoletim(formData: FormData) {
  const { supabase } = await exigirArea("avaliacao", "editar");
  const ano = Number(formData.get("ano"));
  const numero = Number(formData.get("numero"));
  const publicar = formData.get("publicar") === "true";
  if (!Number.isInteger(ano) || !Number.isInteger(numero)) redirect("/avaliacao");
  const { error } = await supabase.from("bimestres").update({ boletim_publicado: publicar }).eq("ano", ano).eq("numero", numero);
  if (error) voltar(ano, "erro", "Não foi possível alterar a publicação.");
  revalidatePath("/", "layout");
  voltar(ano, "salvo", publicar ? `Boletim do ${numero}º bimestre publicado: as famílias já veem as notas.` : `Boletim do ${numero}º bimestre recolhido.`);
}
