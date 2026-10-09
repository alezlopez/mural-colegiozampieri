"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";

// Turmas editadas aqui passam a valer mais que a Mhund (editado_no_painel): a sincronização não desfaz.
// Turma criada aqui é ligada sozinha à turma da Mhund de mesmo nome e ano, quando ela aparecer lá.

const SEGMENTOS = new Set(["infantil", "fundamental1", "fundamental2", "medio"]);
const TURNOS = new Set(["manha", "tarde"]);

function voltar(caminho: string, chave: "salvo" | "erro", msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${chave}=${encodeURIComponent(msg)}`);
}

function dadosTurma(formData: FormData, caminho: string) {
  const nome = String(formData.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const ano = Number(formData.get("ano"));
  const segmento = String(formData.get("segmento") ?? "");
  const turno = String(formData.get("turno") ?? "");
  const modelo = Number(formData.get("modelo_horario_id"));
  if (nome.length < 3 || nome.length > 120) voltar(caminho, "erro", "Informe o nome da turma.");
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) voltar(caminho, "erro", "Ano inválido.");
  if (!SEGMENTOS.has(segmento)) voltar(caminho, "erro", "Escolha o segmento.");
  return {
    nome,
    ano,
    segmento,
    turno: TURNOS.has(turno) ? turno : null,
    serie: String(formData.get("serie") ?? "").trim() || null,
    letra: String(formData.get("letra") ?? "").trim().toUpperCase() || null,
    modelo_horario_id: Number.isInteger(modelo) && modelo > 0 ? modelo : null,
  };
}

type Cliente = Awaited<ReturnType<typeof exigirAdmin>>["supabase"];
async function nomeRepetido(supabase: Cliente, ano: number, nome: string, exceto?: number) {
  let q = supabase.from("turmas").select("id", { count: "exact", head: true }).eq("ano", ano).ilike("nome", nome);
  if (exceto) q = q.neq("id", exceto);
  return ((await q).count ?? 0) > 0;
}

export async function criarTurma(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const dados = dadosTurma(formData, "/turmas");
  if (await nomeRepetido(supabase, dados.ano, dados.nome)) voltar(`/turmas?ano=${dados.ano}`, "erro", "Já existe uma turma com esse nome nesse ano.");
  const { data, error } = await supabase
    .from("turmas")
    .insert({ ...dados, ativa: true, editado_no_painel: true })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[turmas] criar", error);
    voltar(`/turmas?ano=${dados.ano}`, "erro", "Não foi possível cadastrar.");
  }
  revalidatePath("/", "layout");
  voltar(`/turmas/${data.id}`, "salvo", "Turma cadastrada. Monte a grade de disciplinas abaixo.");
}

export async function salvarTurma(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/turmas");
  const caminho = `/turmas/${id}`;
  const { nome, ...resto } = dadosTurma(formData, caminho);
  if (await nomeRepetido(supabase, resto.ano, nome, id)) voltar(caminho, "erro", "Já existe outra turma com esse nome nesse ano.");

  // Renomear muda junto a turma dos alunos e o público das publicações (tudo numa transação no banco).
  const { error: erroNome } = await supabase.rpc("renomear_turma", { p_id: id, p_nome: nome });
  if (erroNome) {
    console.error("[turmas] renomear", erroNome);
    voltar(caminho, "erro", "Não foi possível renomear a turma.");
  }
  const { error } = await supabase.from("turmas").update({ ...resto, editado_no_painel: true }).eq("id", id);
  if (error) voltar(caminho, "erro", "Não foi possível salvar.");
  revalidatePath("/", "layout");
  voltar(caminho, "salvo", "Turma salva.");
}

export async function alternarTurma(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("id"));
  const ativa = formData.get("ativa") === "true";
  if (!Number.isInteger(id)) redirect("/turmas");
  const { error } = await supabase.from("turmas").update({ ativa, editado_no_painel: true }).eq("id", id);
  revalidatePath("/", "layout");
  voltar(`/turmas/${id}`, error ? "erro" : "salvo", error ? "Não foi possível alterar." : ativa ? "Turma reativada." : "Turma inativada.");
}

/** Exclusão definitiva só de turma sem alunos e sem aulas lançadas; nas demais, inativar. */
export async function excluirTurma(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/turmas");
  const caminho = `/turmas/${id}`;
  const { data: turma } = await supabase.from("turmas").select("ano,mhund_id").eq("id", id).maybeSingle();
  if (!turma) voltar("/turmas", "erro", "Turma não encontrada.");
  if (turma.mhund_id) voltar(caminho, "erro", "Turma da Mhund volta na próxima sincronização: use Inativar.");
  const [{ count: alunos }, { count: aulas }] = await Promise.all([
    supabase.from("matriculas").select("aluno_codigo", { count: "exact", head: true }).eq("turma_id", id),
    supabase.from("aulas").select("id", { count: "exact", head: true }).eq("turma_id", id),
  ]);
  if (alunos || aulas) voltar(caminho, "erro", "A turma tem alunos ou aulas lançadas: use Inativar para manter o histórico.");
  const { error } = await supabase.from("turmas").delete().eq("id", id);
  if (error) voltar(caminho, "erro", "Não foi possível excluir.");
  revalidatePath("/", "layout");
  voltar(`/turmas?ano=${turma.ano}`, "salvo", "Turma excluída.");
}

/**
 * Grade da turma: professor de cada disciplina e retirada de disciplinas. Só as linhas alteradas são marcadas como
 * editadas no painel; as demais continuam acompanhando a Mhund.
 */
export async function salvarGrade(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const turmaId = Number(formData.get("turma_id"));
  if (!Number.isInteger(turmaId)) redirect("/turmas");
  const caminho = `/turmas/${turmaId}`;

  const disciplinas = formData.getAll("disciplina").map(Number).filter(Number.isInteger);
  let alteradas = 0;
  for (const d of disciplinas) {
    if (formData.get(`retirar_${d}`) === "on") {
      await supabase.from("vinculos_removidos").upsert({ turma_id: turmaId, disciplina_id: d }, { onConflict: "turma_id,disciplina_id" });
      const { error } = await supabase.from("turma_disciplinas").delete().eq("turma_id", turmaId).eq("disciplina_id", d);
      if (error) voltar(caminho, "erro", "Não foi possível retirar a disciplina.");
      await supabase.from("turma_horario").delete().eq("turma_id", turmaId).eq("disciplina_id", d);
      alteradas++;
      continue;
    }
    const novo = Number(formData.get(`prof_${d}`)) || null;
    const atual = Number(formData.get(`atual_${d}`)) || null;
    if (novo === atual) continue;
    const { error } = await supabase
      .from("turma_disciplinas")
      .update({ professor_id: novo, editado_no_painel: true })
      .eq("turma_id", turmaId)
      .eq("disciplina_id", d);
    if (error) voltar(caminho, "erro", "Não foi possível salvar a grade.");
    alteradas++;
  }
  revalidatePath("/", "layout");
  voltar(caminho, "salvo", alteradas ? `Grade salva (${alteradas} alteração(ões)).` : "Nada foi alterado.");
}

export async function adicionarDisciplina(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  const professorId = Number(formData.get("professor_id")) || null;
  if (!Number.isInteger(turmaId)) redirect("/turmas");
  const caminho = `/turmas/${turmaId}`;
  if (!Number.isInteger(disciplinaId) || disciplinaId <= 0) voltar(caminho, "erro", "Escolha a disciplina.");
  const { error } = await supabase
    .from("turma_disciplinas")
    .upsert({ turma_id: turmaId, disciplina_id: disciplinaId, professor_id: professorId, editado_no_painel: true }, { onConflict: "turma_id,disciplina_id" });
  if (error) voltar(caminho, "erro", "Não foi possível adicionar.");
  await supabase.from("vinculos_removidos").delete().eq("turma_id", turmaId).eq("disciplina_id", disciplinaId);
  revalidatePath("/", "layout");
  voltar(caminho, "salvo", "Disciplina adicionada à turma.");
}
