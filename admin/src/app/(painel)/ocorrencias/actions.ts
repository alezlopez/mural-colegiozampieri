"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirArea } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/datas";
import { ehTipoOcorrencia } from "@/lib/ocorrencias";
import { enviarPushOcorrencia } from "@/lib/push";

function voltar(formData: FormData, chave: "salvo" | "erro", msg: string): never {
  const v = String(formData.get("volta") ?? "");
  const base = v.startsWith("/ocorrencias") || v.startsWith("/alunos/") ? v : "/ocorrencias";
  redirect(`${base}${base.includes("?") ? "&" : "?"}${chave}=${encodeURIComponent(msg)}` as Route);
}

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim();

/** Avisa a família; falha no envio não desfaz a ocorrência (ela já aparece no app). */
async function avisar(aluno: string, nome: string, pedeCiencia: boolean) {
  try {
    const n = await enviarPushOcorrencia(aluno, nome, pedeCiencia);
    return n > 0 ? ` Aviso enviado a ${n} aparelho(s).` : " A família não tem o app com notificações ativas; ela vê ao abrir o app.";
  } catch (e) {
    console.error("[ocorrencias] push", e);
    return " Não foi possível enviar a notificação; a família vê ao abrir o app.";
  }
}

export async function registrarOcorrencia(formData: FormData) {
  const { supabase, userId, nome } = await exigirArea("acompanhamento", "editar");
  // O campo do aluno aceita o código puro ou a sugestão "Nome · Turma · código 123".
  const bruto = texto(formData, "aluno");
  const codigo = bruto.match(/código\s+(\S+)\s*$/i)?.[1] ?? bruto;
  const tipo = formData.get("tipo");
  const descricao = texto(formData, "descricao");
  const providencia = texto(formData, "providencia") || null;
  const data = texto(formData, "data") || hojeEmBrasilia();
  const destino = formData.get("destino") === "interna" ? "interna" : "publicada";
  const exigeCiencia = destino === "publicada" && formData.get("exige_ciencia") === "on";
  if (!codigo) voltar(formData, "erro", "Escolha o aluno.");
  if (!ehTipoOcorrencia(tipo)) voltar(formData, "erro", "Escolha o tipo.");
  if (descricao.length < 3) voltar(formData, "erro", "Descreva a ocorrência.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hojeEmBrasilia()) voltar(formData, "erro", "Data inválida.");

  const { ano } = await anoEmUso(supabase);
  const [{ data: aluno }, { data: matricula }] = await Promise.all([
    supabase.from("alunos").select("codigo,nome").eq("codigo", codigo).maybeSingle(),
    supabase.from("matriculas").select("turma_id").eq("aluno_codigo", codigo).eq("ano", ano).eq("ativa", true).maybeSingle(),
  ]);
  if (!aluno) voltar(formData, "erro", `Aluno "${codigo}" não encontrado. Escolha da lista.`);

  const { error } = await supabase.from("ocorrencias").insert({
    aluno_codigo: codigo,
    turma_id: matricula?.turma_id ?? null,
    ano,
    data,
    tipo,
    descricao,
    providencia,
    registrado_por: userId,
    registrado_por_nome: nome,
    status: destino,
    exige_ciencia: exigeCiencia,
    publicada_em: destino === "publicada" ? new Date().toISOString() : null,
    revisado_por: userId,
  });
  if (error) {
    console.error("[ocorrencias] registrar", error);
    voltar(formData, "erro", "Não foi possível registrar.");
  }
  const aviso = destino === "publicada" ? await avisar(codigo, aluno.nome as string, exigeCiencia) : "";
  revalidatePath("/ocorrencias");
  voltar(formData, "salvo", `Ocorrência de ${aluno.nome} ${destino === "publicada" ? "enviada à família." : "registrada como interna."}${aviso}`);
}

/** Revisão da coordenação: ajusta o texto e decide se vai para a família ou fica interna. */
export async function revisarOcorrencia(formData: FormData) {
  const { supabase, userId } = await exigirArea("acompanhamento", "editar");
  const id = texto(formData, "id");
  const acao = texto(formData, "acao"); // publicar | interna | salvar
  const tipo = formData.get("tipo");
  const descricao = texto(formData, "descricao");
  const providencia = texto(formData, "providencia") || null;
  if (!id || !ehTipoOcorrencia(tipo) || descricao.length < 3) voltar(formData, "erro", "Preencha o tipo e a descrição.");

  const { data: atual } = await supabase.from("ocorrencias").select("status,aluno_codigo,exige_ciencia,alunos(nome)").eq("id", id).maybeSingle();
  if (!atual) voltar(formData, "erro", "Ocorrência não encontrada.");
  const nomeAluno = (atual.alunos as unknown as { nome: string } | null)?.nome ?? atual.aluno_codigo;

  const novoStatus = acao === "publicar" ? "publicada" : acao === "interna" ? "interna" : atual.status;
  const exigeCiencia = novoStatus === "publicada" && formData.get("exige_ciencia") === "on";
  const publicandoAgora = novoStatus === "publicada" && atual.status !== "publicada";

  const { error } = await supabase
    .from("ocorrencias")
    .update({
      tipo,
      descricao,
      providencia,
      status: novoStatus,
      exige_ciencia: exigeCiencia,
      revisado_por: userId,
      ...(publicandoAgora ? { publicada_em: new Date().toISOString() } : {}),
      ...(novoStatus !== "publicada" ? { publicada_em: null } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("[ocorrencias] revisar", error);
    voltar(formData, "erro", "Não foi possível salvar.");
  }
  const aviso = publicandoAgora || (exigeCiencia && !atual.exige_ciencia) ? await avisar(atual.aluno_codigo, nomeAluno, exigeCiencia) : "";
  revalidatePath("/ocorrencias");
  voltar(
    formData,
    "salvo",
    publicandoAgora
      ? `Enviada à família de ${nomeAluno}.${aviso}`
      : novoStatus === "interna" && atual.status === "publicada"
        ? `Retirada do app da família de ${nomeAluno}; ficou como registro interno.`
        : `Ocorrência de ${nomeAluno} salva.${aviso}`,
  );
}

export async function excluirOcorrencia(formData: FormData) {
  const { supabase } = await exigirArea("acompanhamento", "editar");
  const id = texto(formData, "id");
  const { data: atual } = await supabase.from("ocorrencias").select("status").eq("id", id).maybeSingle();
  if (!atual) voltar(formData, "erro", "Ocorrência não encontrada.");
  if (atual.status === "publicada") voltar(formData, "erro", "Já foi enviada à família: torne-a interna antes de excluir.");
  await supabase.from("ocorrencias").delete().eq("id", id);
  revalidatePath("/ocorrencias");
  voltar(formData, "salvo", "Ocorrência excluída.");
}
