import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Ensalamento manual. Matrícula mexida no painel fica com editado_no_painel: a sincronização não muda a turma do
// aluno nesse ano. A turma do aluno no app (alunos.turma) acompanha.

type Matricula = { aluno_codigo: string; turma_id: number; ativa: boolean };

async function matriculasDoAno(supabase: SupabaseClient, ano: number, alunos: string[]) {
  const { data } = await supabase
    .from("matriculas")
    .select("aluno_codigo,turma_id,ativa")
    .eq("ano", ano)
    .in("aluno_codigo", alunos)
    .overrideTypes<Matricula[], { merge: false }>();
  return data ?? [];
}

/** Põe cada aluno na turma de destino (do mesmo ano) e desativa as outras matrículas dele nesse ano. */
export async function ensalar(supabase: SupabaseClient, alunos: string[], destino: { id: number; ano: number; nome: string }) {
  const existentes = await matriculasDoAno(supabase, destino.ano, alunos);
  for (const codigo of alunos) {
    const doAluno = existentes.filter((m) => m.aluno_codigo === codigo);
    for (const m of doAluno.filter((x) => x.turma_id !== destino.id && x.ativa)) {
      const { error } = await supabase
        .from("matriculas")
        .update({ ativa: false, editado_no_painel: true })
        .eq("aluno_codigo", codigo)
        .eq("turma_id", m.turma_id);
      if (error) return error;
    }
    const { error } = doAluno.some((m) => m.turma_id === destino.id)
      ? await supabase
          .from("matriculas")
          .update({ ativa: true, situacao: "L", editado_no_painel: true })
          .eq("aluno_codigo", codigo)
          .eq("turma_id", destino.id)
      : await supabase.from("matriculas").insert({
          aluno_codigo: codigo,
          turma_id: destino.id,
          ano: destino.ano,
          situacao: "L",
          ativa: true,
          numero_chamada: null,
          editado_no_painel: true,
        });
    if (error) return error;
  }
  const { error } = await supabase.from("alunos").update({ turma: destino.nome, ativo: true }).in("codigo", alunos);
  return error;
}
