"use server";

import { redirect } from "next/navigation";
import { exigirProfessor } from "@/lib/auth";
import { lerNota } from "@/lib/avaliacao";

export type EstadoNotas = { erro?: string };

/**
 * Grava as notas (ou pareceres) de um bimestre. Campos: n_<aluno>_<avaliação> = nota; p_<aluno> = parecer.
 * Nota apagada no formulário é removida. A RLS garante que o professor só grava na turma/disciplina dele.
 */
export async function salvarNotas(_: EstadoNotas, formData: FormData): Promise<EstadoNotas> {
  const { supabase, professor } = await exigirProfessor();
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  const ano = Number(formData.get("ano"));
  const bimestre = Number(formData.get("bimestre"));
  if (![turmaId, disciplinaId, ano, bimestre].every(Number.isInteger) || bimestre < 1 || bimestre > 4) {
    return { erro: "Dados inválidos. Recarregue a página." };
  }
  const base = { disciplina_id: disciplinaId, ano, bimestre, turma_id: turmaId, professor_id: professor.id, atualizado_em: new Date().toISOString() };

  const gravar: { aluno_codigo: string; avaliacao: string; valor: number }[] = [];
  const apagar: { aluno_codigo: string; avaliacao: string }[] = [];
  const pareceres: { aluno_codigo: string; texto: string }[] = [];
  const pareceresApagar: string[] = [];
  for (const [chave, bruto] of formData.entries()) {
    const nota = /^n_([\w.-]+)__([a-z0-9_]+)$/.exec(chave);
    if (nota) {
      const valor = lerNota(String(bruto));
      if (Number.isNaN(valor)) return { erro: `Nota inválida: "${bruto}". Use de 0 a 10, com até 2 casas (ex.: 7,5).` };
      if (valor === null) apagar.push({ aluno_codigo: nota[1], avaliacao: nota[2] });
      else gravar.push({ aluno_codigo: nota[1], avaliacao: nota[2], valor });
      continue;
    }
    const parecer = /^p_([\w.-]+)$/.exec(chave);
    if (parecer) {
      const texto = String(bruto).trim();
      if (texto.length > 6000) return { erro: "Parecer muito longo (máximo 6.000 letras)." };
      if (texto) pareceres.push({ aluno_codigo: parecer[1], texto });
      else pareceresApagar.push(parecer[1]);
    }
  }

  if (gravar.length) {
    const { error } = await supabase
      .from("notas")
      .upsert(gravar.map((g) => ({ ...base, ...g })), { onConflict: "aluno_codigo,disciplina_id,ano,bimestre,avaliacao" });
    if (error) {
      console.error("[notas] gravar", error);
      return { erro: "Não foi possível salvar as notas. Verifique se a turma é sua." };
    }
  }
  for (const a of apagar) {
    await supabase
      .from("notas")
      .delete()
      .eq("aluno_codigo", a.aluno_codigo)
      .eq("disciplina_id", disciplinaId)
      .eq("ano", ano)
      .eq("bimestre", bimestre)
      .eq("avaliacao", a.avaliacao);
  }
  if (pareceres.length) {
    const { error } = await supabase
      .from("pareceres")
      .upsert(pareceres.map((p) => ({ ...base, ...p })), { onConflict: "aluno_codigo,disciplina_id,ano,bimestre" });
    if (error) {
      console.error("[notas] pareceres", error);
      return { erro: "Não foi possível salvar os pareceres." };
    }
  }
  if (pareceresApagar.length) {
    await supabase
      .from("pareceres")
      .delete()
      .in("aluno_codigo", pareceresApagar)
      .eq("disciplina_id", disciplinaId)
      .eq("ano", ano)
      .eq("bimestre", bimestre);
  }

  redirect(`/professor/turma?turma=${turmaId}&disciplina=${disciplinaId}&aba=notas&bimestre=${bimestre}&salvo=1`);
}
