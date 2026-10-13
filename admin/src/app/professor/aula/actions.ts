"use server";

import { redirect } from "next/navigation";
import { exigirProfessor } from "@/lib/auth";

export type EstadoAula = { erro?: string; salvo?: boolean };

const STATUS = new Set(["presente", "falta", "falta_justificada"]);

export async function salvarAula(_: EstadoAula, formData: FormData): Promise<EstadoAula> {
  const { supabase, professor } = await exigirProfessor();
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  // Aula dupla: o mesmo conteúdo e a mesma chamada valem para cada aula (a frequência conta por aula).
  const numeros = [...new Set(String(formData.get("aula_numeros") ?? "").split(",").map(Number))].filter(
    (n) => Number.isInteger(n) && n >= 1 && n <= 15,
  );
  const data = String(formData.get("data") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  const tarefa = String(formData.get("tarefa") ?? "").trim();
  const entrega = String(formData.get("tarefa_entrega") ?? "");
  const voltaBruta = String(formData.get("volta") ?? "");
  const volta = /^\/professor[\w/?=&.-]*$/.test(voltaBruta) ? voltaBruta : `/professor?data=${data}`;
  if (![turmaId, disciplinaId].every(Number.isInteger) || numeros.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { erro: "Dados da aula inválidos." };
  }
  if (!conteudo) return { erro: "Descreva o conteúdo dado na aula." };
  if (conteudo.length > 4000 || tarefa.length > 4000) return { erro: "Texto muito longo." };

  const frequenciasDoForm = [...formData.entries()]
    .filter(([chave, valor]) => chave.startsWith("freq_") && STATUS.has(String(valor)))
    .map(([chave, valor]) => ({ aluno_codigo: chave.slice(5), status: String(valor) }));

  for (const aulaNumero of numeros) {
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
    if (frequenciasDoForm.length > 0) {
      const { error: erroFreq } = await supabase
        .from("frequencias")
        .upsert(frequenciasDoForm.map((f) => ({ ...f, aula_id: aula.id })), { onConflict: "aula_id,aluno_codigo" });
      if (erroFreq) {
        console.error("[diário] frequência", erroFreq);
        return { erro: "Aula salva, mas a chamada não. Tente salvar de novo." };
      }
    }
  }

  redirect(`${volta}${volta.includes("?") ? "&" : "?"}salvo=1`);
}
