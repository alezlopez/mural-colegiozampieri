"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirProfessor } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/datas";
import { ehTipoOcorrencia } from "@/lib/ocorrencias";

function voltar(chave: "salvo" | "erro", msg: string, extra = ""): never {
  redirect(`/professor/ocorrencias?${extra}${extra ? "&" : ""}${chave}=${encodeURIComponent(msg)}` as Route);
}

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim();

/** O professor registra; a coordenação revisa antes de a família ver (o banco só aceita "pendente" vindo do professor). */
export async function registrarOcorrenciaProfessor(formData: FormData) {
  const { supabase, userId, professor } = await exigirProfessor();
  const turmaId = Number(formData.get("turma"));
  const disciplinaId = Number(formData.get("disciplina"));
  const aluno = texto(formData, "aluno");
  const tipo = formData.get("tipo");
  const descricao = texto(formData, "descricao");
  const data = texto(formData, "data") || hojeEmBrasilia();
  const contexto = `turma=${turmaId}&disciplina=${disciplinaId}`;
  if (!aluno) voltar("erro", "Escolha o aluno.", contexto);
  if (!ehTipoOcorrencia(tipo)) voltar("erro", "Escolha o tipo.", contexto);
  if (descricao.length < 3) voltar("erro", "Descreva o que aconteceu.", contexto);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hojeEmBrasilia()) voltar("erro", "Data inválida.", contexto);

  const { data: turma } = await supabase.from("turmas").select("ano").eq("id", turmaId).maybeSingle();
  const { error } = await supabase.from("ocorrencias").insert({
    aluno_codigo: aluno,
    turma_id: turmaId,
    ano: (turma?.ano as number | undefined) ?? Number(data.slice(0, 4)),
    data,
    tipo,
    descricao,
    disciplina_id: Number.isInteger(disciplinaId) && disciplinaId > 0 ? disciplinaId : null,
    professor_id: professor.id,
    registrado_por: userId,
    registrado_por_nome: professor.nome,
    status: "pendente",
  });
  if (error) {
    console.error("[ocorrencias] professor registrar", error);
    voltar("erro", "Não foi possível registrar. O aluno precisa ser de uma turma sua.", contexto);
  }
  revalidatePath("/professor/ocorrencias");
  voltar("salvo", "Ocorrência registrada. A coordenação revisa antes de a família ver.");
}

export async function editarOcorrenciaProfessor(formData: FormData) {
  const { supabase } = await exigirProfessor();
  const id = texto(formData, "id");
  const tipo = formData.get("tipo");
  const descricao = texto(formData, "descricao");
  if (!ehTipoOcorrencia(tipo) || descricao.length < 3) voltar("erro", "Preencha o tipo e a descrição.");
  // O RLS só deixa alterar a própria ocorrência enquanto a coordenação não revisou.
  const { data, error } = await supabase.from("ocorrencias").update({ tipo, descricao }).eq("id", id).eq("status", "pendente").select("id");
  if (error || !data?.length) voltar("erro", "Não foi possível salvar: a coordenação já revisou esta ocorrência.");
  revalidatePath("/professor/ocorrencias");
  voltar("salvo", "Ocorrência atualizada.");
}

export async function excluirOcorrenciaProfessor(formData: FormData) {
  const { supabase } = await exigirProfessor();
  const id = texto(formData, "id");
  const { data, error } = await supabase.from("ocorrencias").delete().eq("id", id).eq("status", "pendente").select("id");
  if (error || !data?.length) voltar("erro", "Não foi possível excluir: a coordenação já revisou esta ocorrência.");
  revalidatePath("/professor/ocorrencias");
  voltar("salvo", "Ocorrência excluída.");
}
