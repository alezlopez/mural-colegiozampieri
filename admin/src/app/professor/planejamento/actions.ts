"use server";

import { redirect } from "next/navigation";
import { exigirProfessor } from "@/lib/auth";
import { periodoDe, type Periodo } from "@/lib/planejamento";

const LIMITE = 6000;

function voltar(turma: number, disciplina: number, chave: "salvo" | "erro", msg: string): never {
  redirect(`/professor/turma?turma=${turma}&disciplina=${disciplina}&aba=planejamento&${chave}=${encodeURIComponent(msg)}`);
}

/** Cria ou edita um planejamento. Na criação, pode salvar a mesma cópia em outras turmas do professor (mesma disciplina). */
export async function salvarPlanejamento(formData: FormData) {
  const { supabase, professor } = await exigirProfessor();
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  if (!Number.isInteger(turmaId) || !Number.isInteger(disciplinaId)) redirect("/professor/turmas");
  const id = String(formData.get("id") ?? "");
  const tipo: Periodo = formData.get("periodo") === "mensal" ? "mensal" : "semanal";
  const referencia = String(formData.get(tipo === "mensal" ? "mes" : "semana") ?? "");
  const data = tipo === "mensal" ? `${referencia}-01` : referencia;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) voltar(turmaId, disciplinaId, "erro", "Escolha a semana ou o mês do planejamento.");

  const campo = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const conteudos = campo("texto");
  if (!conteudos) voltar(turmaId, disciplinaId, "erro", "Preencha os conteúdos.");
  const campos = { objetivos: campo("objetivos"), texto: conteudos, metodologia: campo("metodologia"), recursos: campo("recursos"), avaliacao: campo("avaliacao") };
  if (Object.values(campos).some((v) => v && v.length > LIMITE)) voltar(turmaId, disciplinaId, "erro", "Texto muito longo em algum campo.");

  const { inicio, fim } = periodoDe(tipo, data);
  const linha = { ...campos, periodo: tipo, inicio, fim, professor_id: professor.id, atualizado_em: new Date().toISOString() };

  if (/^[0-9a-f-]{36}$/.test(id)) {
    // A RLS só deixa editar planejamento de turma/disciplina que o professor leciona.
    const { error } = await supabase.from("planejamentos").update(linha).eq("id", id);
    if (error) voltar(turmaId, disciplinaId, "erro", "Não foi possível salvar.");
    voltar(turmaId, disciplinaId, "salvo", "Planejamento atualizado.");
  }

  const turmas = [turmaId, ...formData.getAll("copiar_para").map(Number).filter((t) => Number.isInteger(t) && t !== turmaId)];
  const { error } = await supabase.from("planejamentos").insert(turmas.map((t) => ({ ...linha, turma_id: t, disciplina_id: disciplinaId })));
  if (error) {
    console.error("[planejamento] criar", error);
    voltar(turmaId, disciplinaId, "erro", "Não foi possível salvar. Verifique se as turmas são suas.");
  }
  voltar(turmaId, disciplinaId, "salvo", turmas.length > 1 ? `Planejamento salvo em ${turmas.length} turmas.` : "Planejamento salvo.");
}

export async function excluirPlanejamento(formData: FormData) {
  const { supabase } = await exigirProfessor();
  const id = String(formData.get("id") ?? "");
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/professor/turmas");
  const { error } = await supabase.from("planejamentos").delete().eq("id", id);
  voltar(turmaId, disciplinaId, error ? "erro" : "salvo", error ? "Não foi possível excluir." : "Planejamento excluído.");
}
