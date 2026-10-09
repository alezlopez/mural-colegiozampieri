"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";

// Disciplinas editadas aqui passam a valer mais que a Mhund (editado_no_painel): a sincronização não desfaz.

function voltar(chave: "salvo" | "erro", msg: string): never {
  redirect(`/disciplinas?${chave}=${encodeURIComponent(msg)}`);
}

function dados(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const abreviacao = String(formData.get("abreviacao") ?? "").trim() || null;
  if (nome.length < 2 || nome.length > 80) voltar("erro", "Informe o nome da disciplina.");
  if (abreviacao && abreviacao.length > 12) voltar("erro", "Abreviação com no máximo 12 letras.");
  return { nome, abreviacao };
}

export async function criarDisciplina(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const { nome, abreviacao } = dados(formData);
  const { error } = await supabase.from("disciplinas").insert({ nome, abreviacao, ativa: true, editado_no_painel: true });
  if (error) voltar("erro", "Não foi possível cadastrar.");
  voltar("salvo", `Disciplina "${nome}" cadastrada. Atribua a professores em Professores › Editar.`);
}

export async function salvarDisciplina(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) voltar("erro", "Disciplina inválida.");
  const { nome, abreviacao } = dados(formData);
  const { error } = await supabase.from("disciplinas").update({ nome, abreviacao, editado_no_painel: true }).eq("id", id);
  voltar(error ? "erro" : "salvo", error ? "Não foi possível salvar." : `"${nome}" salva.`);
}

export async function alternarDisciplina(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("id"));
  const ativa = formData.get("ativa") === "true";
  if (!Number.isInteger(id)) voltar("erro", "Disciplina inválida.");
  const { error } = await supabase.from("disciplinas").update({ ativa, editado_no_painel: true }).eq("id", id);
  voltar(error ? "erro" : "salvo", error ? "Não foi possível alterar." : ativa ? "Disciplina reativada." : "Disciplina inativada.");
}

/** Exclusão definitiva só se nunca foi usada (sem turmas, horário nem aulas lançadas); senão, inativar. */
export async function excluirDisciplina(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) voltar("erro", "Disciplina inválida.");
  const { data: disc } = await supabase.from("disciplinas").select("mhund_id").eq("id", id).maybeSingle();
  if (!disc) voltar("erro", "Disciplina não encontrada.");
  if (disc.mhund_id) voltar("erro", "Disciplina da Mhund volta na próxima sincronização: use Inativar.");
  const contar = async (tabela: string) =>
    (await supabase.from(tabela).select("disciplina_id", { count: "exact", head: true }).eq("disciplina_id", id)).count ?? 0;
  if ((await contar("aulas")) + (await contar("turma_disciplinas")) + (await contar("turma_horario")) > 0) {
    voltar("erro", "Esta disciplina já está em turmas ou aulas: use Inativar para manter o histórico.");
  }
  const { error } = await supabase.from("disciplinas").delete().eq("id", id);
  voltar(error ? "erro" : "salvo", error ? "Não foi possível excluir." : "Disciplina excluída.");
}
