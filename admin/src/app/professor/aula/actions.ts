"use server";

import { redirect } from "next/navigation";
import { exigirProfessor } from "@/lib/auth";

export type EstadoAula = { erro?: string; salvo?: boolean };

const STATUS = new Set(["presente", "falta", "falta_justificada"]);

export async function salvarAula(_: EstadoAula, formData: FormData): Promise<EstadoAula> {
  const { supabase, professor } = await exigirProfessor();
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  const aulaNumero = Number(formData.get("aula_numero"));
  const data = String(formData.get("data") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  const tarefa = String(formData.get("tarefa") ?? "").trim();
  const entrega = String(formData.get("tarefa_entrega") ?? "");
  if (![turmaId, disciplinaId, aulaNumero].every(Number.isInteger) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { erro: "Dados da aula inválidos." };
  }
  if (!conteudo) return { erro: "Descreva o conteúdo dado na aula." };
  if (conteudo.length > 4000 || tarefa.length > 4000) return { erro: "Texto muito longo." };

  // RLS garante que o professor só grava nas turmas/disciplinas que leciona.
  const { data: aula, error } = await supabase
    .from("aulas")
    .upsert(
      {
        turma_id: turmaId,
        disciplina_id: disciplinaId,
        data,
        aula_numero: aulaNumero,
        conteudo,
        tarefa: tarefa || null,
        tarefa_entrega: tarefa && /^\d{4}-\d{2}-\d{2}$/.test(entrega) ? entrega : null,
        professor_id: professor.id,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "turma_id,disciplina_id,data,aula_numero" },
    )
    .select("id")
    .single();
  if (error || !aula) {
    console.error("[diário] salvar aula", error);
    return { erro: "Não foi possível salvar a aula. Verifique se esta turma/disciplina é sua." };
  }

  const frequencias = [...formData.entries()]
    .filter(([chave, valor]) => chave.startsWith("freq_") && STATUS.has(String(valor)))
    .map(([chave, valor]) => ({ aula_id: aula.id, aluno_codigo: chave.slice(5), status: String(valor) }));
  if (frequencias.length > 0) {
    const { error: erroFreq } = await supabase.from("frequencias").upsert(frequencias, { onConflict: "aula_id,aluno_codigo" });
    if (erroFreq) {
      console.error("[diário] frequência", erroFreq);
      return { erro: "Aula salva, mas a chamada não. Tente salvar de novo." };
    }
  }

  redirect(`/professor?data=${data}&salvo=1`);
}
